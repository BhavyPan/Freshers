"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Hourglass,
  Loader2,
  Search,
  ShieldAlert,
  ScrollText,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, exportUrl } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SCOPES = [
  {
    id: "checkedin" as const,
    title: "Checked In",
    desc: "Everyone who has entered OBSIDIAN '26, with timestamps.",
    icon: BadgeCheck,
    accent: "text-emerald-300",
    border: "border-emerald-400/30",
    statsKey: "checkedIn" as const,
  },
  {
    id: "notarrived" as const,
    title: "Not Arrived",
    desc: "Registered juniors who haven't shown up yet.",
    icon: Hourglass,
    accent: "text-amber-300",
    border: "border-amber-400/30",
    statsKey: "notArrived" as const,
  },
  {
    id: "full" as const,
    title: "Full Attendance",
    desc: "Complete registry with status and check-in times.",
    icon: ScrollText,
    accent: "text-purple-300",
    border: "border-purple-400/30",
    statsKey: "totalRegistered" as const,
  },
];

const RESULT_TONES: Record<string, string> = {
  GRANTED: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  ALREADY_CHECKED_IN: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  DENIED: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  RATE_LIMITED: "border-purple-400/30 bg-purple-500/10 text-purple-200",
  EVENT_CLOSED: "border-amber-400/40 bg-amber-500/10 text-amber-200",
};

function timeFmt(iso: string) {
  try {
    return format(new Date(iso), "dd MMM HH:mm:ss");
  } catch {
    return iso;
  }
}

export function ReportsView() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [result, setResult] = useState("ALL");
  const [page, setPage] = useState(1);

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
    refetchInterval: 15000,
  });

  const auditQuery = useQuery({
    queryKey: ["audit", debouncedQ, result, page],
    queryFn: () => api.audit({ q: debouncedQ, result, page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

  const stats = statsQuery.data?.stats;
  const logs = auditQuery.data?.logs ?? [];
  const totalPages = auditQuery.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* export cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {SCOPES.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cn("obs-card obs-card-hover rounded-2xl border p-5", s.border)}
          >
            <div className="flex items-center justify-between">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl border bg-current/10", s.border, s.accent)}>
                <s.icon className="h-5 w-5" />
              </span>
              <span className="font-display text-3xl font-black tabular-nums text-purple-50">
                {stats ? stats[s.statsKey].toLocaleString() : "…"}
              </span>
            </div>
            <p className="mt-4 text-sm font-bold text-purple-50">{s.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-purple-200/50">{s.desc}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(
                [
                  { format: "csv", icon: FileDown, label: "CSV" },
                  { format: "xlsx", icon: FileSpreadsheet, label: "Excel" },
                  { format: "pdf", icon: FileText, label: "PDF" },
                ] as const
              ).map((f) => (
                <a
                  key={f.format}
                  href={exportUrl(s.id, f.format)}
                  download
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-purple-500/25 bg-[#0b0514]/70 py-2 text-[11px] font-semibold text-purple-100 transition-colors hover:border-purple-400/50 hover:bg-purple-500/15"
                >
                  <f.icon className="h-3.5 w-3.5 text-purple-300" />
                  {f.label}
                </a>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* audit trail */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="obs-card overflow-hidden rounded-2xl"
      >
        <div className="flex flex-col gap-3 border-b border-purple-500/15 bg-purple-500/5 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4.5 w-4.5 text-purple-300" />
            <p className="text-sm font-semibold text-purple-100">Verification Audit Trail</p>
          </div>
          <div className="relative flex-1 sm:ml-4">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-300/50" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search attempts — ID, input, student…"
              className="h-9 rounded-xl border-purple-500/30 bg-[#0b0517]/80 pl-9 text-xs text-purple-50 placeholder:text-purple-200/25 focus:border-purple-400/70"
            />
          </div>
          <Select value={result} onValueChange={(v) => { setResult(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-full rounded-xl border-purple-500/30 bg-[#0b0517]/80 text-xs text-purple-100 sm:w-44">
              <SelectValue placeholder="Result" />
            </SelectTrigger>
            <SelectContent className="border-purple-500/30 bg-[#0e0819] text-purple-100">
              <SelectItem value="ALL">All results</SelectItem>
              <SelectItem value="GRANTED">Granted</SelectItem>
              <SelectItem value="ALREADY_CHECKED_IN">Already checked in</SelectItem>
              <SelectItem value="DENIED">Denied</SelectItem>
              <SelectItem value="RATE_LIMITED">Rate limited</SelectItem>
              <SelectItem value="EVENT_CLOSED">Gate paused/closed</SelectItem>
            </SelectContent>
          </Select>
          <a
            href={exportUrl("audit", "csv")}
            download
            title="Export the full audit trail as CSV"
            className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 bg-[#0b0517]/80 px-3 text-[11px] font-semibold text-purple-100 transition-colors hover:border-purple-400/60 hover:bg-purple-500/15"
          >
            <Download className="h-3.5 w-3.5 text-purple-300" />
            CSV
          </a>
        </div>

        <div className="obs-scrollbar overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-purple-500/15 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200/55">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Raw Input</th>
                <th className="px-5 py-3">Looked-up ID</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Matched Student</th>
              </tr>
            </thead>
            <tbody>
              {auditQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-purple-500/10">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <Skeleton className="h-4 w-full bg-purple-500/10" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-purple-200/40">
                    <ScrollText className="mx-auto mb-3 h-8 w-8 text-purple-300/25" />
                    No verification attempts logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="obs-row-hover border-b border-purple-500/8">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-purple-200/60">
                        <Clock className="h-3 w-3 text-purple-300/40" />
                        {timeFmt(l.createdAt)}
                      </span>
                    </td>
                    <td className="max-w-44 truncate px-5 py-3 font-mono text-xs text-purple-100/80">{l.rawInput}</td>
                    <td className="px-5 py-3 font-mono text-xs text-purple-200/70">{l.lookupId || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", RESULT_TONES[l.result] ?? RESULT_TONES.RATE_LIMITED)}>
                        {l.result.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </td>
                    <td className="max-w-44 truncate px-5 py-3 text-xs text-purple-200/70">
                      {l.studentKey ? <span className="font-mono">{l.studentKey}</span> : <span className="text-purple-200/30">no match</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-purple-500/15 px-5 py-3">
          <p className="text-xs text-purple-200/50">
            {auditQuery.data ? `${(auditQuery.data.page - 1) * auditQuery.data.pageSize + (auditQuery.data.logs.length || 0)} of ${auditQuery.data.total} attempts` : "…"}
            {auditQuery.isFetching && <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-purple-400/60" />}
          </p>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-7 w-7 rounded-lg border-purple-500/30 text-purple-200 disabled:opacity-30">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="font-mono text-xs text-purple-200/70">{page}/{Math.max(totalPages, 1)}</span>
            <Button size="icon" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 w-7 rounded-lg border-purple-500/30 text-purple-200 disabled:opacity-30">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-purple-200/35">
        <Download className="h-3 w-3" />
        Exports are generated server-side and include a generation timestamp. Excel exports open directly in Sheets/Excel.
      </p>
    </div>
  );
}
