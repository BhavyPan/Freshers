"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  PauseCircle,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  ScanLine,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function QRView() {
  const admin = useObsidianStore((s) => s.admin);
  const isAdmin = admin?.role === "ADMIN";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showToken, setShowToken] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [settingStatus, setSettingStatus] = useState<EventStatus | null>(null);

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

  function copyUrl() {
    if (!data?.url) return;
    navigator.clipboard
      .writeText(data.url)
      .then(() => toast({ title: "URL copied", description: data.url }))
      .catch(() => toast({ title: "Copy failed", description: "Long-press the URL to copy manually.", variant: "destructive" }));
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
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14, delay: 0.08 }} animate={{ opacity: 1, y: 0 }} className="obs-card rounded-2xl p-6">
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

        <motion.div initial={{ opacity: 0, y: 14, delay: 0.16 }} animate={{ opacity: 1, y: 0 }} className="obs-card rounded-2xl p-6">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-purple-100">
            <Shield className="h-4.5 w-4.5 text-purple-300" /> QR security — rotating event token
          </p>
          <div className="mt-4 space-y-3 text-[12px] leading-relaxed text-purple-200/60">
            <p>
              Every QR embeds a secret event token. If a screenshot gets forwarded on WhatsApp, rotate the token —
              new scans from the old QR get flagged in the audit trail while still verifying.
            </p>
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

        <motion.div initial={{ opacity: 0, y: 14, delay: 0.24 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
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
              The old QR stops being marked valid. Students scanning a forwarded/outdated QR will still be verified, but
              the attempt is flagged in the audit trail. You must reprint and replace the venue QR afterwards.
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
