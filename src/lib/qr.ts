import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import type { EventSettings } from '@prisma/client'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'

const QR_DARK = '#1a0b2e'
const QR_LIGHT = '#ffffff'

export function getBaseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function getEventSettings(): Promise<EventSettings> {
  await ensureSeeded()
  const settings = await db.eventSettings.findFirst()
  if (settings) return expireAnnouncement(settings)
  try {
    return await db.eventSettings.create({ data: {} })
  } catch {
    const retry = await db.eventSettings.findFirst()
    if (retry) return expireAnnouncement(retry)
    throw new Error('Event settings unavailable')
  }
}

/**
 * Lazy announcement expiry — if the live notice has an expiry in the past,
 * clear it once (any reader: pulse, QR, event status) and persist the clear so
 * every public screen stops showing it without needing a cron.
 */
async function expireAnnouncement(settings: EventSettings): Promise<EventSettings> {
  const expired =
    settings.announcementExpiresAt &&
    settings.announcement &&
    settings.announcementExpiresAt.getTime() <= Date.now()
  if (!expired) return settings
  try {
    return await db.eventSettings.update({
      where: { id: settings.id },
      data: { announcement: null, announcementExpiresAt: null },
    })
  } catch {
    return { ...settings, announcement: null, announcementExpiresAt: null }
  }
}

/** The announcement history is stored as a JSON string — parse defensively. */
export function parseAnnouncementHistory(raw: string | null | undefined): { text: string; at: string }[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is { text: string; at: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as { text?: unknown }).text === 'string' &&
          typeof (entry as { at?: unknown }).at === 'string'
      )
      .slice(0, 6)
  } catch {
    return []
  }
}

/**
 * Record a broadcast in the announcement history (most recent first, deduped
 * by text so re-posting the same notice just bumps it to the top, capped 6).
 */
export function buildAnnouncementHistory(
  currentRaw: string | null | undefined,
  text: string
): string {
  const existing = parseAnnouncementHistory(currentRaw).filter((e) => e.text !== text)
  return JSON.stringify([{ text, at: new Date().toISOString() }, ...existing].slice(0, 6))
}

export async function buildEventUrl(req: Request): Promise<string> {
  const settings = await getEventSettings()
  return `${getBaseUrl(req)}/?t=${settings.eventToken}`
}

export async function qrDataUrl(url: string, size = 512): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: size,
    errorCorrectionLevel: 'H',
    color: { dark: QR_DARK, light: QR_LIGHT },
  })
}

export async function qrPngBuffer(url: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    margin: 1,
    width: size,
    errorCorrectionLevel: 'H',
    color: { dark: QR_DARK, light: QR_LIGHT },
  })
}

export async function qrSvgString(url: string, size = 1024): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    width: size,
    errorCorrectionLevel: 'H',
    color: { dark: QR_DARK, light: QR_LIGHT },
  })
}

export async function qrPosterPdf(
  url: string,
  eventName: string,
  tagline: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const courier = await pdfDoc.embedFont(StandardFonts.Courier)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const purple = rgb(0.42, 0.2, 0.72)
  const gray = rgb(0.42, 0.42, 0.46)

  const drawCentered = (
    text: string,
    font: PDFFont,
    size: number,
    y: number,
    color: ReturnType<typeof rgb>
  ): void => {
    const width = font.widthOfTextAtSize(text, size)
    page.drawText(text, { x: (pageWidth - width) / 2, y, size, font, color })
  }

  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) })
  page.drawRectangle({
    x: 24,
    y: 24,
    width: pageWidth - 48,
    height: pageHeight - 48,
    borderColor: purple,
    borderWidth: 2,
  })

  drawCentered(eventName, bold, 34, 700, purple)
  drawCentered(tagline, regular, 16, 666, gray)

  const png = await qrPngBuffer(url, 1024)
  const image = await pdfDoc.embedPng(png)
  const qrSize = 360
  page.drawImage(image, {
    x: (pageWidth - qrSize) / 2,
    y: 248,
    width: qrSize,
    height: qrSize,
  })

  drawCentered('SCAN TO ENTER', bold, 22, 202, purple)
  drawCentered(url, courier, 12, 178, gray)
  drawCentered("OBSIDIAN '26 — Smart QR Entry System", regular, 10, 44, gray)

  return pdfDoc.save()
}
