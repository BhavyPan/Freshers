"use client";

import { useMemo } from "react";

/**
 * OBSIDIAN '26 topographic contour background.
 * Layered SVG contour "blobs" drifting slowly over a black-purple gradient,
 * plus a film-grain overlay and vignette for the cinematic look.
 */
export function ContourBackground({ intensity = 1 }: { intensity?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${(i * 37.7 + 13) % 100}%`,
        size: 1.5 + ((i * 7) % 3),
        dur: `${11 + ((i * 3) % 10)}s`,
        delay: `${-((i * 1.7) % 18)}s`,
        op: 0.25 + ((i * 13) % 50) / 100,
      })),
    []
  );

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#05030a]">
      {/* base gradient wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 520px at 50% -8%, rgba(88, 28, 135, 0.38), transparent 62%)," +
            "radial-gradient(900px 600px at 88% 110%, rgba(124, 58, 237, 0.14), transparent 58%)," +
            "radial-gradient(700px 500px at 4% 90%, rgba(76, 29, 149, 0.16), transparent 55%)," +
            "linear-gradient(180deg, #07040f 0%, #05030a 55%, #060309 100%)",
        }}
      />

      {/* contour lines — group A (back) */}
      <svg
        className="obs-contour-a absolute -left-[12%] -top-[22%] h-[78%] w-[85%]"
        viewBox="0 0 800 600"
        fill="none"
        style={{ opacity: 0.16 * intensity }}
        preserveAspectRatio="xMidYMid slice"
      >
        {contourPaths().map((d, i) => (
          <path key={i} d={d} stroke="#a855f7" strokeWidth="1" opacity={0.16} />
        ))}
      </svg>

      {/* contour lines — group B (mid) */}
      <svg
        className="obs-contour-b absolute -right-[14%] top-[30%] h-[80%] w-[90%]"
        viewBox="0 0 800 600"
        fill="none"
        style={{ opacity: 0.12 * intensity }}
        preserveAspectRatio="xMidYMid slice"
      >
        {contourPaths().map((d, i) => (
          <path key={i} d={d} stroke="#c084fc" strokeWidth="0.9" opacity={0.14} />
        ))}
      </svg>

      {/* contour lines — group C (front, faint) */}
      <svg
        className="obs-contour-c absolute bottom-[-30%] left-[10%] h-[70%] w-[80%]"
        viewBox="0 0 800 600"
        fill="none"
        style={{ opacity: 0.09 * intensity }}
        preserveAspectRatio="xMidYMid slice"
      >
        {contourPaths().map((d, i) => (
          <path key={i} d={d} stroke="#8b5cf6" strokeWidth="1" opacity={0.12} />
        ))}
      </svg>

      {/* rising spark particles */}
      {sparks.map((s, i) => (
        <span
          key={i}
          className="obs-spark"
          style={
            {
              left: s.left,
              width: s.size,
              height: s.size,
              background: i % 5 === 0 ? "#f5f3ff" : "#c084fc",
              boxShadow: `0 0 ${s.size * 4}px rgba(192,132,252,0.8)`,
              "--spark-dur": s.dur,
              "--spark-delay": s.delay,
              "--spark-op": s.op,
            } as React.CSSProperties
          }
        />
      ))}

      {/* grain + vignette */}
      <div className="obs-grain absolute inset-0" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(2,1,6,0.75) 100%)" }}
      />
    </div>
  );
}

function contourPaths(): string[] {
  // organic topographic loops around a single center
  const center = { x: 400, y: 300 };
  return Array.from({ length: 9 }, (_, ring) => {
    const r = 70 + ring * 42;
    const wobble = 26 + ring * 5;
    const pts = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const rr = r + Math.sin(a * 3 + ring) * wobble * 0.55 + Math.cos(a * 2 + ring * 0.7) * wobble * 0.4;
      const x = center.x + Math.cos(a) * rr;
      const y = center.y + Math.sin(a) * rr * 0.72;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `${pts} Z`;
  });
}
