"use client";

import { useEffect, useState } from "react";

export type Support3D = "full" | "reduced" | "none" | "pending";

/**
 * Detects device capability for the WebGL crystal scene.
 * - "none": no WebGL / prefers-reduced-motion → static SVG crystal
 * - "reduced": weaker device → scene with fewer particles/shards
 * - "full": full scene
 */
export function use3DSupport(): Support3D {
  const [support, setSupport] = useState<Support3D>("pending");

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setSupport("none");
          return;
        }
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
        if (!gl) {
          setSupport("none");
          return;
        }
        const nav = navigator as Navigator & { deviceMemory?: number };
        const mem = nav.deviceMemory;
        const cores = navigator.hardwareConcurrency || 4;
        const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;
        if ((typeof mem === "number" && mem < 4) || cores <= 2 || (isSmallScreen && cores <= 4)) {
          setSupport("reduced");
          return;
        }
        setSupport("full");
      } catch {
        setSupport("none");
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return support;
}
