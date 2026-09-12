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
  Gauge,
  Hourglass,
  IdCard,
  Loader2,
  Printer,
  Search,
  ShieldAlert,
  ScrollText,
  Trophy,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, exportUrl, passSheetsUrl } from "@/lib/api-client";
import type { ActivityResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Client-side CSV of the current operator standings — instant, no server round-trip. */
function downloadLeaderboardCsv(board: ActivityResponse["leaderboard"]) {
  const cell = (v: string | number | null) => {
    const s = String(v ?? "");
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: string[] = [
    ["Rank", "Operator", "Username", "Role", "Entries Attributed", "Recent Grants (24h)", "Score", "Last Activity"].map(cell).join(","),
    ...board.map((op, i) =>
      [
        i + 1,
        op.displayName || op.actor,
        op.actor,
        (op.role ?? "staff").toLowerCase(),
        op.entries,
        op.grants24h,
        op.entries + op.grants24h,
        op.lastAt ? format(new Date(op.lastAt), "dd MMM yyyy HH:mm:ss") : "",
      ]
        .map(cell)
        .join(",")
    ),
    "",
    ["Generated", format(new Date(), "dd MMM yyyy HH:mm:ss")].map(cell).join(","),
    ["Event", "OBSIDIAN '26 — Freshers 2K26"].map(cell).join(","),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `obsidian26-desk-leaderboard-${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

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
  LOOKUP_FOUND: "border-teal-400/30 bg-teal-500/10 text-teal-300",
  LOOKUP_NONE: "border-slate-400/30 bg-slate-500/10 text-slate-300",
};

function timeFmt(iso: string) {
  try {
    return format(new Date(iso), "dd MMM HH:mm:ss");
  } catch {
    return iso;
  }
}

type PassScope = "notarrived" | "checkedin" | "full";

const PASS_SCOPES: { id: PassScope; label: string }[] = [
  { id: "notarrived", label: "Not arrived" },
  { id: "checkedin", label: "Checked in" },
  { id: "full", label: "Full registry" },
];

export function ReportsView() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [result, setResult] = useState("ALL");
  const [page, setPage] = useState(1);
  const [passScope, setPassScope] = useState<PassScope>("notarrived");

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

  const activityQuery = useQuery({
    queryKey: ["activity"],
    queryFn: () => api.activity(24),
    refetchInterval: 15000,
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

      {/* pass sheets — printable invite QR grid */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="obs-card obs-card-hover rounded-2xl border border-fuchsia-400/20 p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300">
            <IdCard className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-purple-50">Pass Sheets — printable invite QR cards</p>
            <p className="mt-1 text-[11px] leading-relaxed text-purple-200/50">
              An A4 grid with each junior&apos;s personal invite QR, name and ID — 10 passes per sheet. Print,
              cut along the grid, and slip them into welcome kits or hand them out at the gate.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Select value={passScope} onValueChange={(v) => setPassScope(v as PassScope)}>
              <SelectTrigger className="h-9 w-40 rounded-xl border-purple-500/30 bg-[#0b0517]/80 text-xs text-purple-100">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent className="border-purple-500/30 bg-[#0e0819] text-purple-100">
                {PASS_SCOPES.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <a
              href={passSheetsUrl(passScope)}
              download
              className="obs-glow-btn flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 px-4 text-xs font-bold text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              Download PDF
            </a>
          </div>
        </div>
      </motion.div>

      {/* desk leaderboard — operator standings */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="obs-card obs-card-hover rounded-2xl border border-amber-400/15 p-5"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Trophy className="h-4 w-4 text-amber-300" />
          <p className="text-sm font-semibold text-purple-100">Desk Leaderboard — operator standings</p>
          {!activityQuery.isLoading && (activityQuery.data?.leaderboard.length ?? 0) > 0 && (
            <button
              onClick={() => downloadLeaderboardCsv(activityQuery.data!.leaderboard)}
              title="Download the standings as CSV"
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200 transition-all hover:border-amber-300/60 hover:bg-amber-500/20 hover:shadow-[0_0_14px_rgba(251,191,36,0.2)]"
            >
              <Download className="h-3 w-3" />
              csv
            </button>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-purple-200/50">
            <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-amber-400" /> live · all event
          </span>
        </div>
        {activityQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl bg-purple-500/10" />
            ))}
          </div>
        ) : !activityQuery.data || activityQuery.data.leaderboard.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-purple-200/40">
            <Trophy className="h-7 w-7 text-purple-300/25" />
            No operator entries yet — the board lights up with the first desk check-in.
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {activityQuery.data.leaderboard.map((op, i) => {
              const top = activityQuery.data?.leaderboard[0];
              const topScore = Math.max((top?.entries ?? 0) + (top?.grants24h ?? 0), 1);
              const score = op.entries + op.grants24h;
              const pct = Math.max(6, Math.round((score / topScore) * 100));
              const medal =
                i === 0
                  ? "bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600 text-amber-950 shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                  : i === 1
                    ? "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 text-slate-900"
                    : i === 2
                      ? "bg-gradient-to-br from-orange-200 via-orange-400 to-orange-700 text-orange-950"
                      : "border border-purple-500/30 bg-purple-500/10 text-purple-200";
              const isAdmin = op.role === "ADMIN";
              return (
                <div
                  key={op.actor}
                  className="obs-row-hover flex min-w-0 items-center gap-3 rounded-xl border border-amber-400/10 bg-[#0b0616]/70 px-3.5 py-2.5"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black tabular-nums",
                      medal
                    )}
                    title={`Rank #${i + 1}`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-14 truncate text-sm font-semibold text-purple-50" title={op.displayName || op.actor}>
                        {op.displayName || op.actor}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
                          isAdmin
                            ? "border-purple-400/30 bg-purple-500/10 text-purple-300"
                            : "border-teal-400/30 bg-teal-500/10 text-teal-300"
                        )}
                      >
                        {op.role?.toLowerCase() ?? "staff"}
                      </span>
                      {op.grants24h > 0 && (
                        <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                          +{op.grants24h} recent
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-500/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-400 to-yellow-300"
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-black tabular-nums text-amber-100">{score}</p>
                    <p className="max-w-28 truncate text-[9px] uppercase tracking-[0.12em] text-purple-200/45" title={`${op.entries} entries${op.lastAt ? ` · last ${format(new Date(op.lastAt), "HH:mm")}` : ""}`}>
                      {op.entries} entr{op.entries === 1 ? "y" : "ies"}
                      {op.lastAt ? ` · ${format(new Date(op.lastAt), "HH:mm")}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* desk activity attribution */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
        className="obs-card rounded-2xl p-5"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Users className="h-4 w-4 text-purple-300" />
          <p className="text-sm font-semibold text-purple-100">Desk Activity — who checked juniors in</p>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-purple-200/50">
            <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" /> live · 24 h window
          </span>
        </div>
        {activityQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl bg-purple-500/10" />
            ))}
          </div>
        ) : !activityQuery.data || activityQuery.data.desks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-purple-200/40">
            <Gauge className="h-8 w-8 text-purple-300/25" />
            No check-ins yet — desk attribution appears with the first entry.
          </div>
        ) : (
          <div className="space-y-2">
            {activityQuery.data.desks.map((d, i) => {
              const max = activityQuery.data?.desks[0]?.entries ?? 1;
              const pct = Math.max(4, Math.round((d.entries / Math.max(max, 1)) * 100));
              const isSelf = d.actor === "SELF";
              return (
                <div
                  key={d.actor}
                  className="obs-row-hover flex items-center gap-3 rounded-xl border border-purple-500/15 bg-[#0b0616]/70 px-4 py-2.5"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      isSelf
                        ? "bg-gradient-to-br from-emerald-500/30 to-teal-800/30 text-emerald-200"
                        : "bg-gradient-to-br from-purple-500/30 to-violet-800/30 text-purple-200"
                    )}
                  >
                    {isSelf ? "≡" : d.actor.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-purple-50">{d.label}</p>
                      {isSelf && (
                        <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                          self scan
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-purple-500/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          "h-full rounded-full",
                          isSelf
                            ? "bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400"
                            : "bg-gradient-to-r from-violet-800 via-purple-500 to-fuchsia-400"
                        )}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-black tabular-nums text-purple-50">{d.entries}</p>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-purple-200/45">
                      {d.entries === 1 ? "entry" : "entries"}
                      {d.lastAt ? ` · ${format(new Date(d.lastAt), "HH:mm")}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
            {activityQuery.data.manualActions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-200/45">
                  Manual actions (24 h):
                </span>
                {activityQuery.data.manualActions.map((m) => (
                  <span
                    key={m.actor}
                    className="flex items-center gap-1.5 rounded-full border border-purple-500/25 bg-purple-500/8 px-2.5 py-1 text-[10px] text-purple-200/80"
                  >
                    <span className="font-bold text-purple-100">{m.actor}</span>
                    {m.checkins > 0 && <span className="text-emerald-300">+{m.checkins} in</span>}
                    {m.reversals > 0 && <span className="text-amber-300">{m.reversals} undo</span>}
                    {m.edits > 0 && <span className="text-purple-300">{m.edits} edit</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

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
              <SelectItem value="LOOKUPS">ID lookups (any)</SelectItem>
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
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-purple-500/15 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-purple-200/55">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Raw Input</th>
                <th className="px-5 py-3">Looked-up ID</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">By</th>
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
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-purple-200/40">
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
                    <td className="px-5 py-3">
                      {l.actor ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                          {l.actor}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.12em] text-purple-200/30">self</span>
                      )}
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
