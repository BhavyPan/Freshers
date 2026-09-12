"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MonitorPlay,
  QrCode,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api-client";
import { useObsidianStore } from "@/lib/client-store";
import type { AdminRole, AdminSessionInfo } from "@/lib/types";
import { ObsidianLogo } from "./ObsidianLogo";
import { cn } from "@/lib/utils";

export type AdminSection = "dashboard" | "registry" | "qr" | "reports";

const NAV: {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AdminRole[];
}[] = [
  { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
  { id: "registry", label: "Student Registry", icon: Users },
  { id: "qr", label: "Event QR Code", icon: QrCode },
  { id: "reports", label: "Reports & Audit", icon: ClipboardList },
];

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, []);
  return now;
}

function RoleBadge({ role }: { role: AdminRole }) {
  if (role === "VOLUNTEER") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-200"
        title="Volunteer with strict read-only access"
      >
        <Shield className="h-2.5 w-2.5 text-amber-400" />
        VOLUNTEER · READ ONLY
      </span>
    );
  }
  return (
    <span className="rounded-full border border-purple-400/40 bg-purple-500/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-purple-200">
      ADMIN
    </span>
  );
}

type NavItem = (typeof NAV)[number];

function NavList({
  items,
  section,
  onNavigate,
  onPick,
}: {
  items: NavItem[];
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
  onPick?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1.5" aria-label="Admin navigation">
      {items.map((n) => {
        const active = section === n.id;
        return (
          <button
            key={n.id}
            onClick={() => {
              onNavigate(n.id);
              onPick?.();
            }}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              active
                ? "border border-purple-400/40 bg-gradient-to-r from-purple-600/30 to-purple-500/10 text-purple-50"
                : "border border-transparent text-purple-200/55 hover:bg-purple-500/10 hover:text-purple-100"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]" />
            )}
            <n.icon className={cn("h-4.5 w-4.5 transition-transform", active ? "text-purple-300" : "text-purple-300/50 group-hover:scale-110")} />
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}

function KioskLaunch({ compact }: { compact?: boolean }) {
  return (
    <a
      href="#/kiosk"
      target="_blank"
      rel="noopener"
      title="Open the door-table kiosk screen in a new tab"
      className={cn(
        "group flex items-center gap-2.5 rounded-xl border border-purple-500/25 bg-purple-500/5 px-3.5 py-2.5 text-sm font-medium text-purple-200/70 transition-all hover:border-purple-400/50 hover:bg-purple-500/10 hover:text-purple-100",
        compact && "mt-5"
      )}
    >
      <MonitorPlay className="h-4.5 w-4.5 text-purple-300/70 transition-transform group-hover:scale-110" />
      Entry Kiosk
      <ExternalLink className="ml-auto h-3.5 w-3.5 text-purple-300/40" />
    </a>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 12 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from the current one.");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      toast({ title: "Password updated", description: "Use the new password on your next sign-in." });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="obs-card max-w-sm border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-purple-50">
            <Settings className="h-4.5 w-4.5 text-purple-300" /> Account settings
          </DialogTitle>
          <DialogDescription className="text-purple-200/60">
            Rotate your password after the event setup handover. Minimum 12 characters.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-200/70">
              Current password
            </Label>
            <Input
              id="pw-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="h-10 border-purple-500/30 bg-[#0b0517]/90 text-purple-50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-200/70">
              New password
            </Label>
            <Input
              id="pw-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              className="h-10 border-purple-500/30 bg-[#0b0517]/90 text-purple-50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-200/70">
              Confirm new password
            </Label>
            <Input
              id="pw-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="h-10 border-purple-500/30 bg-[#0b0517]/90 text-purple-50"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-purple-500/30 text-purple-200">
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="obs-glow-btn bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 text-white">
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Update password
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserChip({
  admin,
  loggingOut,
  onLogout,
}: {
  admin: AdminSessionInfo | null;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-violet-800 text-xs font-bold text-white">
          {(admin?.displayName || admin?.username || "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-purple-100">{admin?.displayName || admin?.username}</p>
          <div className="mt-0.5">{admin && <RoleBadge role={admin.role} />}</div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Account settings"
          title="Account settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-purple-300/60 transition-all hover:border-purple-400/40 hover:bg-purple-500/10 hover:text-purple-200"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
      <Button
        onClick={onLogout}
        disabled={loggingOut}
        variant="outline"
        size="sm"
        className="mt-3 w-full border-purple-500/30 text-xs text-purple-200/70 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200"
      >
        {loggingOut ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}
        Log out
      </Button>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export function AdminShell({
  section,
  onNavigate,
  onLogout,
  children,
}: {
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const admin = useObsidianStore((s) => s.admin);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const now = useClock();

  const nav = NAV.filter((n) => !n.roles || (admin && n.roles.includes(admin.role)));

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    useObsidianStore.getState().setAdmin(null);
    onLogout();
  }

  const title =
    section === "dashboard"
      ? "Event Command Center"
      : section === "registry"
        ? "Student Registry"
        : section === "qr"
          ? "Event QR Code"
          : "Reports & Audit";

  return (
    <div className="obs-grid-bg flex min-h-svh flex-col">
      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-purple-500/15 bg-[#06030c]/85 px-4 py-3 backdrop-blur-lg md:hidden">
        <div className="flex items-center gap-2.5">
          <ObsidianLogo size="sm" />
          {admin?.role === "VOLUNTEER" && (
            <span className="flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-amber-200">
              <Shield className="h-2.5 w-2.5 text-amber-400" />
              READ ONLY
            </span>
          )}
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 border-purple-500/30 text-purple-200" aria-label="Open menu">
              <Menu className="h-4.5 w-4.5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-purple-500/20 bg-[#0a0514] p-5">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <ObsidianLogo size="sm" className="mb-6" />
            <NavList items={nav} section={section} onNavigate={onNavigate} onPick={() => setMobileOpen(false)} />
            <KioskLaunch compact />
            <div className="mt-6">
              <UserChip admin={admin} loggingOut={loggingOut} onLogout={handleLogout} />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex flex-1">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-purple-500/15 bg-[#080512]/80 p-5 backdrop-blur-lg md:flex">
          <ObsidianLogo size="md" className="mb-8" />
          <NavList items={nav} section={section} onNavigate={onNavigate} />
          <KioskLaunch />
          <div className="mt-auto pt-6">
            <UserChip admin={admin} loggingOut={loggingOut} onLogout={handleLogout} />
          </div>
        </aside>

        {/* main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-purple-500/15 bg-[#06030c]/70 px-8 py-4 backdrop-blur-lg md:flex">
            <div>
              <h1 className="font-display text-base font-bold tracking-wide text-purple-50">{title}</h1>
              <p className="mt-0.5 text-xs text-purple-200/50">OBSIDIAN &apos;26 · Freshers 2K26 · Unfold the Unknown</p>
            </div>
            <div className="flex items-center gap-4">
              {admin?.role === "VOLUNTEER" && (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.15)]">
                  <Shield className="h-3 w-3 text-amber-400" />
                  VOLUNTEER · READ ONLY
                </span>
              )}
              <span className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/8 px-3 py-1">
                <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/80">Live</span>
              </span>
              <span className="hidden font-mono text-xs tabular-nums text-purple-200/60 md:inline">
                {now ? now.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
              </span>
            </div>
          </header>

          <main className="obs-scrollbar flex-1 overflow-x-hidden px-4 py-6 sm:px-6 md:px-8 md:py-8">
            <div className="mb-5 flex items-center justify-between md:hidden">
              <div>
                <h1 className="font-display text-base font-bold tracking-wide text-purple-50">{title}</h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-purple-200/50">
                  <span className="obs-live-dot h-1.5 w-1.5 rounded-full bg-purple-400" />
                  Live {now ? now.toLocaleTimeString("en-IN", { hour12: false }) : ""}
                </p>
              </div>
              {admin?.role === "VOLUNTEER" && (
                <span className="flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200">
                  <Shield className="h-2.5 w-2.5 text-amber-400" />
                  READ ONLY
                </span>
              )}
            </div>
            {children}
          </main>

          <footer className="mt-auto border-t border-purple-500/15 bg-[#06030c]/70 px-6 py-3.5 text-center text-[10px] uppercase tracking-[0.22em] text-purple-200/35">
            OBSIDIAN &apos;26 · Smart QR Entry System {admin && <>· {admin.role === "ADMIN" ? "Organizer" : "Volunteer (Read Only)"}</>}
          </footer>
        </div>
      </div>
    </div>
  );
}

export { KeyRound };
