"use client";

import { cn } from "@/lib/utils";

/**
 * Lightweight static obsidian-crystal (SVG + CSS) used:
 *  - while the WebGL scene lazy-loads
 *  - as the fallback on low-end devices / no WebGL / reduced-motion
 */
export function CrystalFallback({ className }: { className?: string }) {
  return (
    <div className={cn("obs-float relative flex items-center justify-center", className)} aria-hidden>
      {/* halo */}
      <div
        className="absolute h-[78%] w-[78%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.4), rgba(76,29,149,0.18) 55%, transparent 72%)" }}
      />
      {/* orbit ring */}
      <div className="obs-spin-slow absolute h-[104%] w-[104%] max-w-none">
        <div
          className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-purple-400/30"
          style={{ transform: "translate(-50%,-50%) rotateX(68deg)" }}
        />
      </div>
      <svg viewBox="0 0 200 260" className="obs-pulse-glow relative h-full w-auto drop-shadow-[0_0_28px_rgba(124,58,237,0.45)]">
        <defs>
          <linearGradient id="cf-body" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#2a1250" />
            <stop offset="0.5" stopColor="#150830" />
            <stop offset="1" stopColor="#0b0418" />
          </linearGradient>
          <linearGradient id="cf-face1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c084fc" stopOpacity="0.5" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="cf-face2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a855f7" stopOpacity="0.32" />
            <stop offset="1" stopColor="#4c1d95" stopOpacity="0.08" />
          </linearGradient>
          <radialGradient id="cf-core" cx="0.5" cy="0.42" r="0.65">
            <stop offset="0" stopColor="#e9d5ff" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#c084fc" stopOpacity="0.65" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* crystal body */}
        <polygon points="100,8 168,72 148,196 100,252 52,196 32,72" fill="url(#cf-body)" stroke="#a855f7" strokeWidth="2" />
        {/* facets */}
        <polygon points="100,8 168,72 100,96" fill="url(#cf-face1)" />
        <polygon points="100,8 32,72 100,96" fill="url(#cf-face2)" />
        <polygon points="168,72 148,196 100,96" fill="url(#cf-face2)" />
        <polygon points="32,72 52,196 100,96" fill="url(#cf-face1)" opacity="0.7" />
        <polygon points="148,196 100,252 100,96" fill="#7c3aed" opacity="0.1" />
        <polygon points="52,196 100,252 100,96" fill="#7c3aed" opacity="0.06" />
        {/* inner core glow */}
        <ellipse cx="100" cy="112" rx="34" ry="52" fill="url(#cf-core)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3.4s" repeatCount="indefinite" />
        </ellipse>
        {/* facet edges */}
        <g stroke="#c084fc" strokeWidth="1.1" opacity="0.6" fill="none">
          <polyline points="100,8 100,96 168,72" />
          <polyline points="100,96 32,72" />
          <polyline points="100,96 100,252" />
          <polyline points="100,96 148,196" />
          <polyline points="100,96 52,196" />
        </g>
        {/* glint */}
        <circle cx="78" cy="52" r="3.4" fill="#f5f3ff">
          <animate attributeName="opacity" values="0.9;0.25;0.9" dur="2.6s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
