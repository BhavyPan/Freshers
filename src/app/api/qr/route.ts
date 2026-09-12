import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getBaseUrl, getEventSettings, parseAnnouncementHistory, qrDataUrl } from '@/lib/qr'
import type { EventStatus, QrResponse } from '@/lib/types'

export async function GET(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const settings = await getEventSettings()
    const baseUrl = getBaseUrl(req)
    const url = baseUrl + '/?t=' + settings.eventToken
    const kioskUrl = baseUrl + '/?t=' + settings.eventToken + '#/kiosk'
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
      requireQrToken: settings.requireQrToken,
      kioskUrl,
      announcement: settings.announcement ?? null,
      announcementExpiresAt: settings.announcementExpiresAt
        ? settings.announcementExpiresAt.toISOString()
        : null,
      announcementHistory: parseAnnouncementHistory(settings.announcementHistory),
    } satisfies QrResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
