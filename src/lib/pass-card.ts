"use client";

/**
 * Per-student E-INVITE PASS CARD — branded PNG rendered client-side on canvas.
 *
 * The embedded QR encodes the student's personal invite link
 * (/#/verify?id=OBS26-xxx) which pre-fills the verification form, so a junior
 * can scan their own pass and land one tap away from check-in.
 */

import QRCode from "qrcode";
import type { StudentRow } from "./types";

export function inviteUrlFor(studentId: string): string {
  if (typeof window === "undefined") return `/#/verify?id=${encodeURIComponent(studentId)}`;
  const { origin } = window.location;
  return `${origin}/#/verify?id=${encodeURIComponent(studentId)}`;
}

export function whatsappInviteUrl(name: string, studentId: string): string {
  const text =
    `✦ OBSIDIAN '26 — Unfold the Unknown ✦\n\n` +
    `Hey! Your smart-entry pass for OBSIDIAN '26 is ready.\n` +
    `Name: ${name}\nID: ${studentId}\n\n` +
    `Tap your personal entry link and verify in seconds:\n${inviteUrlFor(studentId)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const W = 1000;
const H = 1400;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Convert a hex color + alpha to an rgba() string. */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export interface PassCardOptions {
  student: StudentRow;
  eventName?: string;
  tagline?: string;
}

/** Resolve the app's loaded display / body font families for canvas use. */
function resolvedFonts(): { display: string; body: string } {
  if (typeof document === "undefined") {
    return { display: "'Arial Black', sans-serif", body: "'Trebuchet MS', sans-serif" };
  }
  const probe = document.createElement("span");
  probe.className = "font-display";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const display = getComputedStyle(probe).fontFamily || "'Arial Black', sans-serif";
  probe.remove();
  const body = getComputedStyle(document.body).fontFamily || "'Trebuchet MS', sans-serif";
  return { display, body };
}

export async function generatePassCardBlob(opts: PassCardOptions): Promise<Blob> {
  const { student } = opts;
  const eventName = opts.eventName ?? "OBSIDIAN '26";
  const tagline = opts.tagline ?? "UNFOLD THE UNKNOWN";

  // make sure the brand webfonts are ready before we paint
  try {
    await document.fonts.ready;
  } catch {
    /* older browsers — fall back silently */
  }
  const F = resolvedFonts();
  const fontDisplay = (size: number, weight = 800): string => `${weight} ${size}px ${F.display}`;
  const fontBody = (size: number, weight = 600): string => `${weight} ${size}px ${F.body}`;
  const fontMono = (size: number, weight = 700): string => `${weight} ${size}px 'Courier New', monospace`;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // ---- backdrop ------------------------------------------------------------
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0518");
  bg.addColorStop(0.55, "#0d0718");
  bg.addColorStop(1, "#120826");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ambient purple glows
  const glow1 = ctx.createRadialGradient(760, 260, 40, 760, 260, 420);
  glow1.addColorStop(0, rgba("#a855f7", 0.28));
  glow1.addColorStop(1, rgba("#a855f7", 0));
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(180, 1150, 40, 180, 1150, 460);
  glow2.addColorStop(0, rgba("#7c3aed", 0.22));
  glow2.addColorStop(1, rgba("#7c3aed", 0));
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // faint contour rings
  ctx.save();
  ctx.strokeStyle = rgba("#a855f7", 0.1);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(W / 2, 430, 330 + i * 70, 120 + i * 34, -0.16, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ---- outer frame ----------------------------------------------------------
  roundRect(ctx, 28, 28, W - 56, H - 56, 34);
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, rgba("#c084fc", 0.75));
  frame.addColorStop(0.5, rgba("#7c3aed", 0.4));
  frame.addColorStop(1, rgba("#c084fc", 0.75));
  ctx.strokeStyle = frame;
  ctx.lineWidth = 3;
  ctx.stroke();
  roundRect(ctx, 42, 42, W - 84, H - 84, 26);
  ctx.strokeStyle = rgba("#a855f7", 0.25);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ---- header ---------------------------------------------------------------
  ctx.textAlign = "center";

  // diamond glyph
  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.rotate(Math.PI / 4);
  const dGrad = ctx.createLinearGradient(-20, -20, 20, 20);
  dGrad.addColorStop(0, "#d8b4fe");
  dGrad.addColorStop(1, "#7c3aed");
  ctx.fillStyle = dGrad;
  ctx.shadowColor = rgba("#a855f7", 0.9);
  ctx.shadowBlur = 26;
  roundRect(ctx, -17, -17, 34, 34, 7);
  ctx.fill();
  ctx.restore();

  const eventText = eventName.toUpperCase();
  let evSize = 92;
  ctx.font = fontDisplay(evSize);
  while (ctx.measureText(eventText).width > W - 180 && evSize > 44) {
    evSize -= 2;
    ctx.font = fontDisplay(evSize);
  }
  ctx.fillStyle = "#f3eaff";
  ctx.shadowColor = rgba("#a855f7", 0.55);
  ctx.shadowBlur = 34;
  ctx.fillText(eventText, W / 2, 300);
  ctx.shadowBlur = 0;

  ctx.font = fontBody(26);
  ctx.fillStyle = rgba("#d8b4fe", 0.85);
  const spaced = tagline.split("").join(" ");
  ctx.fillText(spaced, W / 2, 356);

  // divider
  const div = ctx.createLinearGradient(140, 0, W - 140, 0);
  div.addColorStop(0, rgba("#a855f7", 0));
  div.addColorStop(0.5, rgba("#a855f7", 0.7));
  div.addColorStop(1, rgba("#a855f7", 0));
  ctx.fillStyle = div;
  ctx.fillRect(140, 396, W - 280, 2);

  // ---- attendee block ---------------------------------------------------------
  ctx.font = fontBody(22, 700);
  ctx.fillStyle = rgba("#d8b4fe", 0.6);
  ctx.fillText("A T T E N D E E   P A S S", W / 2, 452);

  // name (auto-shrink to fit)
  let nameSize = 64;
  ctx.font = fontDisplay(nameSize);
  while (ctx.measureText(student.name).width > W - 220 && nameSize > 30) {
    nameSize -= 2;
    ctx.font = fontDisplay(nameSize);
  }
  const nameGrad = ctx.createLinearGradient(0, 480, 0, 560);
  nameGrad.addColorStop(0, "#ffffff");
  nameGrad.addColorStop(1, "#d8b4fe");
  ctx.fillStyle = nameGrad;
  ctx.fillText(student.name, W / 2, 540);

  // ID pill
  const idText = student.studentId;
  ctx.font = fontMono(30);
  const idW = ctx.measureText(idText).width + 76;
  roundRect(ctx, (W - idW) / 2, 572, idW, 58, 29);
  ctx.fillStyle = rgba("#a855f7", 0.14);
  ctx.fill();
  ctx.strokeStyle = rgba("#c084fc", 0.55);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#e9d5ff";
  ctx.fillText(idText, W / 2, 612);

  // dept / year chips
  const chips = [
    student.department ? student.department.toUpperCase() : null,
    student.year ? student.year.toUpperCase() : null,
  ].filter(Boolean) as string[];
  if (chips.length > 0) {
    ctx.font = fontBody(21, 700);
    const chipH = 44;
    const gap = 18;
    const widths = chips.map((c) => ctx.measureText(c).width + 52);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let cx = (W - totalW) / 2;
    chips.forEach((c, i) => {
      roundRect(ctx, cx, 660, widths[i], chipH, 22);
      ctx.fillStyle = rgba("#7c3aed", 0.16);
      ctx.fill();
      ctx.strokeStyle = rgba("#a855f7", 0.35);
      ctx.stroke();
      ctx.fillStyle = "#d8b4fe";
      ctx.fillText(c, cx + widths[i] / 2, 689);
      cx += widths[i] + gap;
    });
  }

  // ---- QR -------------------------------------------------------------------
  const invite = inviteUrlFor(student.studentId);
  const qrData = await QRCode.toDataURL(invite, {
    margin: 1,
    width: 560,
    errorCorrectionLevel: "H",
    color: { dark: "#170a30", light: "#ffffff" },
  });
  const qr = await loadImage(qrData);
  const qrSize = 380;
  const qx = (W - qrSize) / 2;
  const qy = 760;

  // QR glow + white card
  ctx.save();
  ctx.shadowColor = rgba("#a855f7", 0.55);
  ctx.shadowBlur = 46;
  roundRect(ctx, qx - 18, qy - 18, qrSize + 36, qrSize + 36, 30);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, qx - 18, qy - 18, qrSize + 36, qrSize + 36, 30);
  ctx.strokeStyle = rgba("#c084fc", 0.8);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.drawImage(qr, qx, qy, qrSize, qrSize);

  // corner ticks around QR
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 4;
  const t = 30;
  const off = 44;
  const corners: Array<[number, number, number, number]> = [
    [qx - off, qy - off, 1, 1],
    [qx + qrSize + off, qy - off, -1, 1],
    [qx - off, qy + qrSize + off, 1, -1],
    [qx + qrSize + off, qy + qrSize + off, -1, -1],
  ];
  corners.forEach(([x, y, sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * t, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * t);
    ctx.stroke();
  });

  ctx.font = fontBody(24, 800);
  ctx.fillStyle = rgba("#e9d5ff", 0.9);
  ctx.fillText("S C A N   ·   V E R I F Y   ·   S T E P   I N", W / 2, qy + qrSize + 100);

  // ---- footer -----------------------------------------------------------------
  ctx.font = fontBody(20, 500);
  ctx.fillStyle = rgba("#d8b4fe", 0.45);
  ctx.fillText(
    "Present this pass at the venue gate · OBSIDIAN '26 Smart QR Entry",
    W / 2,
    H - 92
  );

  // status ribbon
  if (student.checkedIn) {
    ctx.save();
    ctx.translate(W - 118, 132);
    ctx.rotate(0.6);
    const ribbonW = 300;
    const grad = ctx.createLinearGradient(-ribbonW / 2, 0, ribbonW / 2, 0);
    grad.addColorStop(0, "#059669");
    grad.addColorStop(1, "#10b981");
    ctx.fillStyle = grad;
    ctx.fillRect(-ribbonW / 2, -26, ribbonW, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = fontBody(26, 800);
    ctx.fillText("CHECKED IN", 0, 9);
    ctx.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG encode failed"));
    }, "image/png");
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("QR image load failed"));
    img.src = src;
  });
}

export async function downloadPassCard(opts: PassCardOptions): Promise<void> {
  const blob = await generatePassCardBlob(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `obsidian26-pass-${opts.student.studentId}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
