"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleHelp, KeyRound, Link2, ScanLine, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { primeAudio, playFeedback } from "@/lib/feedback";
import { readEventToken, useObsidianStore } from "@/lib/client-store";
import type { VerifyResponse } from "@/lib/types";
import { ScanningOverlay } from "./ScanningOverlay";
import { ObsidianLogo } from "./ObsidianLogo";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { ForgotIdDialog } from "./ForgotIdDialog";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9\-\/_.]{2,39}$/;

export function VerifyView({ onResult, onBack }: { onResult: () => void; onBack: () => void }) {
  const [value, setValue] = useState("");
  const [invitedId, setInvitedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const idInputRef = useRef<HTMLInputElement | null>(null);
  const setVerify = useObsidianStore((s) => s.setVerify);
  const { data: pulse } = useQuery({
    queryKey: ["pulse"],
    queryFn: () => api.pulse(),
    refetchInterval: 6000,
    refetchIntervalInBackground: false,
  });

  // unlock the audio context on first interaction (mobile browsers)
  useEffect(() => {
    const unlock = () => primeAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // personal invite link prefill (/#/verify?id=OBS26-xxx)
  // deferred via rAF: keeps SSR markup stable and satisfies lint (no sync setState in effect)
  useEffect(() => {
    const hashQuery = window.location.hash.split("?")[1] ?? "";
    const invited = new URLSearchParams(hashQuery).get("id");
    if (!invited || !ID_RE.test(invited.trim())) return;
    const prefill = invited.trim().toUpperCase();
    const raf = requestAnimationFrame(() => {
      setValue(prefill);
      setInvitedId(prefill);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (scanning) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Please enter your Student / College ID.");
      playFeedback("tap");
      return;
    }
    if (!ID_RE.test(trimmed)) {
      setError("Invalid format — use 3–40 letters/digits ( - / _ . allowed ).");
      playFeedback("tap");
      return;
    }
    setError(null);
    setScanning(true);
    playFeedback("tap");
    try {
      const [response] = await Promise.all([
        api.verify(trimmed, readEventToken()),
        new Promise((r) => setTimeout(r, 1350)),
      ]);
      setVerify(trimmed, response as VerifyResponse);
      setScanning(false);
      onResult();
    } catch (err) {
      setScanning(false);
      if (err instanceof ApiError) {
        if (err.status === 503) {
          // organizers paused / closed the gate — themed result screen
          const resp: VerifyResponse = { ok: false, result: "EVENT_CLOSED", message: err.message };
          setVerify(trimmed, resp);
          onResult();
          return;
        }
        const message = err.status === 429 ? "Too many attempts — please wait a moment." : err.message;
        const resp: VerifyResponse = { ok: false, result: "RATE_LIMITED", message };
        setVerify(trimmed, resp);
        onResult();
      } else {
        setError("Network error. Please check your connection and try again.");
        playFeedback("denied");
      }
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col">
      {/* header */}
      <header className="border-b border-purple-500/15 bg-[#06030c]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <ObsidianLogo size="sm" />
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-purple-200/60 transition-colors hover:text-purple-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
        {/* live organizer announcement (compact) */}
        {pulse?.announcement && <AnnouncementBanner text={pulse.announcement} compact />}

        {/* step tracker */}
        <div className="mb-8 flex items-center justify-center gap-0 text-[10px] font-semibold uppercase tracking-[0.18em]">
          {[
            { label: "Scan QR", done: true },
            { label: "Enter ID", done: false, active: true },
            { label: "Access", done: false },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center">
              {i > 0 && <div className={`mx-3 h-px w-8 sm:w-12 ${s.done ? "bg-purple-500/60" : "bg-purple-500/20"}`} />}
              <span
                className={
                  s.active
                    ? "flex items-center gap-1.5 text-purple-200"
                    : s.done
                      ? "flex items-center gap-1.5 text-purple-400/70"
                      : "flex items-center gap-1.5 text-purple-100/30"
                }
              >
                <span
                  className={
                    s.active
                      ? "flex h-5 w-5 items-center justify-center rounded-full border border-purple-300/60 bg-purple-500/25 text-[9px]"
                      : s.done
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-purple-600/40 text-[9px]"
                        : "flex h-5 w-5 items-center justify-center rounded-full border border-purple-500/25 text-[9px]"
                  }
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            </div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="obs-card relative overflow-hidden rounded-2xl p-7 sm:p-9"
        >
          {scanning && <ScanningOverlay />}

          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-purple-600/15 blur-3xl" />

          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10">
              <KeyRound className="h-5 w-5 text-purple-300" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold tracking-wide text-purple-50">Entry Verification</h1>
              <p className="text-xs text-purple-200/60">Official OBSIDIAN &apos;26 registration check</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="student-id" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-200/70">
                Student / College ID
              </label>
              <Input
                id="student-id"
                ref={idInputRef}
                value={value}
                onChange={(e) => {
                  // mirror the server-side normalization while typing
                  setValue(e.target.value.toUpperCase());
                  if (error) setError(null);
                  if (invitedId && e.target.value.toUpperCase() !== invitedId) setInvitedId(null);
                }}
                placeholder="e.g. OBS26-041"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={scanning}
                className="h-14 rounded-xl border-purple-500/35 bg-[#0b0517]/90 text-center font-mono text-lg font-semibold uppercase tracking-[0.2em] text-purple-50 placeholder:text-purple-200/25 placeholder:tracking-normal focus:border-purple-400/80 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
              />
              {invitedId && value === invitedId && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-emerald-300/90"
                >
                  <Link2 className="h-3 w-3" />
                  Pre-filled from your personal invite — just hit verify
                </motion.p>
              )}
              {!invitedId && (
                <p className="mt-2.5 text-center text-xs text-purple-200/45">
                  Enter the ID you registered with — exactly as on your college ID card.
                </p>
              )}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-4 py-2.5 text-center text-sm text-rose-300"
                role="alert"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={scanning}
              className="obs-glow-btn h-13 w-full rounded-xl border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 py-4 text-base font-semibold text-white transition-all hover:border-purple-200/70 hover:brightness-110 disabled:opacity-50"
            >
              <ScanLine className="mr-2 h-5 w-5" />
              {scanning ? "Verifying…" : "Verify & Check In"}
            </Button>
          </form>

          {/* forgot-ID self-service */}
          <button
            type="button"
            onClick={() => setLookupOpen(true)}
            className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-medium text-purple-200/55 underline-offset-4 transition-colors hover:text-purple-100 hover:underline hover:decoration-purple-400/60"
          >
            <CircleHelp className="h-3.5 w-3.5" />
            Forgot your ID? Look it up with your registered mobile
          </button>
        </motion.div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-purple-200/35">
          Verification is secure and server-side. Your registration data is never exposed on this device.
        </p>

        {/* live social proof */}
        {pulse && pulse.totalRegistered > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-purple-200/45"
            aria-live="polite"
          >
            <Users className="h-3.5 w-3.5 text-emerald-300/70" />
            <span className="font-semibold tabular-nums text-emerald-300/90">{pulse.checkedIn}</span>
            of {pulse.totalRegistered} juniors already inside
          </motion.p>
        )}
      </main>

      <ForgotIdDialog
        key={lookupOpen ? "open" : "closed"}
        open={lookupOpen}
        onOpenChange={(v) => {
          setLookupOpen(v);
          if (!v) {
            // hand focus back to the ID field after the dialog closes
            requestAnimationFrame(() => idInputRef.current?.focus());
          }
        }}
        onUseId={(id) => {
          setValue(id);
          setInvitedId(null);
          setError(null);
          setLookupOpen(false);
          playFeedback("tap");
          requestAnimationFrame(() => idInputRef.current?.focus());
        }}
      />
    </div>
  );
}
