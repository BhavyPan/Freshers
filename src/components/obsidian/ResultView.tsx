"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Clock, Compass, HelpCircle, House, Info, PauseCircle, RotateCcw, ShieldAlert, Volume2, VolumeX, XOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { isSoundEnabled, playFeedback, setSoundEnabled } from "@/lib/feedback";
import { useObsidianStore } from "@/lib/client-store";
import { SparkleBurst } from "./SparkleBurst";

function formatTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy, h:mm:ss a");
  } catch {
    return iso;
  }
}

export function ResultView({ onVerifyAnother, onDone }: { onVerifyAnother: () => void; onDone: () => void }) {
  const response = useObsidianStore((s) => s.verifyResponse);
  const lastInput = useObsidianStore((s) => s.lastInput);
  // null = not yet read on client (server renders the enabled icon)
  const [soundOn, setSoundOnState] = useState<boolean | null>(null);
  const soundEnabled = soundOn ?? true;

  useEffect(() => {
    if (!response) return;
    if (response.result === "GRANTED") playFeedback("granted");
    else if (response.result === "ALREADY_CHECKED_IN") playFeedback("already");
    else if (response.result === "DENIED" || response.result === "RATE_LIMITED" || response.result === "EVENT_CLOSED")
      playFeedback("denied");
  }, [response]);

  function toggleSound() {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    setSoundOnState(next);
    if (next) playFeedback("tap");
  }

  if (!response) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-5 text-center">
        <Info className="h-10 w-10 text-purple-300/60" />
        <p className="text-sm text-purple-200/60">No verification result yet.</p>
        <Button onClick={onVerifyAnother} variant="outline" className="border-purple-500/40 text-purple-200 hover:bg-purple-500/10">
          Verify an ID
        </Button>
      </div>
    );
  }

  const granted = response.result === "GRANTED";
  const already = response.result === "ALREADY_CHECKED_IN";
  const denied = response.result === "DENIED";
  const closed = response.result === "EVENT_CLOSED";
  const limited = response.result === "RATE_LIMITED" || response.result === "INVALID";

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-5 py-10">
      {granted && <SparkleBurst />}

      {/* sound toggle */}
      <button
        onClick={toggleSound}
        aria-label={soundEnabled ? "Mute feedback sounds" : "Unmute feedback sounds"}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-purple-500/30 bg-[#0b0517]/80 text-purple-300/80 backdrop-blur-md transition-all hover:border-purple-400/60 hover:text-purple-100"
      >
        {soundEnabled ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5" />}
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`relative w-full max-w-md overflow-hidden rounded-2xl border p-7 sm:p-9 ${
          granted
            ? "border-purple-400/50 bg-gradient-to-b from-[#1b0d38]/95 to-[#0a0514]/95 shadow-[0_0_60px_rgba(147,51,234,0.35)]"
            : already
              ? "border-amber-400/35 bg-gradient-to-b from-[#241505]/95 to-[#0a0514]/95 shadow-[0_0_45px_rgba(245,158,11,0.18)]"
              : closed
                ? "border-amber-400/45 bg-gradient-to-b from-[#1f1605]/95 to-[#0a0514]/95 shadow-[0_0_50px_rgba(245,158,11,0.22)]"
                : "border-rose-500/40 bg-gradient-to-b from-[#2a0a12]/95 to-[#0a0514]/95 shadow-[0_0_45px_rgba(225,29,72,0.22)]"
        }`}
      >
        {/* top glow bar */}
        <div
          className={`absolute inset-x-0 top-0 h-1 ${
            granted ? "bg-gradient-to-r from-transparent via-purple-300 to-transparent" : already || closed ? "bg-gradient-to-r from-transparent via-amber-300 to-transparent" : "bg-gradient-to-r from-transparent via-rose-400 to-transparent"
          }`}
        />

        {/* icon */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.15 }}
            className={`relative flex h-24 w-24 items-center justify-center rounded-full ${
              granted
                ? "border border-purple-300/50 bg-purple-500/15"
                : already || closed
                  ? "border border-amber-300/40 bg-amber-500/10"
                  : "border border-rose-400/40 bg-rose-500/10"
            }`}
          >
            {granted && (
              <>
                <span className="obs-live-dot absolute inset-0 rounded-full" />
                <span className="absolute inset-0 rounded-full border border-purple-300/20" />
              </>
            )}
            {granted ? (
              <BadgeCheck className="h-12 w-12 text-purple-200 drop-shadow-[0_0_14px_rgba(192,132,252,0.9)]" />
            ) : already ? (
              <Clock className="h-11 w-11 text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]" />
            ) : closed ? (
              <PauseCircle className="h-11 w-11 text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]" />
            ) : denied ? (
              <XOctagon className="h-11 w-11 text-rose-300 drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
            ) : (
              <ShieldAlert className="h-11 w-11 text-purple-200/80" />
            )}
          </motion.div>
        </div>

        {/* headline */}
        <h1
          className={`font-display mt-6 text-center text-2xl font-black tracking-wide sm:text-3xl ${
            granted ? "obs-gradient-text obs-text-glow" : already || closed ? "text-amber-200" : denied ? "text-rose-200" : "text-purple-200"
          }`}
        >
          {granted ? "ACCESS GRANTED" : already ? "ALREADY CHECKED IN" : denied ? "ACCESS DENIED" : closed ? "ENTRY PAUSED" : "TRY AGAIN"}
        </h1>
        <p className="mt-2.5 text-center text-sm leading-relaxed text-purple-100/60">{response.message}</p>

        {/* student details */}
        {response.student && (
          <div className="mt-6 rounded-xl border border-purple-500/25 bg-[#0c0618]/80 p-5">
            <div className="flex items-center justify-center gap-2">
              <Compass className="h-3.5 w-3.5 text-purple-300/70" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-purple-300/60">Registered Attendee</span>
            </div>
            <p className="mt-3 text-center text-xl font-bold text-purple-50">{response.student.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg bg-purple-500/8 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-purple-300/50">Student ID</p>
                <p className="mt-1 font-mono text-sm font-semibold text-purple-100">{response.student.studentId}</p>
              </div>
              <div className="rounded-lg bg-purple-500/8 px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-purple-300/50">Department</p>
                <p className="mt-1 text-sm font-semibold text-purple-100">{response.student.department || "—"}</p>
              </div>
              {response.student.year && (
                <div className="col-span-2 rounded-lg bg-purple-500/8 px-3 py-2.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-purple-300/50">Year</p>
                  <p className="mt-1 text-sm font-semibold text-purple-100">{response.student.year}</p>
                </div>
              )}
            </div>
            {(granted || already) && (
              <div className="mt-4 flex items-center justify-center gap-2 border-t border-purple-500/15 pt-4">
                <Clock className="h-3.5 w-3.5 text-purple-300/70" />
                <span className="text-xs text-purple-200/70">
                  {granted ? "Checked in at " : "First entry at "}
                  <span className="font-semibold text-purple-100">{formatTime(response.checkinAt)}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* denial guidance */}
        {denied && (
          <div className="mt-6 rounded-xl border border-rose-500/25 bg-rose-950/20 p-5 text-center">
            <p className="flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-rose-300/80">
              <HelpCircle className="h-3.5 w-3.5" /> Next step
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-rose-100/80">
              Please proceed to the <span className="font-semibold text-rose-100">registration desk</span> at the venue
              entrance with your college ID card to resolve your registration.
            </p>
          </div>
        )}

        {/* token note */}
        {response.tokenValid === false && (
          <p className="mt-4 text-center text-[11px] text-amber-300/60">
            ⚠ Scanned from a forwarded/outdated QR — please use the official venue QR.
          </p>
        )}

        {/* actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={onVerifyAnother}
            className={`h-12 flex-1 rounded-xl font-semibold transition-all ${
              granted
                ? "obs-glow-btn border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 text-white hover:brightness-110"
                : already || closed
                  ? "border border-amber-300/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                  : "border border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
            }`}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Check in Another Student
          </Button>
          <Button
            onClick={onDone}
            variant="outline"
            className="h-12 rounded-xl border-purple-500/30 bg-transparent px-5 text-purple-200/80 hover:bg-purple-500/10 hover:text-purple-100"
          >
            <House className="mr-2 h-4 w-4" />
            Done
          </Button>
        </div>
      </motion.div>

      <p className="mt-6 text-[11px] uppercase tracking-[0.24em] text-purple-200/30">OBSIDIAN &apos;26 · Smart QR Entry</p>
    </div>
  );
}
