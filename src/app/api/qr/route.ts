import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getBaseUrl, getEventSettings, qrDataUrl } from '@/lib/qr'
import type { EventStatus, QrResponse } from '@/lib/types'

export async function GET(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const settings = await getEventSettings()
    const url = `${getBaseUrl(req)}/?t=${settings.eventToken}`
    const dataUrl = await qrDataUrl(url, 512)
    const status: EventStatus =
      settings.status === 'PAUSED' ? 'PAUSED' : settings.status === 'CLOSED' ? 'CLOSED' : 'OPEN'
    return NextResponse.json({
      ok: true,
      event: { name: settings.eventName, tagline: settings.tagline, status },
      token: settings.eventToken,
      url,
      qrDataUrl: dataUrl,
      generatedAt: new Date().toISOString(),
      announcement: settings.announcement ?? null,
    } satisfies QrResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
