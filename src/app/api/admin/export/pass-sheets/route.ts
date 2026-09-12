import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { getBaseUrl } from '@/lib/qr'
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export const dynamic = 'force-dynamic'

/**
 * BULK PASS SHEETS — a printable A4 PDF grid of per-student invite passes.
 *
 * Every card carries the student's personal invite QR (pre-fills the verify
 * form on scan), name, ID and department — hand them out at the gate or slip
 * them into welcome kits so juniors can self check-in in seconds.
 */

const SCOPES = ['notarrived', 'checkedin', 'full'] as const
type Scope = (typeof SCOPES)[number]

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 28
const HEADER_H = 34
const COLS = 2
const ROWS = 5
const GAP = 12

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let out = text
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

export async function GET(req: Request): Promise<Response> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    await ensureSeeded()
    const url = new URL(req.url)
    const scopeParam = (url.searchParams.get('scope') ?? 'notarrived').trim()
    const scope: Scope = (SCOPES as readonly string[]).includes(scopeParam)
      ? (scopeParam as Scope)
      : 'notarrived'

    const where =
      scope === 'notarrived' ? { checkedIn: false } : scope === 'checkedin' ? { checkedIn: true } : {}
    const students = await db.student.findMany({
      where,
      orderBy: { studentId: 'asc' },
      select: { studentId: true, name: true, department: true, year: true },
    })

    if (students.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'No students match this scope — nothing to print.' },
        { status: 404 }
      )
    }

    const base = getBaseUrl(req)
    const pdfDoc = await PDFDocument.create()
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const courier = await pdfDoc.embedFont(StandardFonts.Courier)

    const purple = rgb(0.42, 0.2, 0.72)
    const deep = rgb(0.16, 0.07, 0.28)
    const gray = rgb(0.44, 0.42, 0.5)
    const line = rgb(0.78, 0.72, 0.9)

    const contentW = PAGE_W - MARGIN * 2
    const cardW = (contentW - GAP * (COLS - 1)) / COLS
    const contentH = PAGE_H - MARGIN - HEADER_H - MARGIN - 14
    const cardH = (contentH - GAP * (ROWS - 1)) / ROWS

    const pages = Math.ceil(students.length / (COLS * ROWS))
    const qrCache = new Map<string, Uint8Array>()

    for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H])
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) })

      // header strip
      page.drawRectangle({
        x: 0,
        y: PAGE_H - HEADER_H,
        width: PAGE_W,
        height: HEADER_H,
        color: deep,
      })
      const headerText = `OBSIDIAN '26 — Entry Pass Sheets (${
        scope === 'notarrived' ? 'Not arrived' : scope === 'checkedin' ? 'Checked in' : 'Full registry'
      })`
      page.drawText(headerText, {
        x: MARGIN,
        y: PAGE_H - HEADER_H + 13,
        size: 11,
        font: bold,
        color: rgb(0.91, 0.86, 1),
      })
      const countText = `${students.length} passes`
      page.drawText(countText, {
        x: PAGE_W - MARGIN - bold.widthOfTextAtSize(countText, 9),
        y: PAGE_H - HEADER_H + 13,
        size: 9,
        font: bold,
        color: rgb(0.78, 0.62, 1),
      })

      const slice = students.slice(pageIndex * COLS * ROWS, (pageIndex + 1) * COLS * ROWS)

      for (let i = 0; i < slice.length; i++) {
        const s = slice[i]
        const col = i % COLS
        const row = Math.floor(i / COLS)
        const x = MARGIN + col * (cardW + GAP)
        const yTop = PAGE_H - HEADER_H - MARGIN - row * (cardH + GAP)
        const y = yTop - cardH

        // card frame
        page.drawRectangle({
          x,
          y,
          width: cardW,
          height: cardH,
          borderColor: line,
          borderWidth: 1,
          borderRadius: 8,
        })
        page.drawRectangle({
          x,
          y: y + cardH - 6,
          width: cardW,
          height: 6,
          color: purple,
          borderRadius: 8,
        })

        // QR (personal invite link)
        const inviteUrl = `${base}/#/verify?id=${encodeURIComponent(s.studentId)}`
        let qrBytes = qrCache.get(inviteUrl)
        if (!qrBytes) {
          const buf = await QRCode.toBuffer(inviteUrl, {
            margin: 1,
            width: 240,
            errorCorrectionLevel: 'M',
            color: { dark: '#1a0b2e', light: '#ffffff' },
          })
          qrBytes = new Uint8Array(buf)
          qrCache.set(inviteUrl, qrBytes)
        }
        const img = await pdfDoc.embedPng(qrBytes)
        const qrSize = cardH - 26
        page.drawRectangle({
          x: x + 12,
          y: y + (cardH - qrSize) / 2 - 4,
          width: qrSize,
          height: qrSize,
          borderRadius: 4,
          borderWidth: 0.8,
          borderColor: line,
        })
        page.drawImage(img, {
          x: x + 14,
          y: y + (cardH - qrSize) / 2 - 2,
          width: qrSize - 4,
          height: qrSize - 4,
        })

        // text block
        const tx = x + qrSize + 22
        const tw = x + cardW - tx - 12
        const nameSize = 13
        page.drawText(truncateToWidth(s.name, bold, nameSize, tw), {
          x: tx,
          y: y + cardH - 34,
          size: nameSize,
          font: bold,
          color: deep,
        })
        page.drawText(s.studentId, {
          x: tx,
          y: y + cardH - 52,
          size: 11,
          font: courier,
          color: purple,
        })
        const meta = [s.department, s.year].filter(Boolean).join(' · ')
        if (meta) {
          page.drawText(truncateToWidth(meta, regular, 9, tw), {
            x: tx,
            y: y + cardH - 68,
            size: 9,
            font: regular,
            color: gray,
          })
        }
        page.drawText('Scan to check in', {
          x: tx,
          y: y + 12,
          size: 8,
          font: bold,
          color: purple,
        })
      }

      const footer = `Generated ${new Date().toLocaleString('en-IN')} · page ${pageIndex + 1} of ${pages} · OBSIDIAN '26 Smart QR Entry`
      page.drawText(footer, {
        x: MARGIN,
        y: MARGIN - 8,
        size: 7.5,
        font: regular,
        color: gray,
      })
    }

    const bytes = await pdfDoc.save()
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="obsidian26-pass-sheets-${scope}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[pass-sheets] failed:', err)
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
