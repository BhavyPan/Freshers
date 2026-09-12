"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  MonitorPlay,
  PauseCircle,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  ScanLine,
  Share2,
  Shield,
  Sparkles,
  TimerOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api, qrDownloadUrl } from "@/lib/api-client";
import { useObsidianStore } from "@/lib/client-store";
import type { EventStatus } from "@/lib/types";
import { EventStatusBadge } from "./EventStatusBadge";
import { cn } from "@/lib/utils";

/** One-tap announcement drafts for frantic event moments. */
const ANNOUNCEMENT_PRESETS: { icon: string; label: string; text: string }[] = [
  {
    icon: "🚪",
    label: "Doors open",
    text: "Doors are fully open — come straight in, juniors! Entry takes under 30 seconds.",
  },
  {
    icon: "↗️",
    label: "Line moved",
    text: "The entry line has moved to Gate B — follow the purple flags.",
  },
  {
    icon: "🎓",
    label: "ID reminder",
    text: "Keep your college ID handy — you'll need your Student ID at the verification screen.",
  },
  {
    icon: "🎪",
    label: "Stage call",
    text: "Opening ceremony starts in 10 minutes at the main stage — head inside now!",
  },
];

/** Auto-clear choices for a live announcement (null = stays until cleared). */
const EXPIRY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Until cleared" },
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
];

/** Contextual one-tap notices offered right after a gate-status change. */
const GATE_SUGGESTIONS: { status: EventStatus; text: string }[] = [
  {
    status: "PAUSED",
    text: "We've paused entry for a few minutes — hold tight at the gate, we'll reopen shortly.",
  },
  {
    status: "PAUSED",
    text: "The line is long — entry paused briefly. Please stay in the queue, doors reopen soon!",
  },
  {
    status: "CLOSED",
    text: "Entry is closed for tonight — thank you for coming, juniors! See you at the next one.",
  },
  {
    status: "OPEN",
    text: "Doors are now fully open — walk right in, the night awaits! \u2728",
  },
];

function expiryCountdown(expiresAt: string | null, now: number | null): string | null {
  if (!expiresAt || now === null) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m left";
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}

export function QRView() {
  const admin = useObsidianStore((s) => s.admin);
  const isAdmin = admin?.role === "ADMIN";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showToken, setShowToken] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [settingStatus, setSettingStatus] = useState<EventStatus | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState<string | null>(null);
  const [expiryChoice, setExpiryChoice] = useState<number | null>(15);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [nowTs, setNowTs] = useState<number | null>(null);
  const [suggestBusy, setSuggestBusy] = useState<string | null>(null);
  const [settingSecurity, setSettingSecurity] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
    setNowTs(Date.now());
    const t = setInterval(() => setNowTs(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["qr"],
    queryFn: () => api.qr(),
    refetchOnWindowFocus: true,
  });

  async function handleRotate() {
    setRotating(true);
    try {
      await api.qrRegenerate();
      await refetch();
      await qc.invalidateQueries({ queryKey: ["qr"] });
      toast({ title: "Event token rotated", description: "A fresh QR was generated. Reprint and replace the venue QR." });
    } catch (err) {
      toast({ title: "Rotation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setRotating(false);
      setConfirmRotate(false);
    }
  }

  async function handleStatus(next: EventStatus) {
    if (!data || next === data.event.status) return;
    setSettingStatus(next);
    try {
      await api.setEventStatus(next);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["qr"] });
      toast({
        title: `Gate ${next === "OPEN" ? "opened" : next === "PAUSED" ? "paused" : "closed"}`,
        description:
          next === "OPEN"
            ? "Juniors can verify and check in again."
            : "New verifications now receive a themed PAUSED/CLOSED screen.",
      });
    } catch (err) {
      toast({ title: "Could not update gate", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSettingStatus(null);
    }
  }

  async function saveAnnouncement() {
    if (announcementDraft === null) return;
    setSavingAnnouncement(true);
    try {
      const text = announcementDraft.trim() === "" ? null : announcementDraft.trim();
      const res = await api.setAnnouncement(text, expiryChoice);
      setAnnouncementDraft(null);
      await qc.invalidateQueries({ queryKey: ["qr"] });
      await qc.invalidateQueries({ queryKey: ["pulse"] });
      toast({
        title: res.announcement ? "Announcement live" : "Announcement cleared",
        description: res.announcement
          ? res.announcementExpiresAt
            ? `Every public screen shows it — auto-clears in ${(expiryCountdown(res.announcementExpiresAt, Date.now()) ?? "a moment").replace(/ left$/, "")}.`
            : "Every public screen shows it within seconds."
          : "Public screens no longer show a notice.",
      });
    } catch (err) {
      toast({ title: "Could not save announcement", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function handleQrSecurity(enabled: boolean) {
    if (!isAdmin || settingSecurity) return;
    setSettingSecurity(true);
    try {
      await api.setQrSecurity(enabled);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["qr"] });
      toast({
        title: enabled ? "Official QR enforcement enabled" : "Official QR enforcement disabled",
        description: enabled
          ? "Missing and rotated venue tokens are now blocked from self check-in."
          : "Direct entry links can verify without a venue token.",
      });
    } catch (err) {
      toast({
        title: "Could not update QR security",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSettingSecurity(false);
    }
  }

  /** One-tap contextual notice from the gate-status strip. */
  async function broadcastSuggested(text: string) {
    if (suggestBusy) return;
    setSuggestBusy(text);
    try {
      await api.setAnnouncement(text, null);
      await qc.invalidateQueries({ queryKey: ["qr"] });
      await qc.invalidateQueries({ queryKey: ["pulse"] });
      toast({ title: "Announcement live", description: "Every public screen shows it within seconds." });
    } catch (err) {
      toast({ title: "Could not broadcast", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSuggestBusy(null);
    }
  }

  function copyUrl() {
    if (!data?.url) return;
    navigator.clipboard
      .writeText(data.url)
      .then(() => toast({ title: "URL copied", description: data.url }))
      .catch(() => toast({ title: "Copy failed", description: "Long-press the URL to copy manually.", variant: "destructive" }));
  }

  function inviteText(url: string) {
    return `\u{1F30C} OBSIDIAN '26 — Unfold the Unknown\n\nFreshers 2K26 smart entry portal:\n${url}\n\nScan the venue QR or open the link, enter your Student ID, and you're in. See you at the door! \u2728`;
  }

  function shareWhatsApp() {
    if (!data?.url) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText(data.url))}`, "_blank", "noopener");
  }

  async function nativeShare() {
    if (!data?.url) return;
    try {
      await navigator.share({
        title: "OBSIDIAN '26 — Smart QR Entry",
        text: `OBSIDIAN '26 Freshers 2K26 — check in here:`,
        url: data.url,
      });
    } catch {
      /* user dismissed — ignore */
    }
  }

  function copyInvite() {
    if (!data?.url) return;
    navigator.clipboard
      .writeText(inviteText(data.url))
      .then(() => toast({ title: "Invite copied", description: "Paste it into any WhatsApp group or DM." }))
      .catch(() => toast({ title: "Copy failed", description: "Try again or copy the URL instead.", variant: "destructive" }));
  }

  if (isLoading || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[420px] rounded-2xl bg-purple-500/10" />
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-2xl bg-purple-500/10" />
          <Skeleton className="h-40 rounded-2xl bg-purple-500/10" />
        </div>
      </div>
    );
  }

  const masked = data.token.slice(0, 4) + "•".repeat(Math.max(0, data.token.length - 8)) + data.token.slice(-4);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* QR preview card */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="obs-card rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <QrCode className="h-4.5 w-4.5 text-purple-300" />
          <p className="text-sm font-semibold text-purple-100">Official Venue QR</p>
          {data.event.status && (
            <EventStatusBadge status={data.event.status} className="ml-auto" />
          )}
          {isFetching && <Loader2 className={cn("h-3.5 w-3.5 text-purple-400/60", data.event.status ? "ml-2" : "ml-auto")} />}
        </div>

        {/* QR with corner brackets */}
        <div className="relative mx-auto w-fit">
          <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-purple-600/25 via-transparent to-fuchsia-600/20 blur-lg" />
          <div className="relative rounded-2xl border border-purple-400/40 bg-white p-4 shadow-[0_0_45px_rgba(147,51,234,0.3)]">
            <img src={data.qrDataUrl} alt="OBSIDIAN '26 venue entry QR code" className="h-56 w-56 sm:h-64 sm:w-64" width={256} height={256} />
            {/* corner brackets */}
            {(["-top-2.5 -left-2.5 border-t-2 border-l-2", "-top-2.5 -right-2.5 border-t-2 border-r-2", "-bottom-2.5 -left-2.5 border-b-2 border-l-2", "-bottom-2.5 -right-2.5 border-b-2 border-r-2"] as const).map((pos) => (
              <span key={pos} className={`absolute h-6 w-6 rounded-sm border-purple-400 ${pos}`} />
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-purple-200/60">
            <ScanLine className="h-3.5 w-3.5 text-purple-300" /> Scan to enter
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-purple-500/25 bg-[#0b0517]/80 px-4 py-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-purple-100/90">{data.url}</code>
            <Button size="icon" variant="ghost" onClick={copyUrl} className="h-7 w-7 shrink-0 text-purple-300 hover:bg-purple-500/15" aria-label="Copy URL">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <button
            onClick={() => setShowToken((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-purple-300/60 transition-colors hover:text-purple-200"
          >
            <Eye className="h-3 w-3" />
            token: {showToken ? data.token : masked}
            {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      </motion.div>

      {/* actions + guide */}
      <div className="space-y-6">
        {/* gate control */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="obs-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2.5 text-sm font-semibold text-purple-100">
              <Radio className="h-4.5 w-4.5 text-purple-300" /> Entry gate control
            </p>
            {data.event.status && <EventStatusBadge status={data.event.status} />}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-purple-200/55">
            Pause entry during peak-hour surges or close the doors for the night — the venue QR keeps working, but new
            verifications see a themed PAUSED / CLOSED screen instead of a check-in.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2.5" role="group" aria-label="Entry gate status">
            {(
              [
                { value: "OPEN", label: "Open", icon: Radio, active: "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" },
                { value: "PAUSED", label: "Paused", icon: PauseCircle, active: "border-amber-400/60 bg-amber-500/15 text-amber-200" },
                { value: "CLOSED", label: "Closed", icon: Lock, active: "border-rose-400/60 bg-rose-500/15 text-rose-200" },
              ] as const
            ).map((opt) => {
              const isActive = data.event.status === opt.value;
              const busy = settingStatus === opt.value;
              return isAdmin ? (
                <button
                  key={opt.value}
                  onClick={() => handleStatus(opt.value)}
                  disabled={settingStatus !== null}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all disabled:opacity-50",
                    isActive
                      ? opt.active
                      : "border-purple-500/25 bg-[#0b0514]/70 text-purple-200/55 hover:border-purple-400/50 hover:text-purple-100"
                  )}
                  aria-pressed={isActive}
                >
                  {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <opt.icon className="h-4.5 w-4.5" />}
                  {opt.label}
                </button>
              ) : (
                <div
                  key={opt.value}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-[11px] font-bold uppercase tracking-[0.14em]",
                    isActive ? opt.active : "border-purple-500/25 bg-[#0b0514]/70 text-purple-200/40"
                  )}
                >
                  <opt.icon className="h-4.5 w-4.5" />
                  {opt.label}
                </div>
              );
            })}
          </div>
          {!isAdmin && <p className="mt-3 text-[11px] text-purple-200/40">Gate control is available to admins only.</p>}

          {/* contextual suggested notices — appears with the matching gate state */}
          {isAdmin &&
            (() => {
              const live = data.announcement?.trim() ?? "";
              const isGateTrouble = data.event.status !== "OPEN";
              const chips = GATE_SUGGESTIONS.filter(
                (s) =>
                  s.status === data.event.status &&
                  (isGateTrouble ? s.text !== live : live === "")
              );
              if (chips.length === 0) return null;
              return (
                <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.05] p-3.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80">
                    <Sparkles className="h-3 w-3" />
                    Suggested notice — gate {data.event.status.toLowerCase()}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-purple-200/50">
                    Tell everyone at the gate why. One tap broadcasts to the landing page, verify screen and kiosk.
                  </p>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {chips.map((s) => (
                      <button
                        key={s.text}
                        onClick={() => broadcastSuggested(s.text)}
                        disabled={suggestBusy !== null}
                        className="group flex items-center gap-2.5 rounded-lg border border-amber-400/25 bg-[#170e04]/60 px-3 py-2.5 text-left transition-all hover:border-amber-300/60 hover:bg-amber-500/10 hover:shadow-[0_0_16px_rgba(245,158,11,0.15)] disabled:opacity-50"
                      >
                        <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-300/80" />
                        <span className="min-w-0 flex-1 text-[11px] leading-snug text-amber-100/85">{s.text}</span>
                        {suggestBusy === s.text ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-300" />
                        ) : (
                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-amber-300/70 transition-colors group-hover:text-amber-200">
                            broadcast
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
        </motion.div>

        {/* live announcement */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="obs-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2.5 text-sm font-semibold text-purple-100">
              <Megaphone className="h-4.5 w-4.5 text-amber-300" /> Live announcement
            </p>
            {data.announcement ? (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" /> live
                {expiryCountdown(data.announcementExpiresAt, nowTs) && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] tracking-[0.08em] text-amber-300/90 normal-case">
                    <Clock className="h-2.5 w-2.5" />
                    {expiryCountdown(data.announcementExpiresAt, nowTs)}
                  </span>
                )}
              </span>
            ) : (
              <span className="rounded-full border border-purple-500/25 bg-purple-500/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/50">off</span>
            )}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-purple-200/55">
            Broadcast a one-line notice to every public screen — entry page and verification page. Perfect for
            “Line moved to Gate B” moments. Optionally auto-clear after a window so stale notices never outlive
            their moment.
          </p>

          {isAdmin ? (
            <div className="mt-4 space-y-2.5">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick announcement presets">
                {ANNOUNCEMENT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setAnnouncementDraft(p.text)}
                    disabled={savingAnnouncement}
                    title={p.text}
                    className="rounded-full border border-purple-500/25 bg-purple-500/8 px-3 py-1 text-[10px] font-semibold text-purple-200/75 transition-all hover:border-amber-300/50 hover:bg-amber-500/10 hover:text-amber-200 disabled:opacity-50"
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
              {(data.announcementHistory?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Recent broadcasts — tap to re-post">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-200/45">
                    <History className="h-3 w-3" /> recent
                  </span>
                  {data.announcementHistory.map((h) => {
                    const isLive = h.text === data.announcement;
                    return (
                      <button
                        key={h.at + h.text.slice(0, 12)}
                        type="button"
                        onClick={() => setAnnouncementDraft(h.text)}
                        disabled={savingAnnouncement}
                        title={`“${h.text}” — broadcast ${(() => {
                          try {
                            return formatDistanceToNow(new Date(h.at), { addSuffix: true });
                          } catch {
                            return h.at;
                          }
                        })()}. Tap to load into the editor.`}
                        className={cn(
                          "group inline-flex max-w-[240px] items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-medium transition-all disabled:opacity-50 sm:max-w-[280px]",
                          isLive
                            ? "border-amber-300/60 bg-amber-500/15 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                            : "border-amber-300/20 bg-amber-500/[0.06] text-amber-100/70 hover:border-amber-300/60 hover:bg-amber-500/15 hover:text-amber-100"
                        )}
                      >
                        {isLive && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" aria-label="currently live" />}
                        <span className="min-w-0 flex-1 truncate">{h.text}</span>
                        <span className="shrink-0 whitespace-nowrap text-[9px] tabular-nums text-purple-200/40 transition-colors group-hover:text-amber-200/70">
                          {(() => {
                            try {
                              return formatDistanceToNow(new Date(h.at), { addSuffix: true });
                            } catch {
                              return "";
                            }
                          })()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <textarea
                value={announcementDraft ?? data.announcement ?? ""}
                onChange={(e) => setAnnouncementDraft(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="e.g. Line for CSE juniors has moved to Gate B — follow the purple flags."
                aria-label="Announcement text"
                className="w-full resize-none rounded-xl border border-purple-500/30 bg-[#0b0517]/90 px-4 py-3 text-sm leading-relaxed text-purple-50 placeholder:text-purple-200/25 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-400/20"
              />
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Auto-clear schedule">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-purple-200/45">
                  <TimerOff className="h-3 w-3" /> auto-clear
                </span>
                {EXPIRY_OPTIONS.map((opt) => {
                  const isActive = expiryChoice === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setExpiryChoice(opt.value)}
                      disabled={savingAnnouncement}
                      aria-pressed={isActive}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide transition-all disabled:opacity-50",
                        isActive
                          ? "border-amber-300/60 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.18)]"
                          : "border-purple-500/25 bg-[#0b0514]/70 text-purple-200/55 hover:border-amber-300/40 hover:text-amber-200/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] tabular-nums text-purple-200/40">
                  {(announcementDraft ?? data.announcement ?? "").length}/200
                </p>
                <div className="flex gap-2">
                  {(data.announcement || (announcementDraft !== null && announcementDraft.trim() !== "")) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingAnnouncement || (announcementDraft ?? data.announcement ?? "").trim() === ""}
                      onClick={() => setAnnouncementDraft("")}
                      className="border-purple-500/30 text-xs text-purple-200/70"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Clear
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={
                      savingAnnouncement ||
                      announcementDraft === null ||
                      announcementDraft.trim() === (data.announcement ?? "").trim()
                    }
                    onClick={saveAnnouncement}
                    className="obs-glow-btn bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 text-xs text-white"
                  >
                    {savingAnnouncement ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                    Broadcast
                  </Button>
                </div>
              </div>
            </div>
          ) : data.announcement ? (
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3">
              <p className="text-sm text-amber-100">“{data.announcement}”</p>
              {expiryCountdown(data.announcementExpiresAt, nowTs) && (
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300/70">
                  <Clock className="h-3 w-3" /> auto-clears · {expiryCountdown(data.announcementExpiresAt, nowTs)}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-purple-200/40">No notice is live. Only admins can broadcast.</p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="obs-card rounded-2xl p-6">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-purple-100">
            <Download className="h-4.5 w-4.5 text-purple-300" /> Download print-ready assets
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(
              [
                { format: "png", label: "PNG", desc: "1024px image", icon: Download },
                { format: "svg", label: "SVG", desc: "vector", icon: FileText },
                { format: "pdf", label: "PDF", desc: "A4 poster", icon: Printer },
              ] as const
            ).map((d) => (
              <a
                key={d.format}
                href={qrDownloadUrl(d.format)}
                download
                className="obs-card-hover group flex flex-col items-center gap-1.5 rounded-xl border border-purple-500/25 bg-[#0b0514]/70 p-4 text-center"
              >
                <d.icon className="h-5 w-5 text-purple-300 transition-transform group-hover:scale-110" />
                <span className="text-sm font-bold text-purple-50">{d.label}</span>
                <span className="text-[10px] text-purple-200/50">{d.desc}</span>
              </a>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-purple-200/45">
            The PDF poster includes OBSIDIAN &apos;26 branding and the entry URL — print it, stick it at the venue entrance,
            and juniors are one scan away.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="obs-card rounded-2xl p-6">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-purple-100">
            <Share2 className="h-4.5 w-4.5 text-emerald-300" /> Share the entry link
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-purple-200/55">
            Blast the portal to class groups before the doors open — juniors who pre-open the link breeze through at the desk.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              onClick={shareWhatsApp}
              className="obs-glow-btn h-11 flex-1 rounded-xl border border-emerald-400/40 bg-emerald-600/90 text-sm font-semibold text-white hover:bg-emerald-500 sm:flex-none sm:px-6"
            >
              <MessageCircle className="mr-2 h-4.5 w-4.5" />
              WhatsApp
            </Button>
            {canNativeShare && (
              <Button
                onClick={nativeShare}
                variant="outline"
                className="h-11 flex-1 rounded-xl border-purple-500/35 text-sm font-semibold text-purple-100 hover:bg-purple-500/15 sm:flex-none sm:px-6"
              >
                <Share2 className="mr-2 h-4 w-4" />
                More…
              </Button>
            )}
            <Button
              onClick={copyInvite}
              variant="outline"
              className="h-11 flex-1 rounded-xl border-purple-500/35 text-sm font-semibold text-purple-100 hover:bg-purple-500/15 sm:flex-none sm:px-6"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy invite
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="obs-card rounded-2xl p-6">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-purple-100">
            <Shield className="h-4.5 w-4.5 text-purple-300" /> QR security — rotating event token
          </p>
          <div className="mt-4 space-y-3 text-[12px] leading-relaxed text-purple-200/60">
            <p>
              Every QR embeds a secret event token. If a screenshot gets forwarded on WhatsApp, rotate the token —
              secure mode rejects scans from the old QR and records the attempt in the audit trail.
            </p>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-100">Require the official venue QR</p>
                <p className="mt-1 text-[10px] leading-relaxed text-amber-200/55">
                  When enabled, direct or stale public links cannot self check-in.
                </p>
              </div>
              <Switch
                checked={data.requireQrToken}
                onCheckedChange={(checked) => void handleQrSecurity(checked)}
                disabled={!isAdmin || settingSecurity}
                aria-label="Require the current official venue QR"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(data.kioskUrl)
                  .then(() => toast({ title: "Secure kiosk link copied" }))
                  .catch(() => toast({ title: "Copy failed", variant: "destructive" }));
              }}
              className="w-full border-purple-500/30 text-purple-100 hover:bg-purple-500/10"
            >
              <MonitorPlay className="mr-2 h-3.5 w-3.5" /> Copy tokenized kiosk link
            </Button>
            <div className="flex items-center justify-between rounded-xl border border-purple-500/20 bg-[#0b0517]/70 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-purple-300/60">Current token</p>
                <p className="mt-0.5 font-mono text-xs text-purple-100/90">{showToken ? data.token : masked}</p>
              </div>
              {isAdmin && (
                <Button
                  onClick={() => setConfirmRotate(true)}
                  disabled={rotating}
                  variant="outline"
                  size="sm"
                  className="border-amber-400/40 bg-amber-500/10 text-xs text-amber-200 hover:bg-amber-500/20"
                >
                  {rotating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                  Rotate
                </Button>
              )}
            </div>
            {!isAdmin && (
              <p className="text-[11px] text-purple-200/40">Token rotation is available to admins only.</p>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
          <p className="text-sm font-semibold text-purple-100">Setup checklist</p>
          <ol className="mt-3 space-y-2.5">
            {[
              "Download the PDF (or PNG) and print it at a visible size (≥ 20 cm).",
              "Place it at the main entrance and registration desk.",
              "Juniors scan → land on the 3D portal → enter their ID → check-in is recorded live.",
              "If the QR leaks, rotate the token and reprint.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-purple-200/60">
                <span className="font-display mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-[9px] font-bold text-purple-200">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </motion.div>
      </div>

      {/* rotate confirm */}
      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent className="obs-card border-amber-500/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display flex items-center gap-2 text-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-400" /> Rotate event token?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-purple-200/70">
              The old QR becomes invalid immediately. When official-QR enforcement is enabled, outdated scans are
              blocked and audited. Reprint and replace the venue QR afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-purple-500/30 text-purple-200">Keep current</AlertDialogCancel>
            <AlertDialogAction onClick={handleRotate} className="bg-amber-600 text-white hover:bg-amber-500">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rotate now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
