"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  CircleHelp,
  Copy,
  Loader2,
  Phone,
  Search,
  ShieldQuestion,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { LookupMatch } from "@/lib/types";

type LookupState =
  | { phase: "idle" }
  | { phase: "searching" }
  | { phase: "found"; matches: LookupMatch[] }
  | { phase: "notfound"; message: string }
  | { phase: "error"; message: string };

export function ForgotIdDialog({
  open,
  onOpenChange,
  onUseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUseId: (id: string) => void;
}) {
  const [mobile, setMobile] = useState("");
  const [state, setState] = useState<LookupState>({ phase: "idle" });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // parent remounts this component (via key) on each open, so state starts fresh —
  // no reset-in-effect needed

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  function clean(value: string) {
    // phones only: digits, leading +, spaces/hyphens while typing
    return value.replace(/[^\d+\-\s]/g, "").slice(0, 18);
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (state.phase === "searching") return;
    const digits = mobile.replace(/\D+/g, "");
    if (digits.length < 10) {
      setState({ phase: "error", message: "Enter the full 10-digit mobile number you registered with." });
      return;
    }
    setState({ phase: "searching" });
    try {
      const res = await api.lookup(mobile);
      if (res.found && res.matches && res.matches.length > 0) {
        setState({ phase: "found", matches: res.matches });
      } else {
        setState({
          phase: "notfound",
          message: res.message ?? "No registration found for that number. Ask at the registration desk.",
        });
      }
    } catch (err) {
      setState({
        phase: "error",
        message:
          err instanceof ApiError
            ? err.message
            : "Lookup failed. Please check your connection and try again.",
      });
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 1600);
    } catch {
      /* clipboard unavailable — the visible ID is selectable anyway */
    }
  }

  const digits = mobile.replace(/\D+/g, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="obs-card max-w-md border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-purple-50">
            <CircleHelp className="h-5 w-5 text-purple-300" /> Forgot your ID?
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-purple-200/60">
            Enter the mobile number you registered with — we&apos;ll look up your entry ID.
            Lookups are rate-limited and logged for security.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="mt-1 space-y-3">
          <div>
            <label htmlFor="lookup-mobile" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-200/70">
              Registered mobile number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/50" />
              <Input
                id="lookup-mobile"
                value={mobile}
                onChange={(e) => {
                  setMobile(clean(e.target.value));
                  if (state.phase === "error" || state.phase === "notfound") setState({ phase: "idle" });
                }}
                placeholder="98765 43210"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                disabled={state.phase === "searching"}
                className="h-12 rounded-xl border-purple-500/35 bg-[#0b0517]/90 pl-10 font-mono text-base tracking-[0.12em] text-purple-50 placeholder:font-sans placeholder:tracking-normal placeholder:text-purple-200/25 focus:border-purple-400/80 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={state.phase === "searching" || digits.length < 10}
            className="obs-glow-btn h-11 w-full rounded-xl border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 text-sm font-semibold text-white transition-all hover:border-purple-200/70 hover:brightness-110 disabled:opacity-50"
          >
            {state.phase === "searching" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching registry…
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" /> Find my ID
              </>
            )}
          </Button>
        </form>

        {/* results */}
        {state.phase === "found" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 space-y-2.5"
            aria-live="polite"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
              {state.matches.length === 1 ? "1 registration found" : `${state.matches.length} registrations found`}
            </p>
            {state.matches.map((m, i) => (
              <motion.div
                key={m.studentId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-3.5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-800/30 text-sm font-bold text-emerald-200">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-purple-50">{m.name}</p>
                      {m.checkedIn ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300">
                          <BadgeCheck className="h-2.5 w-2.5" /> already inside
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                          ready to enter
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-purple-200/55">
                      <span className="rounded-md border border-purple-400/25 bg-purple-500/10 px-1.5 py-0.5 font-mono font-semibold text-purple-100">
                        {m.studentId}
                      </span>
                      {m.department && <span>{m.department}</span>}
                      {m.year && <span>· {m.year}</span>}
                      <span className="text-purple-200/40">· mobile {m.mobileMasked}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => onUseId(m.studentId)}
                      className="obs-glow-btn h-8 rounded-lg border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 px-3 text-[11px] font-bold text-white hover:brightness-110"
                    >
                      <UserRound className="mr-1 h-3 w-3" />
                      Use this ID
                    </Button>
                    <button
                      onClick={() => copyId(m.studentId)}
                      className="flex h-7 items-center justify-center gap-1 rounded-lg border border-purple-500/25 px-2 text-[10px] font-semibold text-purple-200/70 transition-colors hover:border-purple-400/50 hover:text-purple-100"
                    >
                      <Copy className="h-2.5 w-2.5" />
                      {copiedId === m.studentId ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            <p className="pt-1 text-center text-[10px] text-purple-200/40">
              “Use this ID” fills it straight into the verification form.
            </p>
          </motion.div>
        )}

        {state.phase === "notfound" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            aria-live="polite"
            className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/8 p-4 text-center"
          >
            <ShieldQuestion className="mx-auto mb-2 h-6 w-6 text-amber-300" />
            <p className="text-xs leading-relaxed text-amber-200/90">{state.message}</p>
          </motion.div>
        )}

        {state.phase === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className={cn(
              "mt-2 rounded-lg border border-rose-500/30 bg-rose-950/30 px-4 py-2.5 text-center text-sm text-rose-300"
            )}
          >
            {state.message}
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
