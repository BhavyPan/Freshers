"use client";

/**
 * Sensory feedback for the entry flow — themed WebAudio chimes + haptics.
 * Designed for a loud venue: short, distinct, works without any audio assets.
 * Preference is persisted in localStorage (defaults to ON).
 */

export type FeedbackKind = "granted" | "already" | "denied" | "tap";

const STORAGE_KEY = "obsidian.sound";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode — ignore */
  }
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx || ctx.state === "closed") ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneSpec {
  freq: number;
  start: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  glideTo?: number;
}

const RECIPES: Record<FeedbackKind, ToneSpec[]> = {
  // bright ascending major arpeggio — "welcome in"
  granted: [
    { freq: 523.25, start: 0, dur: 0.16, gain: 0.16, type: "sine" },
    { freq: 659.25, start: 0.09, dur: 0.16, gain: 0.16, type: "sine" },
    { freq: 783.99, start: 0.18, dur: 0.22, gain: 0.18, type: "sine" },
    { freq: 1046.5, start: 0.27, dur: 0.34, gain: 0.14, type: "sine" },
  ],
  // neutral two-tone double blip — informational
  already: [
    { freq: 620, start: 0, dur: 0.12, gain: 0.12, type: "triangle" },
    { freq: 620, start: 0.17, dur: 0.12, gain: 0.12, type: "triangle" },
  ],
  // low descending minor second buzz — rejection
  denied: [
    { freq: 220, start: 0, dur: 0.22, gain: 0.2, type: "sawtooth", glideTo: 160 },
    { freq: 155, start: 0.2, dur: 0.3, gain: 0.18, type: "sawtooth", glideTo: 110 },
  ],
  tap: [{ freq: 880, start: 0, dur: 0.05, gain: 0.06, type: "sine" }],
};

function vibrate(kind: FeedbackKind): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    const patterns: Record<FeedbackKind, number | number[]> = {
      granted: [40, 60, 40, 60, 120],
      already: [60],
      denied: [180, 80, 180],
      tap: 15,
    };
    navigator.vibrate(patterns[kind]);
  } catch {
    /* unsupported — ignore */
  }
}

export function playFeedback(kind: FeedbackKind): void {
  if (!isSoundEnabled()) return;
  vibrate(kind);
  const audio = getCtx();
  if (!audio) return;
  try {
    const now = audio.currentTime;
    for (const tone of RECIPES[kind]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = tone.type ?? "sine";
      osc.frequency.setValueAtTime(tone.freq, now + tone.start);
      if (tone.glideTo) {
        osc.frequency.exponentialRampToValueAtTime(tone.glideTo, now + tone.start + tone.dur);
      }
      gain.gain.setValueAtTime(0.0001, now + tone.start);
      gain.gain.exponentialRampToValueAtTime(tone.gain, now + tone.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now + tone.start);
      osc.stop(now + tone.start + tone.dur + 0.05);
    }
  } catch {
    /* audio unavailable — silent fallback */
  }
}

/** Preload/unlock audio on first user gesture (mobile Safari requirement). */
export function primeAudio(): void {
  getCtx();
}
