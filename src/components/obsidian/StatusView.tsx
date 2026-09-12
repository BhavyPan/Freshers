"use client";

/**
 * MY ENTRY — the student's personal live status mini-page.
 *
 * Reached from the printed receipt QR or a shared link (/#/status?id=…).
 * Shows the student's live check-in state (polled every 15 s), the organizer's
 * live announcement, their gate QR and one-tap share actions — all
 * privacy-safe (no mobile / email ever leaves the server for this page).
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  BadgeCheck,
  CircleUserRound,
  Clock,
  Copy,
  Download,
  Flame,
  House,
  IdCard,
  Info,
  Loader2,
  MessageCircle,
  PauseCircle,
  QrCode,
  ScanLine,
  SearchX,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  downloadPassCard,
  statusUrlFor,
  whatsappEntryUrl,
} from "@/lib/pass-card";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { EventStatusBadge } from "./EventStatusBadge";

/** Read the ?id= param out of the current hash (hydration-safe on mount). */
function readIdFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const query = window.location.hash.split("?")[1] ?? "";
  const raw = new URLSearchParams(query).get("id");
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  // mirror the server's format guard loosely — 3–40 safe chars
  if (!/^[A-Z0-9._/-]{3,40}$/.test(trimmed)) return null;
  return trimmed;
}

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy · h:mm a");
  } catch {
    return iso ?? "—";
  }
}

export function StatusView({ onHome }: { onHome: () => void }) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [passBusy, setPassBusy] = useState(false);
  const { toast } = useToast();

  // pull the personal id out of the hash after mount (no SSR mismatch) and
  // keep it in sync so navigating between two status links just works
  useEffect(() => {
    const sync = () => setStudentId(readIdFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    document.title = "My Entry — OBSIDIAN '26";
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["entry-status", studentId],
    queryFn: () => api.entryStatus(studentId as string),
    enabled: !!studentId,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  // personal gate QR (invite prefill link) rendered client-side
  useEffect(() => {
    if (!studentId) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(
      typeof window === "undefined"
        ? `/#/verify?id=${encodeURIComponent(studentId)}`
        : `${window.location.origin}/#/verify?id=${encodeURIComponent(studentId)}`,
      { margin: 1, width: 320, errorCorrectionLevel: "M", color: { dark: "#1a0b2e", light: "#ffffff" } }
    )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const inside = data?.found === true && data.checkedIn === true;
  const gate = data?.event?.status ?? "OPEN";
  const shareUrl = useMemo(
    () => (studentId ? statusUrlFor(studentId) : ""),
    [studentId]
  );

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => toast({ title: "Link copied", description: "Your personal entry page link." }))
      .catch(() =>
        toast({ title: "Copy failed", description: "Long-press the address bar to copy.", variant: "destructive" })
      );
  }

  async function savePass() {
    if (!data?.found || !data.student || passBusy) return;
    setPassBusy(true);
    try {
      await downloadPassCard({
        student: {
          id: data.student.studentId,
          studentId: data.student.studentId,
          name: data.student.name,
          mobile: null,
          department: data.student.department,
          email: null,
          year: data.student.year,
          checkedIn: data.checkedIn ?? false,
          checkinAt: data.checkinAt ?? null,
          checkinBy: null,
          createdAt: new Date().toISOString(),
          attempts: 0,
        },
        eventName: data.event?.name,
        tagline: data.event?.tagline,
      });
      toast({ title: "Pass saved", description: "Your branded e-invite pass was downloaded." });
    } catch {
      toast({ title: "Could not render pass", description: "Please try again.", variant: "destructive" });
    } finally {
      setPassBusy(false);
    }
  }

  /* ---------- no id in the link ---------- */
  if (!studentId) {
    return (
      <Centered>
        <EmptyCard
          icon={<SearchX className="h-9 w-9 text-purple-300/70" />}
          title="NO PASS LINK FOUND"
          body="This page needs your personal pass link — the one printed on your entry receipt or sent with your invite. Scanned the venue QR by mistake?"
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button onClick={onHome} variant="outline" className="obs-glow-btn h-11 rounded-xl border-purple-400/40 bg-transparent px-5 text-purple-100 hover:bg-purple-500/15">
              <House className="mr-2 h-4 w-4" /> Back to the portal
            </Button>
            <a href="#/verify" className="obs-glow-btn inline-flex h-11 items-center justify-center rounded-xl border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 px-5 font-semibold text-white transition-all hover:brightness-110">
              <ScanLine className="mr-2 h-4 w-4" /> Verify an ID instead
            </a>
          </div>
        </EmptyCard>
      </Centered>
    );
  }

  /* ---------- loading ---------- */
  if (isLoading || !data) {
    return (
      <Centered>
        <div className="obs-card w-full max-w-md space-y-4 rounded-2xl p-7">
          <Skeleton className="mx-auto h-20 w-20 rounded-full bg-purple-500/10" />
          <Skeleton className="mx-auto h-6 w-44 bg-purple-500/10" />
          <Skeleton className="mx-auto h-4 w-32 bg-purple-500/10" />
          <Skeleton className="h-24 w-full rounded-xl bg-purple-500/10" />
          <p className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.24em] text-purple-200/40">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your pass…
          </p>
        </div>
      </Centered>
    );
  }

  /* ---------- not found ---------- */
  if (!data.found) {
    return (
      <Centered>
        {data.event?.announcement && <AnnouncementBanner text={data.event.announcement} compact />}
        <EmptyCard
          tone="rose"
          icon={<SearchX className="h-9 w-9 text-rose-300/80" />}
          title="PASS NOT FOUND"
          body={
            data.message ??
            "We couldn't find this ID in the official registration list. Double-check the link, or verify manually."
          }
        >
          <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <a href="#/verify" className="obs-glow-btn inline-flex h-11 items-center justify-center rounded-xl border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 px-5 font-semibold text-white transition-all hover:brightness-110">
              <ScanLine className="mr-2 h-4 w-4" /> Verify manually
            </a>
            <Button onClick={onHome} variant="outline" className="h-11 rounded-xl border-rose-400/40 bg-transparent px-5 text-rose-100 hover:bg-rose-500/10">
              <House className="mr-2 h-4 w-4" /> Portal home
            </Button>
          </div>
        </EmptyCard>
      </Centered>
    );
  }

  const student = data.student!;

  return (
    <div className="relative flex min-h-svh flex-col items-center px-5 py-10">
      {data.event?.announcement && <AnnouncementBanner text={data.event.announcement} />}

      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className={`relative mt-4 w-full max-w-md overflow-hidden rounded-2xl border p-6 sm:p-8 ${
          inside
            ? "border-emerald-400/40 bg-gradient-to-b from-[#07231b]/95 to-[#0a0514]/95 shadow-[0_0_55px_rgba(16,185,129,0.22)]"
            : "border-purple-400/45 bg-gradient-to-b from-[#1b0d38]/95 to-[#0a0514]/95 shadow-[0_0_55px_rgba(147,51,234,0.3)]"
        }`}
      >
        {/* top glow bar */}
        <div
          className={`absolute inset-x-0 top-0 h-1 ${
            inside
              ? "bg-gradient-to-r from-transparent via-emerald-300 to-transparent"
              : "bg-gradient-to-r from-transparent via-purple-300 to-transparent"
          }`}
        />

        {/* header */}
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-purple-200/50">
            <CircleUserRound className="h-3.5 w-3.5" /> My entry
          </p>
          {data.event && <EventStatusBadge status={data.event.status} />}
        </div>

        {/* status ring + headline */}
        <div className="mt-6 flex flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {/* rotating conic ring — inside = emerald, pending = purple */}
            <span
              className={`obs-status-ring absolute inset-0 rounded-full ${inside ? "obs-status-ring-in" : "obs-status-ring-pending"}`}
              aria-hidden="true"
            />
            <span
              className={`relative flex h-[76px] w-[76px] items-center justify-center rounded-full border ${
                inside
                  ? "border-emerald-300/40 bg-emerald-500/12"
                  : "border-purple-300/45 bg-purple-500/15"
              }`}
            >
              {inside ? (
                <BadgeCheck className="h-11 w-11 text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
              ) : gate === "PAUSED" ? (
                <PauseCircle className="h-10 w-10 text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]" />
              ) : (
                <IdCard className="h-10 w-10 text-purple-200 drop-shadow-[0_0_12px_rgba(192,132,252,0.8)]" />
              )}
            </span>
          </div>

          <h1
            className={`font-display mt-5 text-xl font-black tracking-wide sm:text-2xl ${
              inside ? "text-emerald-200" : "obs-gradient-text obs-text-glow"
            }`}
          >
            {inside ? "YOU'RE INSIDE" : gate === "PAUSED" ? "ENTRY PAUSED" : gate === "CLOSED" ? "GATE CLOSED" : "PASS READY"}
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-purple-100/60">
            {inside
              ? `${student.name.split(" ")[0]}, you're checked in to ${data.event?.name ?? "OBSIDIAN '26"}. Show this page at any gate if staff re-check your wristband.`
              : gate === "PAUSED"
                ? "The door is paused for a moment — your pass is valid, hang tight and refresh in a bit."
                : gate === "CLOSED"
                  ? "Entry is closed for tonight. Your pass record stays right here."
                  : `${student.name.split(" ")[0]}, your pass is live. One verify away from stepping in.`}
          </p>

          {/* identity chips */}
          <div className="mt-5 grid w-full grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-purple-500/20 bg-[#0c0618]/80 px-2 py-2.5">
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-purple-300/50">Name</p>
              <p className="mt-1 truncate text-[13px] font-bold text-purple-50" title={student.name}>{student.name}</p>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-[#0c0618]/80 px-2 py-2.5">
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-purple-300/50">Student ID</p>
              <p className="mt-1 truncate font-mono text-[13px] font-semibold text-purple-100">{student.studentId}</p>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-[#0c0618]/80 px-2 py-2.5">
              <p className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-purple-300/50">Dept / Year</p>
              <p className="mt-1 truncate text-[13px] font-semibold text-purple-100">
                {student.department ?? "—"}{student.year ? ` · ${student.year.replace(/\s*year/i, "").trim()}` : ""}
              </p>
            </div>
          </div>

          {/* entry facts / CTA */}
          {inside ? (
            <div className="mt-4 w-full space-y-2.5">
              <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.07] px-4 py-3">
                <Clock className="h-4 w-4 shrink-0 text-emerald-300" />
                <span className="text-xs text-emerald-100/85">
                  Entered at <span className="font-semibold text-emerald-100">{fmtTime(data.checkinAt)}</span>
                </span>
              </div>
              {data.checkinByLabel && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/20 bg-[#0c0618]/70 px-4 py-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-purple-300" />
                  <span className="text-xs text-purple-100/75">{data.checkinByLabel}</span>
                </div>
              )}
              {typeof data.inside === "number" && typeof data.totalRegistered === "number" && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                    <Users className="h-3 w-3" /> {data.inside}/{data.totalRegistered} inside
                  </span>
                  {!!data.checkedInLastHour && data.checkedInLastHour > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
                      <Flame className="h-3 w-3" /> +{data.checkedInLastHour} this hour
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            gate === "OPEN" && (
              <a href={`#/verify?id=${encodeURIComponent(student.studentId)}`} className="obs-glow-btn mt-5 flex h-12 w-full items-center justify-center rounded-xl border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 text-base font-semibold text-white transition-all hover:brightness-110">
                <ScanLine className="mr-2 h-4.5 w-4.5" /> Verify &amp; step in
              </a>
            )
          )}

          {/* gate paused/closed note for not-yet-inside students */}
          {!inside && gate !== "OPEN" && (
            <div className="mt-4 w-full rounded-xl border border-amber-400/30 bg-amber-500/[0.07] px-4 py-3 text-center">
              <p className="flex items-center justify-center gap-2 text-xs text-amber-100/85">
                <PauseCircle className="h-4 w-4 shrink-0" />
                {gate === "PAUSED"
                  ? "Organizers paused new entries — your pass stays valid. Check back shortly."
                  : "Entry closed for tonight — reach the registration desk if you're at the gate."}
              </p>
            </div>
          )}
        </div>

        {/* gate QR */}
        <div className="mt-6 rounded-xl border border-purple-500/25 bg-[#0b0517]/70 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-purple-200/60">
              <QrCode className="h-3.5 w-3.5 text-purple-300" /> Gate pass
            </p>
            <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-purple-200/70">
              {inside ? "for re-checks" : "at the door"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative w-fit shrink-0">
              <div className="relative rounded-lg border border-purple-400/40 bg-white p-1.5 shadow-[0_0_24px_rgba(147,51,234,0.25)]">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Personal gate QR code" className="h-24 w-24" width={96} height={96} />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  </div>
                )}
                {(["-top-1.5 -left-1.5 border-t-2 border-l-2", "-top-1.5 -right-1.5 border-t-2 border-r-2", "-bottom-1.5 -left-1.5 border-b-2 border-l-2", "-bottom-1.5 -right-1.5 border-b-2 border-r-2"] as const).map((pos) => (
                  <span key={pos} className={`absolute h-4 w-4 rounded-sm border-purple-400 ${pos}`} />
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-purple-100/85">Scan to open your pass</p>
              <p className="mt-1 text-[11px] leading-relaxed text-purple-200/50">
                Opens this same page on any phone — staff can re-confirm your entry in one scan.
              </p>
              <p className="mt-1.5 font-mono text-[9.5px] text-purple-300/40" title={dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : undefined}>
                live · refreshes every 15s
              </p>
            </div>
          </div>
        </div>

        {/* share row */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <a
            href={whatsappEntryUrl(student.name, student.studentId, !!inside)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.08] px-3 py-2.5 text-[11px] font-semibold text-emerald-200 transition-all hover:border-emerald-300/60 hover:bg-emerald-500/15 hover:shadow-[0_0_18px_rgba(16,185,129,0.2)]"
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-purple-400/30 bg-purple-500/[0.08] px-3 py-2.5 text-[11px] font-semibold text-purple-200 transition-all hover:border-purple-300/60 hover:bg-purple-500/15 hover:shadow-[0_0_18px_rgba(147,51,234,0.2)]"
          >
            <Copy className="h-3.5 w-3.5" /> Copy link
          </button>
          <button
            onClick={() => void savePass()}
            disabled={passBusy}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2.5 text-[11px] font-semibold text-amber-200 transition-all hover:border-amber-300/60 hover:bg-amber-500/15 hover:shadow-[0_0_18px_rgba(245,158,11,0.2)] disabled:opacity-50"
          >
            {passBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Pass PNG
          </button>
        </div>
      </motion.div>

      {/* home link */}
      <Button
        onClick={onHome}
        variant="ghost"
        className="mt-5 rounded-full border border-purple-500/20 px-5 text-[11px] uppercase tracking-[0.2em] text-purple-200/55 hover:bg-purple-500/10 hover:text-purple-100"
      >
        <House className="mr-2 h-3.5 w-3.5" /> Portal home
      </Button>

      <p className="mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-purple-200/30">
        <Info className="h-3 w-3" /> {data.event?.name ?? "OBSIDIAN '26"} · Smart QR Entry
      </p>
    </div>
  );
}

/* ---------- shared shells ---------- */

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-svh flex-col items-center justify-center px-5 py-10">{children}</div>;
}

function EmptyCard({
  icon,
  title,
  body,
  children,
  tone = "purple",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
  tone?: "purple" | "rose";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`obs-card relative w-full max-w-md overflow-hidden rounded-2xl p-8 text-center ${
        tone === "rose"
          ? "border-rose-500/35 shadow-[0_0_45px_rgba(225,29,72,0.18)]"
          : ""
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${
          tone === "rose" ? "bg-gradient-to-r from-transparent via-rose-400 to-transparent" : "bg-gradient-to-r from-transparent via-purple-300 to-transparent"
        }`}
      />
      <div className="flex justify-center">
        <span
          className={`flex h-20 w-20 items-center justify-center rounded-full border ${
            tone === "rose" ? "border-rose-400/35 bg-rose-500/10" : "border-purple-400/35 bg-purple-500/10"
          }`}
        >
          {icon}
        </span>
      </div>
      <h1 className={`font-display mt-5 text-xl font-black tracking-wide ${tone === "rose" ? "text-rose-200" : "text-purple-100"}`}>
        {title}
      </h1>
      <p className="mt-2.5 text-sm leading-relaxed text-purple-100/60">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </motion.div>
  );
}
