"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Flame,
  Grid3X3,
  Hourglass,
  Layers,
  PartyPopper,
  Radar,
  ShieldAlert,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { api } from "@/lib/api-client";
import { playFeedback } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { SparkleBurst } from "./SparkleBurst";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

/** Entry-heatmap intensity ramp — quiet → busy (purple → fuchsia → amber). */
function heatClass(count: number): string {
  if (count <= 0) return "bg-purple-500/[0.06] border-purple-500/10";
  if (count === 1) return "bg-purple-500/30 border-purple-400/25";
  if (count <= 3) return "bg-purple-500/55 border-purple-300/30";
  if (count <= 6) return "bg-fuchsia-500/75 border-fuchsia-300/40 shadow-[0_0_8px_rgba(217,70,239,0.25)]";
  return "bg-amber-400/85 border-amber-300/60 shadow-[0_0_12px_rgba(251,191,36,0.4)]";
}

function EntryHeatmap({ heatmap }: { heatmap: { bucket: string; count: number }[] }) {
  const ROW = 12; // 12 × 15-min = 3 hours per row, 4 rows = 12 hours
  const rows: { bucket: string; count: number }[][] = [];
  for (let i = 0; i < heatmap.length; i += ROW) rows.push(heatmap.slice(i, i + ROW));
  const max = Math.max(1, ...heatmap.map((h) => h.count));
  return (
    <div>
      <div className="space-y-1.5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-center gap-1.5">
            <span className="w-14 shrink-0 text-right font-mono text-[9px] uppercase tracking-wide text-purple-200/40">
              {format(new Date(row[0].bucket), "h a")}
            </span>
            <div className="grid flex-1 grid-cols-12 gap-1.5">
              {row.map((cell, ci) => {
                const isNow = ri === rows.length - 1 && ci === row.length - 1;
                return (
                  <div
                    key={cell.bucket}
                    title={`${format(new Date(cell.bucket), "h:mm a")} — ${cell.count} ${cell.count === 1 ? "entry" : "entries"}`}
                    className={cn(
                      "h-6 rounded-[5px] border transition-transform hover:scale-110 hover:z-10",
                      heatClass(cell.count),
                      isNow && "ring-2 ring-purple-300/80 ring-offset-1 ring-offset-[#0e0819]"
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-purple-200/40">
          Each square = 15 minutes · latest square ringed · busiest {max} in a quarter hour
        </p>
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="text-[9px] uppercase tracking-[0.14em] text-purple-200/45">quiet</span>
          {[0, 1, 3, 6, 9].map((c) => (
            <span key={c} className={cn("h-3 w-3 rounded-[3px] border", heatClass(c))} />
          ))}
          <span className="text-[9px] uppercase tracking-[0.14em] text-purple-200/45">busy</span>
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number | string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={String(value)}
        initial={{ opacity: 0, y: -10, filter: "blur(3px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 10, filter: "blur(3px)" }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block tabular-nums"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

function DeptGoals({ depts }: { depts: { dept: string; total: number; checkedIn: number }[] }) {
  const rows = depts.filter((d) => d.total > 0);
  const completeCount = rows.filter((d) => d.checkedIn >= d.total).length;
  return (
    <div>
      <div className="obs-scrollbar max-h-96 space-y-3.5 overflow-y-auto pr-1">
        {rows.map((d) => {
          const pct = Math.min(100, Math.round((d.checkedIn / d.total) * 100));
          const done = d.checkedIn >= d.total;
          return (
            <div key={d.dept} className="group">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-purple-100">
                  <span className="truncate">{d.dept}</span>
                  {done && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]" aria-label="Goal complete" />}
                </p>
                <p className="shrink-0 font-mono text-[10px] tabular-nums text-purple-200/55">
                  {d.checkedIn}/{d.total}
                  <span className={cn("ml-2 font-bold", done ? "text-emerald-300" : pct >= 50 ? "text-fuchsia-300" : "text-purple-200/70")}>
                    {pct}%
                  </span>
                </p>
              </div>
              <div
                className={cn(
                  "relative h-2.5 overflow-hidden rounded-full border",
                  done
                    ? "border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_14px_rgba(52,211,153,0.25)]"
                    : "border-purple-500/25 bg-[#0b0517]"
                )}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${d.dept}: ${d.checkedIn} of ${d.total} checked in`}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "relative h-full rounded-full",
                    done
                      ? "bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300"
                      : "obs-goal-shimmer bg-gradient-to-r from-violet-800 via-purple-500 to-fuchsia-400"
                  )}
                >
                  {!done && pct > 0 && (
                    <span className="absolute right-0 top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-purple-200 shadow-[0_0_8px_rgba(216,180,254,0.9)]" />
                  )}
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-purple-200/40">
        Goal: every registered junior inside · {completeCount}/{rows.length} departments complete
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  delay,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent: "purple" | "green" | "amber" | "red";
  delay: number;
  trend?: { text: string; tone: "up" | "flat" } | null;
}) {
  const accents = {
    purple: "border-purple-400/40 text-purple-200 from-purple-600/25 bg-purple-500/10",
    green: "border-emerald-400/35 text-emerald-200 from-emerald-600/20 bg-emerald-500/8",
    amber: "border-amber-400/35 text-amber-200 from-amber-600/20 bg-amber-500/8",
    red: "border-rose-400/40 text-rose-200 from-rose-600/20 bg-rose-500/8",
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className={cn("obs-card-hover relative overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(147,51,234,0.18)]", accents.split(" ")[0], accents.split(" ")[2], accents.split(" ")[3])}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-current opacity-[0.06] blur-2xl" />
      <div className="flex items-center justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg border bg-current/10", accents.split(" ")[0])}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]",
              trend.tone === "up"
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-purple-500/25 bg-purple-500/8 text-purple-200/60"
            )}
            title="Entries in the last 60 minutes"
          >
            <TrendingUp className={cn("h-3 w-3", trend.tone === "flat" && "opacity-50")} />
            {trend.text}
          </span>
        )}
      </div>
      <p className="font-display mt-4 text-3xl font-black text-purple-50">
        <AnimatedNumber value={value} />
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-200/60">{label}</p>
    </motion.div>
  );
}

export function DashboardView() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.stats(),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });

  const stats = data?.stats;
  const recent = data?.recent ?? [];

  // ---- department goal celebrations (confetti on a dept hitting 100%) ----
  const [goalBurst, setGoalBurst] = useState<string | null>(null);
  const doneDeptsRef = useRef<Set<string> | null>(null);
  const deptKey = JSON.stringify(stats?.studentsByDept ?? []);

  useEffect(() => {
    const depts = JSON.parse(deptKey) as { dept: string; total: number; checkedIn: number }[];
    if (depts.length === 0) return;
    // first run: hydrate the already-complete set from localStorage (no celebration)
    if (doneDeptsRef.current === null) {
      let stored: unknown = [];
      try {
        stored = JSON.parse(window.localStorage.getItem("obs-goals-done") ?? "[]");
      } catch {
        stored = [];
      }
      doneDeptsRef.current = new Set(
        Array.isArray(stored) ? stored.filter((s): s is string => typeof s === "string") : []
      );
    }
    const complete = depts.filter((d) => d.total > 0 && d.checkedIn >= d.total).map((d) => d.dept);
    const fresh = complete.find((d) => !doneDeptsRef.current!.has(d));
    if (!fresh) return;
    for (const d of complete) doneDeptsRef.current!.add(d);
    try {
      window.localStorage.setItem("obs-goals-done", JSON.stringify([...doneDeptsRef.current]));
    } catch {
      /* private mode — celebration still fires, just not persisted */
    }
    setGoalBurst(fresh);
    playFeedback("granted");
    toast({
      title: `${fresh} squad is all in! 🎉`,
      description: `Every registered ${fresh} junior has checked in — goal complete.`,
    });
    const t = setTimeout(() => setGoalBurst(null), 2600);
    return () => clearTimeout(t);
  }, [deptKey, toast]);

  const timelineData = (stats?.timeline ?? []).map((t) => ({
    time: format(new Date(t.bucket), "HH:mm"),
    count: t.count,
  }));

  const deptData = (stats?.studentsByDept ?? []).slice(0, 8).map((d) => ({
    dept: d.dept,
    total: d.total,
    checkedIn: d.checkedIn,
  }));

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl bg-purple-500/10" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl bg-purple-500/10" />
        <Skeleton className="h-64 rounded-2xl bg-purple-500/10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* goal celebration overlay */}
      <AnimatePresence>
        {goalBurst && (
          <motion.div
            key={goalBurst}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
            aria-live="polite"
          >
            <SparkleBurst count={34} />
            <motion.div
              initial={{ scale: 0.6, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: -18, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-[#140b26]/95 px-6 py-4 shadow-[0_0_60px_rgba(251,191,36,0.35)]"
            >
              <PartyPopper className="h-7 w-7 text-amber-300" />
              <div>
                <p className="font-display text-lg font-black text-amber-100">{goalBurst} squad is ALL IN!</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-purple-200/60">100% checked in · goal complete</p>
              </div>
              <Trophy className="h-6 w-6 text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.9)]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard icon={Layers} label="Total Registered" value={stats.totalRegistered} accent="purple" delay={0} />
        <KpiCard
          icon={BadgeCheck}
          label="Checked In"
          value={stats.checkedIn}
          accent="green"
          delay={0.08}
          trend={{ text: `+${stats.checkedInLastHour} / 1h`, tone: stats.checkedInLastHour > 0 ? "up" : "flat" }}
        />
        <KpiCard icon={Hourglass} label="Not Arrived" value={stats.notArrived} accent="amber" delay={0.16} />
        <KpiCard icon={ShieldAlert} label="Denied / Invalid" value={stats.deniedAttempts} accent="red" delay={0.24} />
      </div>

      {/* check-in progress */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="obs-card rounded-2xl p-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Radar className="h-4 w-4 text-purple-300" />
            <p className="text-sm font-semibold text-purple-100">Venue Fill Rate</p>
          </div>
          <p className="text-xs text-purple-200/60">
            <span className="font-display text-lg font-bold text-purple-100">{stats.checkinRate}%</span>{" "}
            of registered juniors inside
          </p>
        </div>
        <div className="relative mt-4 h-3 overflow-hidden rounded-full border border-purple-500/25 bg-[#0b0517]">
          {/* milestone ticks */}
          {[25, 50, 75].map((m) => (
            <span
              key={m}
              aria-hidden
              className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-purple-300/25"
              style={{ left: `${m}%` }}
            />
          ))}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(stats.checkinRate, 100)}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-full rounded-full bg-gradient-to-r from-violet-800 via-purple-500 to-fuchsia-400"
          >
            <span className="absolute right-0 top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-purple-200 shadow-[0_0_10px_rgba(216,180,254,1)]" />
          </motion.div>
        </div>
        <p className="mt-3 text-[11px] text-purple-200/45">
          {stats.checkedIn} in · {stats.notArrived} pending
          {stats.lastCheckinAt && <> · last check-in {timeAgo(stats.lastCheckinAt)}</>}
        </p>
        {stats.busiestWindow && stats.busiestWindow.count > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/8 px-3 py-2">
            <Flame className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <p className="text-[11px] text-purple-200/70">
              Peak entry window: <span className="font-semibold text-purple-100">{format(new Date(stats.busiestWindow.startsAt), "h:mm a")}</span>
              {" "}— <span className="font-semibold tabular-nums text-amber-200">{stats.busiestWindow.count}</span> in 15 min
            </p>
          </div>
        )}
      </motion.div>

      {/* entry heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="obs-card rounded-2xl p-5"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Grid3X3 className="h-4 w-4 text-purple-300" />
          <p className="text-sm font-semibold text-purple-100">Entry Heatmap — last 12 hours</p>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-purple-200/50">
            <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" /> live
          </span>
        </div>
        <EntryHeatmap heatmap={stats.heatmap} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* timeline chart */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="obs-card rounded-2xl p-5 lg:col-span-3"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <Activity className="h-4 w-4 text-purple-300" />
            <p className="text-sm font-semibold text-purple-100">Check-in Flow — last 6 hours</p>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-purple-200/50">
              <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" /> live
            </span>
          </div>
          <div className="h-60">
            {timelineData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-purple-200/40">
                Check-ins will appear here once students start arriving.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tl-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(147,88,220,0.12)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#9483bd", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(147,88,220,0.25)" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#9483bd", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0e0819",
                      border: "1px solid rgba(147,88,220,0.4)",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#ece7fb",
                    }}
                    labelStyle={{ color: "#c084fc" }}
                  />
                  <Area type="monotone" dataKey="count" name="check-ins" stroke="#c084fc" strokeWidth={2} fill="url(#tl-fill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* dept chart */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="obs-card rounded-2xl p-5 lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-purple-300" />
            <p className="text-sm font-semibold text-purple-100">Department Split</p>
          </div>
          <div className="h-60">
            {deptData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-purple-200/40">No departments yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke="rgba(147,88,220,0.12)" vertical={false} />
                  <XAxis dataKey="dept" tick={{ fill: "#9483bd", fontSize: 10 }} axisLine={{ stroke: "rgba(147,88,220,0.25)" }} tickLine={false} interval={0} angle={-30} textAnchor="end" height={44} />
                  <YAxis allowDecimals={false} tick={{ fill: "#9483bd", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(147,88,220,0.08)" }}
                    contentStyle={{
                      background: "#0e0819",
                      border: "1px solid rgba(147,88,220,0.4)",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#ece7fb",
                    }}
                  />
                  <Bar dataKey="total" name="registered" fill="#2a1a4a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="checkedIn" name="checked in" radius={[4, 4, 0, 0]}>
                    {deptData.map((_, i) => (
                      <Cell key={i} fill="#a855f7" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>

      {/* department goals — race to 100% */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="obs-card rounded-2xl p-5"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Target className="h-4 w-4 text-amber-300" />
          <p className="text-sm font-semibold text-purple-100">Department Goals — race to 100%</p>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-purple-200/50">
            <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-amber-400" /> live
          </span>
        </div>
        <DeptGoals depts={stats.studentsByDept} />
      </motion.div>

      {/* recent check-ins */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="obs-card rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <UserCheck className="h-4 w-4 text-purple-300" />
          <p className="text-sm font-semibold text-purple-100">Recent Check-ins</p>
          <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-purple-200/50">
            <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" /> live
          </span>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-purple-200/40">
            <Hourglass className="h-8 w-8 text-purple-300/30" />
            Waiting for the first junior to unfold the unknown…
          </div>
        ) : (
          <ul className="obs-scrollbar max-h-96 space-y-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {recent.map((r) => (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: -10, backgroundColor: "rgba(168,85,247,0.22)" }}
                  animate={{ opacity: 1, y: 0, backgroundColor: "rgba(168,85,247,0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-center gap-3 rounded-xl border border-purple-500/15 bg-[#0b0616]/70 px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/30 to-violet-800/30 text-[11px] font-bold text-purple-200">
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-purple-50">{r.name}</p>
                    <p className="font-mono text-[11px] text-purple-300/60">{r.studentId}{r.department ? ` · ${r.department}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="whitespace-nowrap text-[11px] text-purple-200/70">{timeAgo(r.checkinAt)}</p>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-emerald-300/70">entered</p>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </motion.div>
    </div>
  );
}
