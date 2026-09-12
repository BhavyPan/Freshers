"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, Loader2, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { useObsidianStore } from "@/lib/client-store";
import { ObsidianLogo } from "./ObsidianLogo";

export function AdminLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAdmin = useObsidianStore((s) => s.setAdmin);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      if (res.ok && res.user) {
        setAdmin(res.user);
        onLoggedIn();
      } else {
        setError(res.message ?? "Login failed");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex justify-center">
          <ObsidianLogo size="lg" showTagline />
        </div>

        <motion.div
          key={error ? "err" : "ok"}
          initial={error ? { x: 0 } : false}
          animate={error ? { x: [0, -10, 9, -6, 4, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="obs-card relative overflow-hidden rounded-2xl p-7"
        >
          <div className="pointer-events-none absolute -left-14 -top-14 h-36 w-36 rounded-full bg-purple-600/15 blur-3xl" />

          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10">
              <KeyRound className="h-4.5 w-4.5 text-purple-300" />
            </span>
            <div>
              <h1 className="font-display text-base font-bold tracking-wide text-purple-50">Organizer Access</h1>
              <p className="text-xs text-purple-200/55">Command center authentication</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="adm-user" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200/70">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/50" />
                <Input
                  id="adm-user"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="admin"
                  autoComplete="username"
                  className="h-11 rounded-xl border-purple-500/35 bg-[#0b0517]/90 pl-10 text-sm text-purple-50 placeholder:text-purple-200/25 focus:border-purple-400/80 focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="adm-pass" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200/70">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300/50" />
                <Input
                  id="adm-pass"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-purple-500/35 bg-[#0b0517]/90 pl-10 pr-11 text-sm text-purple-50 placeholder:text-purple-200/25 focus:border-purple-400/80 focus:ring-2 focus:ring-purple-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300/50 transition-colors hover:text-purple-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-4 py-2.5 text-center text-sm text-rose-300" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="obs-glow-btn h-11 w-full rounded-xl border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              {loading ? "Authenticating…" : "Enter Command Center"}
            </Button>
          </form>

          <details className="mt-5 rounded-lg border border-purple-500/15 bg-purple-500/5 px-3 py-2">
            <summary className="cursor-pointer select-none text-[11px] uppercase tracking-[0.16em] text-purple-200/50 hover:text-purple-200/80">
              Demo credentials
            </summary>
            <div className="mt-2 space-y-1 font-mono text-[11px] text-purple-200/70">
              <p>admin / obsidian26 — full organizer</p>
              <p>volunteer / volunteer26 — entry desk</p>
            </div>
          </details>
        </motion.div>

        <p className="mt-6 text-center text-[11px] text-purple-200/35">
          <a href="#/" className="underline-offset-4 hover:text-purple-200/60 hover:underline">← Back to public entry</a>
        </p>
      </motion.div>
    </div>
  );
}
