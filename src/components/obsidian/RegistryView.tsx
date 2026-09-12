"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  BadgeMinus,
  BadgePlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  Play,
  Search,
  Trash2,
  Undo2,
  Users,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { playFeedback } from "@/lib/feedback";
import { useObsidianStore } from "@/lib/client-store";
import { ImportWizard } from "./ImportWizard";
import { cn } from "@/lib/utils";

function timeFmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM, h:mm a");
  } catch {
    return iso;
  }
}

export function RegistryView() {
  const admin = useObsidianStore((s) => s.admin);
  const isAdmin = admin?.role === "ADMIN";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"students" | "import">("students");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<{ id: string; name: string; mobile: string; department: string; email: string; year: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [quickId, setQuickId] = useState("");

  // debounce search
  useMemo(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.stats(),
    refetchInterval: 8000,
  });
  const departments = statsQuery.data?.stats.departments ?? [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["students", debouncedQ, status, dept, sort, page],
    queryFn: () => api.students({ q: debouncedQ, status, dept, sort, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
    enabled: tab === "students",
  });

  async function runAction(
    id: string,
    action: "checkin" | "uncheckin" | "edit" | "delete",
    extra?: Record<string, string>
  ) {
    setActionBusy(id + action);
    try {
      if (action === "delete") {
        await api.deleteStudent(id);
        toast({ title: "Record removed", description: "The student record was deleted." });
      } else {
        await api.studentAction(id, { action, ...extra });
        const labels: Record<string, string> = {
          checkin: "Manual check-in recorded",
          uncheckin: "Check-in reverted",
          edit: "Student updated",
        };
        toast({ title: labels[action] ?? "Done", description: "Audit log updated." });
      }
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionBusy(null);
      setEditing(null);
      setDeleting(null);
    }
  }

  const students = data?.students ?? [];
  const totalPages = data?.totalPages ?? 1;

  const quickCheckin = useMutation({
    mutationFn: (id: string) => api.quickCheckin(id),
    onSuccess: (res) => {
      if (res.result === "GRANTED") playFeedback("granted");
      else if (res.result === "ALREADY_CHECKED_IN") playFeedback("already");
      else playFeedback("denied");
      setQuickId("");
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => playFeedback("denied"),
  });

  const quickResult = quickCheckin.data;
  const quickOk = quickResult?.result === "GRANTED";
  const quickWarn = quickResult?.result === "ALREADY_CHECKED_IN";

  function submitQuick(e: React.FormEvent) {
    e.preventDefault();
    const id = quickId.trim();
    if (!id || quickCheckin.isPending) return;
    quickCheckin.mutate(id);
  }

  return (
    <div className="space-y-5">
      {/* tabs */}
      <div className="flex w-full max-w-xs rounded-xl border border-purple-500/25 bg-[#0b0514]/70 p-1">
        {(
          [
            { id: "students", label: "All Students", icon: Users },
            ...(isAdmin ? [{ id: "import" as const, label: "Import", icon: BadgeCheck }] : []),
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
              tab === t.id
                ? "bg-gradient-to-r from-purple-600/40 to-purple-500/20 text-purple-50 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.4)]"
                : "text-purple-200/55 hover:text-purple-100"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "import" ? (
        <ImportWizard onDone={() => setTab("students")} />
      ) : (
        <>
          {/* quick check-in — entry desk pad */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="obs-card rounded-2xl border-purple-400/25 p-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/30 to-violet-800/30">
                <Zap className="h-4 w-4 text-purple-300" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-purple-100">Quick check-in</p>
                <p className="text-[11px] text-purple-200/50">Walk-up juniors with a dead phone — type their ID and hit enter.</p>
              </div>
            </div>
            <form onSubmit={submitQuick} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={quickId}
                onChange={(e) => setQuickId(e.target.value)}
                placeholder="e.g. OBS26-041"
                aria-label="Student ID for quick check-in"
                autoComplete="off"
                spellCheck={false}
                className="h-11 flex-1 rounded-xl border-purple-500/35 bg-[#0b0517]/90 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-purple-50 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-purple-200/25"
              />
              <Button
                type="submit"
                disabled={!quickId.trim() || quickCheckin.isPending}
                className="obs-glow-btn h-11 rounded-xl bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 px-6 text-sm font-semibold text-white"
              >
                {quickCheckin.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgePlus className="mr-2 h-4 w-4" />}
                Check in
              </Button>
            </form>
            <AnimatePresence>
              {quickResult && (
                <motion.div
                  key={quickResult.message}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "mt-3 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-relaxed",
                    quickOk
                      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                      : quickWarn
                        ? "border-amber-400/35 bg-amber-500/10 text-amber-200"
                        : "border-rose-400/35 bg-rose-500/10 text-rose-200"
                  )}
                  role="status"
                >
                  {quickOk ? (
                    <BadgePlus className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : quickWarn ? (
                    <BadgeMinus className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">{quickResult.student?.name ?? quickResult.result}</p>
                    <p className="opacity-80">{quickResult.message}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* filter bar */}
          <div className="obs-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/50" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ID, name, mobile, email…"
                className="h-10 rounded-xl border-purple-500/30 bg-[#0b0517]/80 pl-9 text-sm text-purple-50 placeholder:text-purple-200/25 focus:border-purple-400/70"
              />
              {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-purple-400/60" />}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:w-auto sm:flex">
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="h-10 rounded-xl border-purple-500/30 bg-[#0b0517]/80 text-xs text-purple-100 sm:w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="border-purple-500/30 bg-[#0e0819] text-purple-100">
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="CHECKED_IN">Checked in</SelectItem>
                  <SelectItem value="NOT_ARRIVED">Not arrived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dept} onValueChange={(v) => { setDept(v); setPage(1); }}>
                <SelectTrigger className="h-10 rounded-xl border-purple-500/30 bg-[#0b0517]/80 text-xs text-purple-100 sm:w-[120px]">
                  <SelectValue placeholder="Dept" />
                </SelectTrigger>
                <SelectContent className="border-purple-500/30 bg-[#0e0819] text-purple-100">
                  <SelectItem value="ALL">All depts</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
                <SelectTrigger className="h-10 rounded-xl border-purple-500/30 bg-[#0b0517]/80 text-xs text-purple-100 sm:w-[125px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="border-purple-500/30 bg-[#0e0819] text-purple-100">
                  <SelectItem value="recent">Recent activity</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                  <SelectItem value="id">Student ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* table */}
          <div className="obs-card overflow-hidden rounded-2xl">
            <div className="obs-scrollbar overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-purple-500/20 bg-purple-500/5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200/60">
                    <th className="px-4 py-3.5">Student</th>
                    <th className="px-4 py-3.5">ID</th>
                    <th className="px-4 py-3.5">Dept</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Check-in</th>
                    <th className="px-4 py-3.5">Tries</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-purple-500/10">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <Skeleton className="h-5 w-full bg-purple-500/10" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-sm text-purple-200/40">
                        <Users className="mx-auto mb-3 h-9 w-9 text-purple-300/25" />
                        {debouncedQ || status !== "ALL" || dept !== "ALL"
                          ? "No students match these filters."
                          : "No students yet — import the registration sheet from the Import tab."}
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-purple-500/10 transition-colors hover:bg-purple-500/5"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              s.checkedIn
                                ? "bg-gradient-to-br from-purple-500/40 to-violet-800/40 text-purple-100"
                                : "bg-purple-500/10 text-purple-200/60"
                            )}>
                              {s.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-purple-50">{s.name}</p>
                              {s.mobile && <p className="text-[11px] text-purple-300/50">{s.mobile}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-purple-200/80">{s.studentId}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-purple-500/10 px-2 py-1 text-[11px] font-medium text-purple-200/80">
                            {s.department || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {s.checkedIn ? (
                            <span className="flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                              <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> In
                            </span>
                          ) : (
                            <span className="rounded-full border border-purple-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-200/50">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-purple-200/60">
                            <Clock className="h-3 w-3 text-purple-300/40" />
                            {s.checkinAt ? timeFmt(s.checkinAt) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs text-purple-200/60">{s.attempts || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {!s.checkedIn && (
                              <Button
                                size="icon"
                                onClick={() => runAction(s.id, "checkin")}
                                disabled={actionBusy === s.id + "checkin"}
                                title="Manual check-in"
                                aria-label={`Manually check in ${s.name}`}
                                className="h-8 w-8 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/25"
                              >
                                {actionBusy === s.id + "checkin" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            {s.checkedIn && isAdmin && (
                              <Button
                                size="icon"
                                onClick={() => runAction(s.id, "uncheckin")}
                                disabled={actionBusy === s.id + "uncheckin"}
                                title="Revert check-in"
                                aria-label={`Revert check-in for ${s.name}`}
                                className="h-8 w-8 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/25"
                              >
                                {actionBusy === s.id + "uncheckin" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            {isAdmin && (
                              <>
                                <Button
                                  size="icon"
                                  onClick={() =>
                                    setEditing({
                                      id: s.id,
                                      name: s.name,
                                      mobile: s.mobile ?? "",
                                      department: s.department ?? "",
                                      email: s.email ?? "",
                                      year: s.year ?? "",
                                    })
                                  }
                                  title="Edit"
                                  aria-label={`Edit ${s.name}`}
                                  className="h-8 w-8 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/25"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  onClick={() => setDeleting({ id: s.id, name: s.name })}
                                  title="Delete"
                                  aria-label={`Delete ${s.name}`}
                                  className="h-8 w-8 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/25"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="flex items-center justify-between border-t border-purple-500/15 px-4 py-3">
              <p className="text-xs text-purple-200/50">
                {data ? `${(data.page - 1) * data.pageSize + (data.students.length || 0)} of ${data.total} records` : "…"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 rounded-lg border-purple-500/30 text-purple-200 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-mono text-xs text-purple-200/70">
                  {page}/{Math.max(totalPages, 1)}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 w-8 rounded-lg border-purple-500/30 text-purple-200 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="obs-card border-purple-500/40 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-purple-50">Edit Student</DialogTitle>
            <DialogDescription className="text-purple-200/60">Correct registration details. Logged to audit trail.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3.5 py-2">
              {(
                [
                  ["name", "Name"],
                  ["mobile", "Mobile"],
                  ["department", "Department"],
                  ["email", "Email"],
                  ["year", "Year"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-purple-200/60">{label}</label>
                  <Input
                    value={editing[key]}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                    className="h-10 rounded-xl border-purple-500/30 bg-[#0b0517]/90 text-sm text-purple-50 focus:border-purple-400/70"
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="border-purple-500/30 text-purple-200">Cancel</Button>
            <Button
              onClick={() => editing && runAction(editing.id, "edit", { name: editing.name, mobile: editing.mobile, department: editing.department, email: editing.email, year: editing.year })}
              className="obs-glow-btn bg-gradient-to-r from-violet-700 to-purple-500 text-white hover:brightness-110"
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="obs-card border-rose-500/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-rose-100">Remove record?</AlertDialogTitle>
            <AlertDialogDescription className="text-purple-200/60">
              This permanently deletes <span className="font-semibold text-purple-100">{deleting?.name}</span> from the registry. Check-in history audit entries remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-purple-500/30 text-purple-200">Keep record</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && runAction(deleting.id, "delete")}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
