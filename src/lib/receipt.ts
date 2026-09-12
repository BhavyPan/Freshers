"use client";

/**
 * ENTRY RECEIPT — printable proof-of-entry ticket, rendered client-side.
 *
 * A light-themed (print-friendly) receipt with the attendee's details, entry
 * timestamp and a re-verify QR, delivered straight to the browser print
 * dialog through a hidden iframe. Works on the verify result screen and the
 * door kiosk — anywhere a junior just checked in and wants a physical slip.
 */

import QRCode from "qrcode";
import { statusUrlFor } from "./pass-card";

export interface ReceiptData {
  studentId: string;
  name: string;
  department?: string | null;
  year?: string | null;
  /** ISO timestamp of the (first) entry. */
  checkinAt?: string | null;
  status: "GRANTED" | "ALREADY_CHECKED_IN";
  eventName?: string;
  tagline?: string;
  /** Where the receipt was printed from — shown as the entry method. */
  source?: "verify" | "kiosk";
}

/** Deterministic short receipt number from the student ID + entry time. */
function receiptNumber(data: ReceiptData): string {
  const seed = `${data.studentId}|${data.checkinAt ?? ""}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  return `R-${h.toString(36).toUpperCase().padStart(7, "0")}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function buildReceiptHtml(data: ReceiptData, qrDataUrl: string): string {
  const eventName = esc((data.eventName ?? "OBSIDIAN '26").toUpperCase());
  const tagline = esc((data.tagline ?? "UNFOLD THE UNKNOWN").toUpperCase());
  const name = esc(data.name);
  const sid = esc(data.studentId);
  const dept = esc(data.department || "—");
  const year = esc(data.year || "—");
  const time = esc(fmtTime(data.checkinAt));
  const method = data.source === "kiosk" ? "Front desk · kiosk" : "Self scan · venue QR";
  const statusLabel = data.status === "GRANTED" ? "ADMITTED" : "ALREADY INSIDE";
  const statusTone = data.status === "GRANTED" ? "#059669" : "#b45309";
  const receiptNo = receiptNumber(data);
  const issued = esc(fmtTime(new Date().toISOString()));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>OBSIDIAN '26 — Entry Receipt ${receiptNo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #f4f1fa; }
  body {
    font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
    color: #1c1428;
    display: flex;
    justify-content: center;
    padding: 24px 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket {
    width: 400px;
    background: #ffffff;
    border: 1.5px solid #d8ccef;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 10px 34px rgba(76, 29, 149, 0.16);
  }
  .head {
    background: linear-gradient(120deg, #4c1d95 0%, #7c3aed 55%, #a855f7 100%);
    color: #ffffff;
    padding: 20px 22px 17px;
    position: relative;
  }
  .head .kicker {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.34em;
    opacity: 0.85;
  }
  .head h1 {
    font-family: "Arial Black", Arial, sans-serif;
    font-size: 27px;
    letter-spacing: 0.04em;
    margin-top: 5px;
  }
  .head .tagline {
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.42em;
    opacity: 0.8;
    margin-top: 4px;
  }
  .head .no {
    position: absolute;
    top: 18px;
    right: 20px;
    text-align: right;
    font-size: 9.5px;
    line-height: 1.5;
    opacity: 0.92;
  }
  .head .no b {
    display: block;
    font-family: "Courier New", monospace;
    font-size: 12.5px;
    letter-spacing: 0.06em;
  }
  .stamp {
    position: absolute;
    right: 18px;
    bottom: -17px;
    background: #ffffff;
    color: ${statusTone};
    border: 2px solid ${statusTone};
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.22em;
    padding: 7px 14px;
  }
  .body { padding: 30px 22px 18px; }
  .name {
    font-family: "Arial Black", Arial, sans-serif;
    font-size: 20px;
    color: #2a1b45;
  }
  .sid {
    font-family: "Courier New", monospace;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: #6d28d9;
    margin-top: 3px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px 14px;
    margin-top: 16px;
  }
  .cell .lbl {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: #8b7fa8;
  }
  .cell .val {
    font-size: 12.5px;
    font-weight: 700;
    margin-top: 2px;
  }
  .cell.wide { grid-column: span 2; }
  .tear {
    border-top: 2px dashed #cbbcf0;
    margin: 16px 22px 14px;
    position: relative;
  }
  .tear::before, .tear::after {
    content: "";
    position: absolute;
    top: -9px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #f4f1fa;
    border: 1.5px solid #d8ccef;
  }
  .tear::before { left: -31px; }
  .tear::after { right: -31px; }
  .foot {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 22px 18px;
  }
  .qr {
    flex: 0 0 auto;
    border: 1.5px solid #d8ccef;
    border-radius: 10px;
    padding: 6px;
    background: #ffffff;
  }
  .qr img { display: block; width: 92px; height: 92px; }
  .foot-text { min-width: 0; }
  .foot-text .scan {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #4c1d95;
  }
  .foot-text .hint {
    font-size: 9.5px;
    color: #6f6490;
    line-height: 1.55;
    margin-top: 4px;
  }
  .tail {
    background: #f6f3fc;
    border-top: 1px solid #e6ddf8;
    padding: 10px 22px;
    font-size: 8.5px;
    letter-spacing: 0.06em;
    color: #7c6fa0;
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  @media print {
    html, body { background: #ffffff; }
    body { padding: 0; }
    .ticket { box-shadow: none; width: 100%; max-width: 400px; border-radius: 12px; }
    @page { margin: 10mm; }
  }
</style>
</head>
<body>
  <div class="ticket" role="article" aria-label="Entry receipt">
    <div class="head">
      <div class="kicker">SMART QR ENTRY</div>
      <h1>${eventName}</h1>
      <div class="tagline">${tagline}</div>
      <div class="no">RECEIPT<b>${receiptNo}</b></div>
      <div class="stamp">${statusLabel}</div>
    </div>
    <div class="body">
      <div class="name">${name}</div>
      <div class="sid">${sid}</div>
      <div class="grid">
        <div class="cell"><div class="lbl">DEPARTMENT</div><div class="val">${dept}</div></div>
        <div class="cell"><div class="lbl">YEAR</div><div class="val">${year}</div></div>
        <div class="cell wide"><div class="lbl">ENTRY TIME</div><div class="val">${time}</div></div>
        <div class="cell wide"><div class="lbl">ENTRY METHOD</div><div class="val">${esc(method)}</div></div>
      </div>
    </div>
    <div class="tear" aria-hidden="true"></div>
    <div class="foot">
      <div class="qr"><img src="${qrDataUrl}" alt="My live entry status QR code" /></div>
      <div class="foot-text">
        <div class="scan">KEEP THIS SLIP</div>
        <div class="hint">Your proof of entry to OBSIDIAN '26. The QR opens your
        live entry page — current status, organizer notices and your gate pass.
        Show it at any gate if staff need to re-confirm your wristband.</div>
      </div>
    </div>
    <div class="tail">
      <span>OBSIDIAN '26 · SMART QR ENTRY</span>
      <span>ISSUED ${issued}</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Render the receipt into a hidden iframe and open the print dialog.
 * Resolves once the dialog has been dismissed (or printing failed silently).
 */
export async function printEntryReceipt(data: ReceiptData): Promise<void> {
  const url = statusUrlFor(data.studentId);
  const qrDataUrl = await QRCode.toDataURL(url, {
    margin: 0,
    width: 220,
    errorCorrectionLevel: "M",
    color: { dark: "#2a1b45", light: "#ffffff" },
  });
  const html = buildReceiptHtml(data, qrDataUrl);

  if (typeof document === "undefined") throw new Error("Receipts need a browser");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Entry receipt print frame");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";

  const printed = new Promise<void>((resolve) => {
    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (win) {
          win.focus();
          win.print();
        }
      } catch {
        /* print dialog unavailable — still clean up */
      }
      // give the print pipeline a beat before tearing the frame down
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 800);
    };
  });

  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  // safety net: never leave an orphan frame behind (e.g. onload never fires)
  setTimeout(() => {
    if (iframe.isConnected) {
      iframe.remove();
      // resolve is idempotent for the consumers below
    }
  }, 15000);

  await printed;
}
