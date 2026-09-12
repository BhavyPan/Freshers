"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Flame,
  Hourglass,
  Layers,
  Radar,
  ShieldAlert,
  TrendingUp,
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
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
      className={cn("obs-card-hover relative overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent p-5", accents.split(" ")[0], accents.split(" ")[2], accents.split(" ")[3])}
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
      <p className="font-display mt-4 text-3xl font-black tabular-nums text-purple-50">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-200/60">{label}</p>
    </motion.div>
  );
}

export function DashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.stats(),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });

  const stats = data?.stats;
  const recent = data?.recent ?? [];

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
        <div className="mt-4 h-3 overflow-hidden rounded-full border border-purple-500/25 bg-[#0b0517]">
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
