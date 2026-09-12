import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getBaseUrl, getEventSettings, qrDataUrl } from '@/lib/qr'
import type { QrResponse } from '@/lib/types'

export async function POST(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  if (guard.user.role !== 'ADMIN') {
    return NextResponse.json(
      { ok: false, message: 'Only admins can regenerate the event QR code' },
      { status: 403 }
    )
  }
  try {
    const settings = await getEventSettings()
    const eventToken = randomBytes(16).toString('hex')
    const updated = await db.eventSettings.update({
      where: { id: settings.id },
      data: { eventToken },
    })
    const url = `${getBaseUrl(req)}/?t=${updated.eventToken}`
    const dataUrl = await qrDataUrl(url, 512)
    return NextResponse.json({
      ok: true,
      event: { name: updated.eventName, tagline: updated.tagline },
      token: updated.eventToken,
      url,
      qrDataUrl: dataUrl,
      generatedAt: new Date().toISOString(),
    } satisfies QrResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
