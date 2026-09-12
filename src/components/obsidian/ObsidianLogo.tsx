"use client";

import { cn } from "@/lib/utils";

/** Mini obsidian shard glyph */
export function ObsidianGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="og-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="1" stopColor="#1e0b3a" />
        </linearGradient>
      </defs>
      <polygon points="32,6 51,24 44,51 20,51 13,24" fill="url(#og-g)" stroke="#a855f7" strokeWidth="2.6" />
      <polyline points="32,6 32,51" stroke="#c084fc" strokeWidth="1.3" opacity="0.75" fill="none" />
      <polyline points="13,24 44,51" stroke="#a855f7" strokeWidth="1.2" opacity="0.55" fill="none" />
      <polyline points="51,24 20,51" stroke="#a855f7" strokeWidth="1.2" opacity="0.55" fill="none" />
      <circle cx="32" cy="30" r="3.2" fill="#f5f3ff" />
    </svg>
  );
}

/** OBSIDIAN '26 brand lockup */
export function ObsidianLogo({
  size = "md",
  showTagline = false,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <ObsidianGlyph
        className={cn(
          "obs-pulse-glow shrink-0",
          size === "sm" && "h-7 w-7",
          size === "md" && "h-9 w-9",
          size === "lg" && "h-12 w-12"
        )}
      />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display obs-gradient-text font-extrabold tracking-wide",
            size === "sm" && "text-sm",
            size === "md" && "text-lg",
            size === "lg" && "text-2xl"
          )}
        >
          OBSIDIAN
          <span className="ml-1.5 text-[0.6em] align-super text-purple-300">26</span>
        </span>
        {size !== "sm" && (
          <span
            className={cn(
              "mt-1 font-medium uppercase tracking-[0.28em] text-purple-300/70",
              size === "md" && "text-[9px]",
              size === "lg" && "text-[11px]"
            )}
          >
            Freshers 2K26
          </span>
        )}
      </div>
      {showTagline && (
        <span className="ml-2 hidden border-l border-purple-500/25 pl-3 text-[10px] uppercase tracking-[0.3em] text-purple-200/50 sm:block">
          Unfold the Unknown
        </span>
      )}
    </div>
  );
}
