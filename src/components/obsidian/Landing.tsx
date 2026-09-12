"use client";

import { Suspense, lazy, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MonitorPlay, ScanLine, ShieldCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ObsidianLogo } from "./ObsidianLogo";
import { CrystalFallback } from "./CrystalFallback";
import { EventStatusBadge } from "./EventStatusBadge";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { use3DSupport } from "./use-3d-support";

const CrystalScene = lazy(() => import("./CrystalScene"));

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 26, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

function insideLabel(pulse: { checkedIn: number; totalRegistered: number } | undefined) {
  if (!pulse || pulse.totalRegistered === 0) return null;
  return { checkedIn: pulse.checkedIn, total: pulse.totalRegistered };
}

export function Landing({ onBegin }: { onBegin: () => void }) {
  const support = use3DSupport();
  const { data: pulse } = useQuery({
    queryKey: ["pulse"],
    queryFn: () => api.pulse(),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    document.title = "OBSIDIAN '26 — Unfold the Unknown";
  }, []);

  const counts = insideLabel(pulse);

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      {/* live organizer announcement */}
      {pulse?.announcement && <AnnouncementBanner text={pulse.announcement} />}

      {/* 3D crystal centerpiece */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <div className="relative h-[78vh] max-h-[720px] w-full opacity-90 sm:h-[86vh]">
          {support === "pending" || support === "none" ? (
            <div className="flex h-full items-center justify-center">
              <CrystalFallback className="h-[46vh] sm:h-[54vh]" />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <CrystalFallback className="h-[46vh] sm:h-[54vh]" />
                </div>
              }
            >
              <CrystalScene reduced={support === "reduced"} />
            </Suspense>
          )}
        </div>
      </div>

      {/* immersive content */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-40 text-center"
      >
        <motion.div variants={item} className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-2.5 rounded-full border border-purple-500/40 bg-purple-950/40 px-4 py-1.5 backdrop-blur-sm">
            <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-purple-200">
              Freshers 2K26
            </span>
          </span>
          {pulse?.status && pulse.status !== "OPEN" && <EventStatusBadge status={pulse.status} />}
        </motion.div>

        <motion.h1
          variants={item}
          className="font-display obs-gradient-text obs-text-glow max-w-[92vw] text-[15vw] leading-[0.95] font-black tracking-tight sm:text-7xl md:text-8xl"
        >
          OBSIDIAN
        </motion.h1>

        <motion.div variants={item} className="obs-divider mt-7 w-56 max-w-[70vw] sm:w-72" />

        <motion.p
          variants={item}
          className="mt-7 text-[13px] font-medium uppercase tracking-[0.52em] text-purple-200/85 sm:text-sm"
        >
          Unfold the Unknown
        </motion.p>

        <motion.p variants={item} className="mt-3 max-w-md text-sm leading-relaxed text-purple-100/55">
          The official smart entry portal. Scan the venue QR, verify your Student ID, and step into the night.
        </motion.p>

        {/* live counter — social proof */}
        {counts && (
          <motion.div
            variants={item}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-purple-500/25 bg-[#0b0517]/70 px-5 py-3 backdrop-blur-md"
            aria-live="polite"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15">
              <Users className="h-4.5 w-4.5 text-emerald-300" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            </span>
            <div className="text-left">
              <p className="font-display text-lg font-black leading-none tabular-nums text-purple-50">
                {counts.checkedIn}
                <span className="text-xs font-semibold text-purple-300/60"> / {counts.total}</span>
              </p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-purple-200/50">
                juniors inside right now
              </p>
            </div>
          </motion.div>
        )}

        <motion.div variants={item} className="mt-8">
          <Button
            onClick={onBegin}
            size="lg"
            disabled={pulse?.status === "CLOSED"}
            className="obs-glow-btn group relative h-14 rounded-full border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 px-9 text-base font-semibold tracking-wide text-white transition-all duration-300 hover:scale-[1.04] hover:border-purple-200/70 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
          >
            <ScanLine className="mr-2.5 h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
            {pulse?.status === "CLOSED" ? "Entry Closed" : pulse?.status === "PAUSED" ? "Entry Paused" : "Begin Entry"}
            <ChevronRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1.5" />
          </Button>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.2em] text-purple-200/45"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-purple-300/70" /> Secure Verification
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-purple-300/70" /> Instant Check-in
          </span>
        </motion.div>
      </motion.div>

      {/* live check-in ticker */}
      {pulse && pulse.recent.length > 0 && (
        <div className="relative z-10 border-t border-purple-500/15 bg-[#06030c]/80 backdrop-blur-md">
          <div className="flex items-center gap-3 px-5 py-2">
            <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">
              <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> live
            </span>
            <div className="relative min-w-0 flex-1 overflow-hidden" aria-hidden="true">
              <div className="obs-ticker flex w-max items-center gap-8">
                {[...pulse.recent, ...pulse.recent].map((r, i) => (
                  <span key={`${r.id}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-[11px] text-purple-200/55">
                    <span className="h-1 w-1 rounded-full bg-purple-400/60" />
                    <span className="font-semibold text-purple-100/80">
                      {r.firstName} {r.lastInitial}
                    </span>
                    {r.department && <span className="text-purple-300/45">{r.department}</span>}
                    <span className="text-emerald-300/60">entered</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* bottom bar */}
      <div className="relative z-10 flex items-center justify-between border-t border-purple-500/15 bg-[#06030c]/70 px-5 py-4 backdrop-blur-md">
        <ObsidianLogo size="sm" />
        <div className="flex items-center gap-2.5">
          <a
            href="#/kiosk"
            title="Fullscreen auto-reset verify loop for the door table"
            className="flex items-center gap-1.5 rounded-full border border-purple-500/25 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-purple-200/70 transition-colors hover:border-purple-400/60 hover:text-purple-100"
          >
            <MonitorPlay className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kiosk Mode</span>
          </a>
          <a
            href="#/admin"
            className="flex items-center gap-1.5 rounded-full border border-purple-500/25 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-purple-200/70 transition-colors hover:border-purple-400/60 hover:text-purple-100"
          >
            Organizer Login
          </a>
        </div>
      </div>
    </div>
  );
}
