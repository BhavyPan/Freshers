"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, X } from "lucide-react";

/**
 * Live organizer broadcast — one-line notice shown on public screens.
 * Dismissible per announcement text (re-appears when the text changes).
 * Note: rendered only after the client-side pulse fetch resolves, so a lazy
 * localStorage read in the initializer is hydration-safe.
 */
export function AnnouncementBanner({ text, compact = false }: { text: string; compact?: boolean }) {
  const [dismissed, setDismissed] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("obsidian.dismissedAnnouncement");
    } catch {
      return null;
    }
  });

  if (dismissed === text) return null;

  function dismiss() {
    setDismissed(text);
    try {
      window.localStorage.setItem("obsidian.dismissedAnnouncement", text);
    } catch {
      /* ignore */
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key={text}
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -18 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`relative z-20 ${compact ? "mb-6 w-full" : "w-full px-5 pt-4 sm:pt-5"} flex justify-center`}
        role="status"
        aria-live="polite"
      >
        <div className="obs-glow-btn relative flex w-full max-w-xl items-center gap-3 rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-950/70 via-purple-950/60 to-amber-950/70 px-4 py-3 backdrop-blur-md">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
            <Megaphone className="h-4 w-4 text-amber-300" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-amber-300/80">
              Organizer notice
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold leading-snug text-amber-50" title={text}>
              {text}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss announcement"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-amber-200/60 transition-colors hover:bg-amber-500/15 hover:text-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
