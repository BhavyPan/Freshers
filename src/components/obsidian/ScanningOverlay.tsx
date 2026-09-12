"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const STEPS = [
  "Trimming input…",
  "Querying registration database…",
  "Matching student records…",
  "Finalizing access decision…",
];

/** Themed "Scanning / Verifying Registration" overlay */
export function ScanningOverlay() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 480);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden rounded-xl bg-[#0a0514]/95 backdrop-blur-sm"
    >
      {/* sweep line */}
      <div
        className="obs-scan-sweep absolute left-0 h-16 w-full"
        style={{ background: "linear-gradient(180deg, transparent, rgba(168,85,247,0.22), rgba(216,180,254,0.5), rgba(168,85,247,0.22), transparent)" }}
      />

      {/* scanning rings */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-purple-500/25" />
        <span className="obs-spin-slow absolute inset-0 rounded-full border-2 border-dashed border-purple-400/45" style={{ animationDuration: "6s" }} />
        <span
          className="absolute inset-3 rounded-full border border-violet-300/30"
          style={{ animation: "obs-live-pulse 2s ease-out infinite" }}
        />
        <svg viewBox="0 0 64 64" className="relative h-12 w-12 opacity-90">
          <polygon points="32,6 51,24 44,51 20,51 13,24" fill="#1a0d36" stroke="#c084fc" strokeWidth="2" />
          <circle cx="32" cy="30" r="4" fill="#e9d5ff">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.1s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <p className="font-display mt-6 text-sm font-semibold tracking-[0.22em] text-purple-200">
        VERIFYING REGISTRATION
      </p>
      <motion.p
        key={step}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 text-xs text-purple-300/70"
      >
        {STEPS[step]}
      </motion.p>
      <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-purple-950/70">
        <div className="obs-shimmer h-full w-full rounded-full" />
      </div>
    </motion.div>
  );
}
