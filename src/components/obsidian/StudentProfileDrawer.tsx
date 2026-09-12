"use client";

/**
 * STUDENT PROFILE DRAWER — full record + per-student audit timeline + actions.
 *
 * Opens from a registry row (profile button or clicking the student's name).
 * Available to volunteers too (read-only actions follow role permissions).
 * Includes share tooling: copy invite link, WhatsApp invite, and the branded
 * e-invite pass card PNG.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Clock,
  Copy,
  Download,
  Fingerprint,
  IdCard,
  Loader2,
  Mail,
  Phone,
  Play,
  ShieldCheck,
  Sparkles,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { playFeedback } from "@/lib/feedback";
import { downloadPassCard, inviteUrlFor, whatsappInviteUrl } from "@/lib/pass-card";
import type { AdminRole, AuditRow, StudentRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function timeFmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy · h:mm a");
  } catch {
    return iso;
  }
}

function timeShort(iso: string): string {
  try {
    return format(new Date(iso), "dd MMM, h:mm:ss a");
  } catch {
    return iso;
  }
}

const RESULT_THEME: Record<string, { dot: string; label: string; text: string }> = {
  GRANTED: { dot: "bg-emerald-400", label: "GRANTED", text: "text-emerald-300" },
  ALREADY_CHECKED_IN: { dot: "bg-amber-400", label: "ALREADY IN", text: "text-amber-300" },
  DENIED: { dot: "bg-rose-400", label: "DENIED", text: "text-rose-300" },
  RATE_LIMITED: { dot: "bg-rose-400", label: "RATE LIMITED", text: "text-rose-300" },
  EVENT_CLOSED: { dot: "bg-amber-400", label: "EVENT CLOSED", text: "text-amber-300" },
  UNCHECKED: { dot: "bg-amber-400", label: "CHECK-IN REVERTED", text: "text-amber-300" },
  EDITED: { dot: "bg-purple-400", label: "RECORD EDITED", text: "text-purple-300" },
  DELETED: { dot: "bg-rose-400", label: "RECORD DELETED", text: "text-rose-300" },
};

function themeFor(result: string) {
  return RESULT_THEME[result] ?? { dot: "bg-purple-400", label: result, text: "text-purple-300" };
}

function DetailCell({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-purple-500/15 bg-purple-500/[0.04] px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200/45">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p
        className={cn(
          "mt-1.5 truncate text-sm font-medium text-purple-50",
          mono && "font-mono tracking-wide"
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {value || <span className="text-purple-200/30">—</span>}
      </p>
    </div>
  );
}

function HistoryItem({ log, last }: { log: AuditRow; last: boolean }) {
  const t = themeFor(log.result);
  return (
    <li className="relative flex gap-3.5 pb-5">
      {/* rail */}
      {!last && (
        <span
          aria-hidden
          className="absolute left-[5.5px] top-4 h-full w-px bg-gradient-to-b from-purple-500/40 to-purple-500/5"
        />
      )}
      <span className={cn("relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-[#0d0716]", t.dot)}>
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-40", t.dot)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className={cn("text-[11px] font-bold tracking-wide", t.text)}>{t.label}</span>
          <span className="text-[10px] text-purple-200/35">{timeShort(log.createdAt)}</span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-purple-200/50" title={log.rawInput}>
          input: <span className="text-purple-200/75">{log.rawInput}</span>
        </p>
      </div>
    </li>
  );
}

export function StudentProfileDrawer({
  studentId,
  role,
  onClose,
  onActionComplete,
}: {
  studentId: string | null;
  role: AdminRole;
  onClose: () => void;
  onActionComplete?: (student: StudentRow) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const passLock = useRef(false);

  const open = studentId !== null;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student-profile", studentId],
    queryFn: () => api.studentProfile(studentId as string),
    enabled: open,
  });

  // keep drawer data fresh after any registry mutation
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  const student = data?.student ?? null;
  const history = data?.history ?? [];
  const isAdmin = role === "ADMIN";

  async function runAction(action: "checkin" | "uncheckin") {
    if (!student || actionBusy) return;
    setActionBusy(action);
    try {
      const res = await api.studentAction(student.id, { action });
      playFeedback(action === "checkin" ? "granted" : "already");
      toast({
        title:
          action === "checkin"
            ? `${res.student.name} checked in`
            : `Check-in reverted for ${res.student.name}`,
        description: "Audit trail updated.",
      });
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
      await qc.invalidateQueries({ queryKey: ["student-profile"] });
      onActionComplete?.(res.student);
    } catch (err) {
      playFeedback("denied");
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setActionBusy(null);
    }
  }

  async function copyInvite() {
    if (!student) return;
    const url = inviteUrlFor(student.studentId);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      playFeedback("tap");
      toast({ title: "Invite link copied", description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  }

  async function downloadPass() {
    if (!student || passLock.current) return;
    passLock.current = true;
    setPassBusy(true);
    try {
      await downloadPassCard({ student });
      playFeedback("granted");
      toast({
        title: "E-invite pass downloaded",
        description: `${student.name} · ${student.studentId}.png`,
      });
    } catch (err) {
      toast({
        title: "Could not render pass",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      passLock.current = false;
      setPassBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="obs-card w-full border-l-purple-500/30 bg-[#0d0716] p-0 sm:max-w-md"
      >
        <div className="obs-scrollbar flex h-full flex-col overflow-y-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Student profile</SheetTitle>
            <SheetDescription>Registration details and verification history</SheetDescription>
          </SheetHeader>

          {isLoading || !student ? (
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full bg-purple-500/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3 bg-purple-500/10" />
                  <Skeleton className="h-4 w-1/3 bg-purple-500/10" />
                </div>
              </div>
              <Skeleton className="h-28 w-full rounded-2xl bg-purple-500/10" />
              <Skeleton className="h-40 w-full rounded-2xl bg-purple-500/10" />
            </div>
          ) : (
            <>
              {/* ---- hero ---- */}
              <div className="relative shrink-0 overflow-hidden border-b border-purple-500/20 px-6 pb-6 pt-7">
                <div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-purple-600/20 blur-3xl" />
                <div className="obs-grid-bg pointer-events-none absolute inset-0 opacity-40" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <span
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black shadow-lg",
                        student.checkedIn
                          ? "bg-gradient-to-br from-purple-400/70 to-violet-700/70 text-white shadow-purple-900/40"
                          : "bg-purple-500/10 text-purple-200/70"
                      )}
                    >
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-xl font-bold text-purple-50">
                        {student.name}
                      </h2>
                      <p className="mt-0.5 font-mono text-sm tracking-wider text-purple-300/80">
                        {student.studentId}
                      </p>
                    </div>
                  </div>
                  {student.checkedIn ? (
                    <span className="flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> Inside
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-purple-500/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-200/50">
                      Pending
                    </span>
                  )}
                </div>

                {/* status strip */}
                <div className="relative mt-5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-[#0b0517]/80 px-2.5 py-1.5 text-purple-200/70">
                    <Clock className="h-3 w-3 text-purple-300/60" />
                    {student.checkedIn
                      ? `In at ${timeFmt(student.checkinAt)}`
                      : "Not checked in yet"}
                  </span>
                  {student.checkinBy && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-[#0b0517]/80 px-2.5 py-1.5 text-purple-200/70">
                      <ShieldCheck className="h-3 w-3 text-emerald-300/70" />
                      {student.checkinBy === "SELF" ? "Self check-in (QR)" : `by ${student.checkinBy}`}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-[#0b0517]/80 px-2.5 py-1.5 text-purple-200/70">
                    <Fingerprint className="h-3 w-3 text-purple-300/60" />
                    {student.attempts} attempt{student.attempts === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* ---- actions ---- */}
              <div className="shrink-0 border-b border-purple-500/15 px-6 py-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/45">
                  Desk actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {!student.checkedIn ? (
                    <Button
                      onClick={() => void runAction("checkin")}
                      disabled={actionBusy !== null}
                      className="obs-glow-btn h-10 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-600 px-4 text-sm font-semibold text-white"
                    >
                      {actionBusy === "checkin" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      Check in now
                    </Button>
                  ) : (
                    isAdmin && (
                      <Button
                        onClick={() => void runAction("uncheckin")}
                        disabled={actionBusy !== null}
                        className="h-10 rounded-xl border border-amber-400/40 bg-amber-500/12 px-4 text-sm font-semibold text-amber-200 hover:bg-amber-500/25"
                      >
                        {actionBusy === "uncheckin" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Undo2 className="mr-2 h-4 w-4" />
                        )}
                        Revert check-in
                      </Button>
                    )
                  )}
                  <Button
                    onClick={() => void copyInvite()}
                    variant="outline"
                    className="h-10 rounded-xl border-purple-500/35 bg-purple-500/5 px-4 text-sm font-medium text-purple-100 hover:bg-purple-500/15"
                  >
                    {copied ? <Check className="mr-2 h-4 w-4 text-emerald-300" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? "Copied" : "Copy invite link"}
                  </Button>
                  <a
                    href={whatsappInviteUrl(student.name, student.studentId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => playFeedback("tap")}
                    className="obs-glow-btn inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 px-4 text-sm font-semibold text-white"
                  >
                    <SendIcon /> WhatsApp invite
                  </a>
                  <Button
                    onClick={() => void downloadPass()}
                    disabled={passBusy}
                    variant="outline"
                    className="h-10 rounded-xl border-purple-500/35 bg-purple-500/5 px-4 text-sm font-medium text-purple-100 hover:bg-purple-500/15"
                  >
                    {passBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Pass PNG
                  </Button>
                </div>
                <p className="mt-2.5 text-[10px] leading-relaxed text-purple-200/35">
                  The invite link pre-fills the entry form on the student&apos;s phone; the pass PNG is a
                  branded e-invite with their personal QR.
                </p>
              </div>

              {/* ---- details ---- */}
              <div className="shrink-0 border-b border-purple-500/15 px-6 py-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/45">
                  Registration record
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <DetailCell icon={Phone} label="Mobile" value={student.mobile} mono />
                  <DetailCell icon={IdCard} label="Department" value={student.department} />
                  <DetailCell icon={Mail} label="Email" value={student.email} />
                  <DetailCell icon={UserRound} label="Year" value={student.year} />
                  <DetailCell icon={Clock} label="Registered" value={timeFmt(student.createdAt)} />
                  <DetailCell
                    icon={BadgeCheck}
                    label="Record ID"
                    value={<span className="font-mono text-xs">{student.id.slice(-8).toUpperCase()}</span>}
                    mono
                  />
                </div>
              </div>

              {/* ---- audit timeline ---- */}
              <div className="px-6 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/45">
                    Verification history
                  </p>
                  <span className="rounded-full border border-purple-500/25 px-2.5 py-0.5 text-[10px] font-semibold text-purple-200/60">
                    {history.length} event{history.length === 1 ? "" : "s"}
                  </span>
                </div>
                {history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-purple-500/25 px-4 py-8 text-center">
                    <Sparkles className="mx-auto mb-2 h-6 w-6 text-purple-300/30" />
                    <p className="text-xs text-purple-200/40">
                      No verification attempts yet — history appears here after their first scan.
                    </p>
                  </div>
                ) : (
                  <ul className="relative" aria-label="Per-student audit timeline">
                    {history.map((log, i) => (
                      <HistoryItem key={log.id} log={log} last={i === history.length - 1} />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {/* close hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-auto flex items-center justify-between border-t border-purple-500/15 px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-purple-200/30"
          >
            <span>OBSIDIAN &apos;26 · Registry</span>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-purple-100"
            >
              close <X className="h-3 w-3" />
            </button>
          </motion.div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SendIcon() {
  return (
    <svg
      className="mr-2 h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}
