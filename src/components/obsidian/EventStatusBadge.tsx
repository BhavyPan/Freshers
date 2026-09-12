"use client";

import { motion } from "framer-motion";
import { Lock, PauseCircle, Radio } from "lucide-react";
import type { EventStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const CONFIG: Record<
  EventStatus,
  { label: string; icon: React.ComponentType<{ className?: string }>; classes: string; dot: string }
> = {
  OPEN: {
    label: "Doors Open",
    icon: Radio,
    classes: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    dot: "bg-emerald-400",
  },
  PAUSED: {
    label: "Entry Paused",
    icon: PauseCircle,
    classes: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    dot: "bg-amber-400",
  },
  CLOSED: {
    label: "Entry Closed",
    icon: Lock,
    classes: "border-rose-400/40 bg-rose-500/10 text-rose-200",
    dot: "bg-rose-400",
  },
};

export function EventStatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: EventStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  return (
    <motion.span
      key={status}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold uppercase tracking-[0.2em] backdrop-blur-sm",
        cfg.classes,
        size === "sm" ? "px-3 py-1 text-[10px]" : "px-4 py-1.5 text-[11px]",
        className
      )}
      role="status"
      aria-label={`Event status: ${cfg.label}`}
    >
      <span className="relative flex h-2 w-2">
        {status === "OPEN" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", cfg.dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", cfg.dot)} />
      </span>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {cfg.label}
    </motion.span>
  );
}
