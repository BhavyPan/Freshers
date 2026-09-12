"use client";

import { useMemo } from "react";

/** One-shot purple/white sparkle burst for ACCESS GRANTED */
export function SparkleBurst({ count = 26 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const dist = 90 + Math.random() * 140;
        const size = 2.5 + Math.random() * 4;
        const color = i % 4 === 0 ? "#f5f3ff" : i % 4 === 1 ? "#c084fc" : i % 4 === 2 ? "#a855f7" : "#e9d5ff";
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size,
          color,
          delay: Math.random() * 0.18,
        };
      }),
    [count]
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes obs-spark-fly {
          0%   { transform: translate(-50%, -50%) scale(0.2) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1) rotate(140deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2"
          style={
            {
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: i % 3 === 0 ? "9999px" : "1.5px",
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              animation: `obs-spark-fly 1.2s cubic-bezier(0.16,0.84,0.44,1) ${p.delay}s forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
