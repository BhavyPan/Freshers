"use client";

import { create } from "zustand";
import type { AdminSessionInfo, VerifyResponse } from "./types";

const TOKEN_KEY = "obsidian_event_token";

export function readEventToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function captureEventTokenOnce() {
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}

interface ObsidianState {
  verifyResponse: VerifyResponse | null;
  lastInput: string;
  admin: AdminSessionInfo | null;
  adminBooted: boolean;
  setVerify: (input: string, response: VerifyResponse) => void;
  clearVerify: () => void;
  setAdmin: (admin: AdminSessionInfo | null) => void;
  setAdminBooted: () => void;
}

export const useObsidianStore = create<ObsidianState>((set) => ({
  verifyResponse: null,
  lastInput: "",
  admin: null,
  adminBooted: false,
  setVerify: (input, response) => set({ lastInput: input, verifyResponse: response }),
  clearVerify: () => set({ verifyResponse: null, lastInput: "" }),
  setAdmin: (admin) => set({ admin }),
  setAdminBooted: () => set({ adminBooted: true }),
}));
