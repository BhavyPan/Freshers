import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getBaseUrl, getEventSettings, qrPngBuffer, qrPosterPdf, qrSvgString } from '@/lib/qr'

export async function GET(req: Request): Promise<NextResponse | Response> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const format = (new URL(req.url).searchParams.get('format') ?? 'png').trim().toLowerCase()
    const settings = await getEventSettings()
    const url = `${getBaseUrl(req)}/?t=${settings.eventToken}`

    if (format === 'svg') {
      const svg = await qrSvgString(url, 1024)
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': 'attachment; filename="obsidian26-qr.svg"',
        },
      })
    }
    if (format === 'pdf') {
      const pdf = await qrPosterPdf(url, settings.eventName, settings.tagline)
      return new Response(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="obsidian26-qr.pdf"',
        },
      })
    }

    const png = await qrPngBuffer(url, 1024)
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="obsidian26-qr.png"',
      },
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
