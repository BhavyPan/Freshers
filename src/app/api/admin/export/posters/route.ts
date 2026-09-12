import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getBaseUrl, getEventSettings, qrPngBuffer } from '@/lib/qr'
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'

export const dynamic = 'force-dynamic'

/**
 * DEPT DOOR POSTERS — printable A4 venue signage, one page per department.
 *
 * Print the pack and stick each page on the door its squad lines up at: a huge
 * department header, the official venue entry QR (token-stamped, safe to
 * rotate), a queue line, and a live headcount so volunteers can shout the
 * right numbers. `dept=ALL` renders every department as one pack.
 */

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
    const url = new URL(req.url)
    const deptParam = (url.searchParams.get('dept') ?? 'ALL').trim().toUpperCase()
    const deptFilter = deptParam === 'ALL' ? {} : { department: deptParam }

    const [settings, deptRows, insideRows] = await Promise.all([
      getEventSettings(),
      db.student.groupBy({ by: ['department'], _count: { _all: true }, where: deptFilter }),
      db.student.groupBy({
        by: ['department'],
        _count: { _all: true },
        where: { checkedIn: true, ...deptFilter },
      }),
    ])

    const insideMap = new Map<string, number>()
    for (const row of insideRows) insideMap.set(row.department ?? 'Unknown', row._count._all)

    const depts = deptRows
      .map((r) => ({
        dept: r.department ?? 'GENERAL',
        total: r._count._all,
        inside: insideMap.get(r.department ?? 'Unknown') ?? 0,
      }))
      .sort((a, b) => a.dept.localeCompare(b.dept))

    if (depts.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'No departments match — nothing to print.' },
        { status: 404 }
      )
    }

    const base = getBaseUrl(req)
    const eventUrl = `${base}/?t=${settings.eventToken}`
    const qrPng = await qrPngBuffer(eventUrl, 1024)

    const pdfDoc = await PDFDocument.create()
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const qrImage = await pdfDoc.embedPng(qrPng)

    const PAGE_W = 595.28
    const PAGE_H = 841.89
    const purple = rgb(0.42, 0.2, 0.72)
    const violet = rgb(0.61, 0.35, 0.9)
    const deep = rgb(0.11, 0.05, 0.2)
    const gray = rgb(0.44, 0.42, 0.5)
    const softLine = rgb(0.82, 0.76, 0.94)

    const pages = depts.length
    for (let i = 0; i < pages; i++) {
      const { dept, total, inside } = depts[i]
      const page = pdfDoc.addPage([PAGE_W, PAGE_H])
      page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) })

      const M = 36
      // outer frame + inner accent
      page.drawRectangle({
        x: M,
        y: M,
        width: PAGE_W - M * 2,
        height: PAGE_H - M * 2,
        borderColor: purple,
        borderWidth: 2.5,
      })
      page.drawRectangle({
        x: M + 7,
        y: M + 7,
        width: PAGE_W - M * 2 - 14,
        height: PAGE_H - M * 2 - 14,
        borderColor: softLine,
        borderWidth: 1,
      })

      const cx = PAGE_W / 2
      const center = (text: string, font: PDFFont, size: number, y: number, color = deep) => {
        page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color })
      }

      // header band
      page.drawRectangle({ x: M, y: PAGE_H - M - 64, width: PAGE_W - M * 2, height: 64, color: deep })
      const brand = `${settings.eventName.toUpperCase()} · SMART QR ENTRY`
      page.drawText(brand, {
        x: cx - bold.widthOfTextAtSize(brand, 12) / 2,
        y: PAGE_H - M - 27,
        size: 12,
        font: bold,
        color: rgb(0.85, 0.78, 1),
      })
      const tag = settings.tagline.toUpperCase()
      page.drawText(tag, {
        x: cx - regular.widthOfTextAtSize(tag, 9.5) / 2,
        y: PAGE_H - M - 45,
        size: 9.5,
        font: regular,
        color: violet,
      })

      // dept label
      center('DEPARTMENT DOOR', bold, 13, PAGE_H - M - 122, gray)
      let deptSize = 84
      while (bold.widthOfTextAtSize(dept, deptSize) > PAGE_W - M * 2 - 56 && deptSize > 34) {
        deptSize -= 2
      }
      center(dept, bold, deptSize, PAGE_H - M - 218, purple)

      // underline accent
      const uw = bold.widthOfTextAtSize(dept, deptSize)
      page.drawRectangle({
        x: cx - uw / 2,
        y: PAGE_H - M - 234,
        width: uw,
        height: 4,
        color: violet,
      })

      // squad line
      const squad = `${dept} JUNIORS — YOUR DOOR IS HERE`
      center(squad, bold, 14.5, PAGE_H - M - 268, deep)

      // QR block with corner ticks
      const qrSize = 300
      const qx = cx - qrSize / 2
      const qy = PAGE_H - M - 300 - 300
      page.drawRectangle({
        x: qx - 14,
        y: qy - 14,
        width: qrSize + 28,
        height: qrSize + 28,
        borderColor: purple,
        borderWidth: 1.5,
      })
      page.drawImage(qrImage, { x: qx, y: qy, width: qrSize, height: qrSize })
      const t = 26
      const off = 30
      const corners: Array<[number, number, number, number]> = [
        [qx - off, qy + qrSize + off, 1, -1],
        [qx + qrSize + off, qy + qrSize + off, -1, -1],
        [qx - off, qy - off, 1, 1],
        [qx + qrSize + off, qy - off, -1, 1],
      ]
      for (const [x, y, sx, sy] of corners) {
        page.drawLine({ start: { x, y }, end: { x: x + sx * t, y }, thickness: 3, color: purple })
        page.drawLine({ start: { x, y }, end: { x, y: y + sy * t }, thickness: 3, color: purple })
      }

      center('SCAN TO CHECK IN', bold, 21, qy - 46, purple)
      center('or type your Student ID at the kiosk — entry takes 30 seconds', regular, 11, qy - 68, gray)

      // live headcount chip (clear of the scan line and the footer)
      const chip = `${inside}/${total} ALREADY INSIDE`
      const chipW = bold.widthOfTextAtSize(chip, 12) + 44
      page.drawRectangle({
        x: cx - chipW / 2,
        y: 92,
        width: chipW,
        height: 34,
        borderColor: purple,
        borderWidth: 1.2,
      })
      page.drawText(chip, {
        x: cx - bold.widthOfTextAtSize(chip, 12) / 2,
        y: 103,
        size: 12,
        font: bold,
        color: purple,
      })

      // footer
      const footer = `Generated ${new Date().toLocaleString('en-IN')} · door poster ${i + 1} of ${pages} · ${settings.eventName}`
      page.drawText(truncateToWidth(footer, regular, 8, PAGE_W - M * 2 - 20), {
        x: M + 10,
        y: M + 14,
        size: 8,
        font: regular,
        color: gray,
      })
    }

    const bytes = await pdfDoc.save()
    const label = deptParam === 'ALL' ? 'all-departments' : deptParam.toLowerCase()
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="obsidian26-door-posters-${label}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[door-posters] failed:', err)
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
