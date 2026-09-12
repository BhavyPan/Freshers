"use client";

/**
 * Entry-desk KIOSK MODE — a distraction-free, fullscreen, auto-resetting
 * verify loop built for the door table.
 *
 * - Giant typography readable from across the desk
 * - Plays nice with USB QR/barcode scanners (keyboard-wedge: they "type" + Enter)
 * - Auto-resets to the idle prompt after a configurable countdown
 * - Any keystroke or tap instantly resets, so the next junior can scan
 * - Ambient wash + chime per outcome (granted / already / denied / paused)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  BadgeMinus,
  Expand,
  Hourglass,
  Maximize2,
  Minimize2,
  MonitorPlay,
  ScanLine,
  ShieldX,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { isSoundEnabled, playFeedback, primeAudio, setSoundEnabled } from "@/lib/feedback";
import { readEventToken } from "@/lib/client-store";
import type { VerifyResponse } from "@/lib/types";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { EventStatusBadge } from "./EventStatusBadge";
import { ObsidianLogo } from "./ObsidianLogo";
import { cn } from "@/lib/utils";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9\-\/_.]{2,39}$/;
const RESET_KEY = "obsidian.kiosk.autoreset";
const RESET_OPTIONS = [3, 5, 8, 0] as const; // seconds, 0 = manual
const ATTRACT_AFTER = 60; // seconds idle before the attract loop kicks in

// deterministic spark field for the attract overlay (hydration-safe)
const ATTRACT_SPARKS = [
  { left: "12%", size: 3, dur: 11, delay: 0 },
  { left: "24%", size: 2, dur: 14, delay: 2.5 },
  { left: "38%", size: 4, dur: 9, delay: 5 },
  { left: "52%", size: 2, dur: 13, delay: 1.2 },
  { left: "63%", size: 3, dur: 10, delay: 4 },
  { left: "74%", size: 2, dur: 15, delay: 6.5 },
  { left: "86%", size: 3, dur: 12, delay: 3.2 },
  { left: "94%", size: 2, dur: 10, delay: 7.5 },
] as const;

const ATTRACT_HINTS = [
  "Scan the QR on your college ID",
  "Type your Student ID to walk in",
  "Doors are open — step into the night",
  "One scan · one chime · you're in",
] as const;

type Outcome = {
  key: string;
  resp: VerifyResponse;
  at: Date;
};

function outcomeTheme(resp: VerifyResponse) {
  switch (resp.result) {
    case "GRANTED":
      return {
        word: "ACCESS GRANTED",
        sub: resp.message,
        name: resp.student?.name,
        glow: "rgba(52,211,153,",
        text: "text-emerald-300",
        chip: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
        Icon: BadgeCheck,
      };
    case "ALREADY_CHECKED_IN":
      return {
        word: "ALREADY INSIDE",
        sub: resp.message,
        name: resp.student?.name,
        glow: "rgba(251,191,36,",
        text: "text-amber-300",
        chip: "border-amber-400/50 bg-amber-500/15 text-amber-200",
        Icon: BadgeMinus,
      };
    case "EVENT_CLOSED":
      return {
        word: "ENTRY PAUSED",
        sub: resp.message,
        name: undefined,
        glow: "rgba(251,191,36,",
        text: "text-amber-300",
        chip: "border-amber-400/50 bg-amber-500/15 text-amber-200",
        Icon: Hourglass,
      };
    default:
      return {
        word: "ACCESS DENIED",
        sub: resp.message,
        name: undefined,
        glow: "rgba(244,63,94,",
        text: "text-rose-300",
        chip: "border-rose-400/50 bg-rose-500/15 text-rose-200",
        Icon: resp.result === "RATE_LIMITED" ? Timer : ShieldX,
      };
  }
}

function outcomeSound(resp: VerifyResponse): "granted" | "already" | "denied" {
  if (resp.result === "GRANTED") return "granted";
  if (resp.result === "ALREADY_CHECKED_IN" || resp.result === "EVENT_CLOSED") return "already";
  return "denied";
}

export function KioskView({ onExit }: { onExit: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resetSecs, setResetSecs] = useState<number>(5);
  const [soundOn, setSoundOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [activity, setActivity] = useState<Outcome[]>([]);
  const [idleSecs, setIdleSecs] = useState(0);
  const [hintIdx, setHintIdx] = useState(0);

  const { data: pulse } = useQuery({
    queryKey: ["pulse"],
    queryFn: () => api.pulse(),
    refetchInterval: 6000,
    refetchIntervalInBackground: false,
  });

  // hydrate persisted prefs + clock (hydration-safe)
  useEffect(() => {
    const stored = window.localStorage.getItem(RESET_KEY);
    const n = stored === null ? NaN : Number(stored);
    setResetSecs(
      RESET_OPTIONS.includes(n as (typeof RESET_OPTIONS)[number]) ? (n as number) : 5
    );
    setSoundOn(isSoundEnabled());
    const tick = () => setClock(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  // keep the hidden worker input laser-focused for scanner wedges
  const refocus = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }, []);

  // ---- attract mode: idle detection ----------------------------------------
  const attract = idleSecs >= ATTRACT_AFTER && !outcome && !verifying;

  useEffect(() => {
    const bump = () => setIdleSecs(0);
    window.addEventListener("keydown", bump);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("pointermove", bump);
    const id = window.setInterval(() => setIdleSecs((s) => s + 1), 1000);
    return () => {
      window.removeEventListener("keydown", bump);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("pointermove", bump);
      window.clearInterval(id);
    };
  }, []);

  // any outcome / verifying activity also counts as engagement
  useEffect(() => {
    if (outcome || verifying) setIdleSecs(0);
  }, [outcome, verifying]);

  // rotate the attract hint line
  useEffect(() => {
    if (!attract) return;
    const id = window.setInterval(
      () => setHintIdx((i) => (i + 1) % ATTRACT_HINTS.length),
      3200
    );
    return () => window.clearInterval(id);
  }, [attract]);

  useEffect(() => {
    refocus();
    const unlock = () => primeAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [refocus]);

  function persistReset(secs: number) {
    setResetSecs(secs);
    try {
      window.localStorage.setItem(RESET_KEY, String(secs));
    } catch {
      /* ignore */
    }
  }

  const reset = useCallback(
    (opts?: { keepValue?: boolean }) => {
      setOutcome(null);
      setCountdown(null);
      if (!opts?.keepValue) setValue("");
      playFeedback("tap");
      refocus();
    },
    [refocus]
  );

  async function submit(raw: string) {
    const trimmed = raw.trim();
    if (verifying) return;
    if (!trimmed || !ID_RE.test(trimmed)) {
      playFeedback("tap");
      return;
    }
    setVerifying(true);
    playFeedback("tap");
    try {
      const resp = (await api.verify(trimmed, readEventToken())) as VerifyResponse;
      const entry: Outcome = { key: `${trimmed}-${Date.now()}`, resp, at: new Date() };
      setOutcome(entry);
      setActivity((a) => [entry, ...a].slice(0, 7));
      playFeedback(outcomeSound(resp));
      if (resetSecs > 0) setCountdown(resetSecs);
    } catch {
      // network/rate-limit — show a denial-style flash, auto-reset stays manual-ish
      setOutcome({
        key: `err-${Date.now()}`,
        resp: { ok: false, result: "RATE_LIMITED", message: "Connection hiccup — try again." },
        at: new Date(),
      });
      playFeedback("denied");
      if (resetSecs > 0) setCountdown(Math.min(resetSecs, 3));
    } finally {
      setVerifying(false);
      setValue("");
      refocus();
    }
  }

  // auto-reset countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      reset();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, reset]);

  // scanner-friendly: any printable keystroke while an outcome is showing resets it
  function onGlobalKeyDown(e: React.KeyboardEvent) {
    if (!outcome) return;
    if (e.key === "Enter") {
      e.preventDefault();
      reset();
      return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      reset();
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* unsupported — ignore */
    }
  }

  function cycleReset() {
    const idx = RESET_OPTIONS.indexOf(resetSecs as (typeof RESET_OPTIONS)[number]);
    persistReset(RESET_OPTIONS[(idx + 1) % RESET_OPTIONS.length]);
  }

  const theme = outcome ? outcomeTheme(outcome.resp) : null;

  return (
    <div
      className="relative flex min-h-svh flex-col overflow-hidden"
      onKeyDown={onGlobalKeyDown}
      onClick={() => {
        if (outcome) reset();
        else refocus();
      }}
    >
      {/* ambient outcome wash */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          theme ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className="absolute inset-0"
          style={
            theme
              ? {
                  background: `radial-gradient(ellipse 80% 65% at 50% 42%, ${theme.glow}0.16), transparent 70%)`,
                  boxShadow: `inset 0 0 180px ${theme.glow}0.14)`,
                }
              : undefined
          }
        />
      </div>

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <ObsidianLogo size="sm" />
          <span className="hidden items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.22em] text-purple-200/80 sm:flex">
            <MonitorPlay className="h-3 w-3" /> kiosk
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {pulse?.status && pulse.status !== "OPEN" && <EventStatusBadge status={pulse.status} />}
          {pulse && (
            <span className="hidden rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold tabular-nums text-emerald-300 sm:inline-block">
              {pulse.checkedIn}/{pulse.totalRegistered} in
            </span>
          )}
          <span className="hidden font-mono text-sm tabular-nums text-purple-200/70 md:inline">
            {clock ? clock.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              if (next) playFeedback("tap");
            }}
            aria-label={soundOn ? "Mute sounds" : "Unmute sounds"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/30 text-purple-200/70 transition-colors hover:border-purple-400/60 hover:text-purple-100"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void toggleFullscreen();
            }}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/30 text-purple-200/70 transition-colors hover:border-purple-400/60 hover:text-purple-100"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              cycleReset();
            }}
            title="Auto-reset delay"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-purple-500/30 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200/70 transition-colors hover:border-purple-400/60 hover:text-purple-100"
          >
            <Expand className="h-3.5 w-3.5" />
            {resetSecs === 0 ? "manual" : `${resetSecs}s`}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (document.fullscreenElement) void document.exitFullscreen();
              onExit();
            }}
            className="rounded-xl border border-purple-500/30 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-purple-200/70 transition-colors hover:border-rose-400/50 hover:text-rose-200"
          >
            exit
          </button>
        </div>
      </header>

      {/* announcement */}
      {pulse?.announcement && (
        <div className="relative z-10 mx-5 sm:mx-auto sm:w-full sm:max-w-3xl">
          <AnnouncementBanner text={pulse.announcement} compact />
        </div>
      )}

      {/* center stage */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
        <AnimatePresence mode="wait">
          {verifying ? (
            <motion.div
              key="verifying"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative flex h-28 w-28 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-purple-500/20" />
                <span className="absolute inset-2 animate-pulse rounded-full bg-purple-500/25" />
                <ScanLine className="relative h-12 w-12 text-purple-300" />
              </div>
              <p className="font-display text-2xl font-bold tracking-wide text-purple-100">VERIFYING…</p>
              <p className="font-mono text-sm tracking-[0.3em] text-purple-300/60">{value || "···"}</p>
            </motion.div>
          ) : theme ? (
            <motion.div
              key={outcome!.key}
              initial={{ opacity: 0, scale: 0.9, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="flex flex-col items-center gap-5"
            >
              <theme.Icon className={cn("h-16 w-16 sm:h-20 sm:w-20", theme.text)} strokeWidth={1.6} />
              <h1
                className={cn(
                  "font-display obs-text-glow text-[9.5vw] font-black leading-none tracking-tight sm:text-6xl md:text-7xl",
                  theme.text
                )}
              >
                {theme.word}
              </h1>
              {theme.name && (
                <div className={cn("obs-card mt-2 flex items-center gap-3 rounded-2xl px-7 py-4")}>
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-black", theme.chip)}>
                    {theme.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="text-left">
                    <p className="font-display text-xl font-bold text-purple-50">{theme.name}</p>
                    <p className="text-xs text-purple-200/60">
                      {outcome!.resp.student?.studentId}
                      {outcome!.resp.student?.department ? ` · ${outcome!.resp.student.department}` : ""}
                      {outcome!.resp.checkinAt ? " · checked in just now" : ""}
                    </p>
                  </div>
                </div>
              )}
              <p className="max-w-md text-sm text-purple-100/60">{theme.sub}</p>

              {/* auto-reset countdown */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="mt-4 flex w-72 max-w-[80vw] flex-col items-center gap-2 rounded-2xl border border-purple-500/25 bg-[#0b0517]/70 px-5 py-3 transition-colors hover:border-purple-400/50"
              >
                <span className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/60">
                  <span>{countdown !== null ? `Next junior in ${countdown}s` : "Tap or scan to continue"}</span>
                  {countdown !== null && <span className="tabular-nums text-purple-300/80">{countdown}</span>}
                </span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-purple-500/15">
                  {countdown !== null && (
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-1000 ease-linear"
                      style={{ width: `${Math.max(0, (countdown / (resetSecs || 1)) * 100)}%` }}
                    />
                  )}
                </span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative flex flex-col items-center"
            >
              {/* attract-mode spark field */}
              {attract && (
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
                  {ATTRACT_SPARKS.map((sp, i) => (
                    <span
                      key={i}
                      className="obs-spark bg-purple-300/80"
                      style={{
                        left: sp.left,
                        width: sp.size,
                        height: sp.size,
                        ["--spark-dur" as string]: `${sp.dur}s`,
                        ["--spark-delay" as string]: `${sp.delay}s`,
                        ["--spark-op" as string]: 0.7,
                        boxShadow: "0 0 8px 2px rgba(192,132,252,0.55)",
                      }}
                    />
                  ))}
                </div>
              )}

              <span
                className={cn(
                  "mb-7 flex items-center gap-2.5 rounded-full border px-5 py-1.5 transition-colors duration-700",
                  attract
                    ? "border-purple-400/70 bg-purple-500/15 shadow-[0_0_24px_rgba(168,85,247,0.35)]"
                    : "border-purple-500/40 bg-purple-950/40"
                )}
              >
                <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-200">
                  {attract ? "doors open · step right in" : "entry desk"}
                </span>
              </span>
              <h1
                className={cn(
                  "font-display obs-text-glow relative max-w-[94vw] overflow-hidden text-[10vw] font-black leading-[1.02] tracking-tight sm:text-6xl md:text-7xl",
                  attract ? "obs-attract-title" : "obs-gradient-text"
                )}
              >
                SHOW YOUR PASS
                {attract && (
                  <span
                    aria-hidden
                    className="obs-attract-sweep pointer-events-none absolute inset-0"
                  />
                )}
              </h1>
              <motion.p
                key={attract ? `hint-${hintIdx}` : "hint-static"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={cn(
                  "mt-5 max-w-md text-sm leading-relaxed",
                  attract ? "font-medium text-purple-100/85" : "text-purple-100/55"
                )}
              >
                {attract
                  ? ATTRACT_HINTS[hintIdx]
                  : "Scan the ID or type the Student ID below — the door screen confirms instantly."}
              </motion.p>

              <form
                className="relative mt-9 w-full max-w-xl"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(value);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {attract && (
                  <span
                    aria-hidden
                    className="obs-attract-ring pointer-events-none absolute -inset-2 rounded-3xl"
                  />
                )}
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value.toUpperCase())}
                  placeholder="OBS26-000"
                  aria-label="Student ID"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={verifying}
                  className={cn(
                    "obs-card h-20 w-full rounded-2xl text-center font-mono text-3xl font-bold uppercase tracking-[0.28em] text-purple-50 placeholder:text-purple-200/20 placeholder:tracking-[0.2em] focus:border-purple-400/80 focus:outline-none focus:ring-4 focus:ring-purple-500/25 disabled:opacity-60 sm:h-24 sm:text-4xl",
                    attract && "border-purple-400/60 shadow-[0_0_36px_rgba(168,85,247,0.28)]"
                  )}
                />
              </form>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.22em] text-purple-200/40">
                <span>Scanner or keyboard</span>
                <span className="h-1 w-1 rounded-full bg-purple-400/50" />
                <span>Instant server check</span>
                <span className="h-1 w-1 rounded-full bg-purple-400/50" />
                <span>Chime + haptic feedback</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* session activity strip */}
      <footer className="relative z-10 border-t border-purple-500/15 bg-[#06030c]/75 px-5 py-3 backdrop-blur-md">
        {activity.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 obs-scrollbar" aria-label="Recent entries at this desk">
            {activity.map((a) => {
              const t = outcomeTheme(a.resp);
              return (
                <span
                  key={a.key}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold",
                    t.chip
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  {a.resp.student?.name ?? a.resp.result}
                  <span className="font-normal opacity-60">
                    {a.at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-[10px] uppercase tracking-[0.24em] text-purple-200/30">
            OBSIDIAN &apos;26 · Smart QR Entry · kiosk session starts with the first scan
          </p>
        )}
      </footer>
    </div>
  );
}
