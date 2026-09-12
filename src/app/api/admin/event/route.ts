import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getEventSettings } from '@/lib/qr'
import type { EventStatus, EventStatusResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID: EventStatus[] = ['OPEN', 'PAUSED', 'CLOSED']

/** GET current gate status (any signed-in admin/volunteer). */
export async function GET(): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  const settings = await getEventSettings()
  const status: EventStatus =
    settings.status === 'PAUSED' ? 'PAUSED' : settings.status === 'CLOSED' ? 'CLOSED' : 'OPEN'
  const payload: EventStatusResponse = {
    ok: true,
    status,
    eventName: settings.eventName,
    tagline: settings.tagline,
  }
  return NextResponse.json(payload)
}

/** PATCH the gate status — admins only. */
export async function PATCH(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin(['ADMIN'])
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as { status?: unknown }
    const requested = String(body?.status ?? '').toUpperCase() as EventStatus
    if (!VALID.includes(requested)) {
      return NextResponse.json(
        { ok: false, message: 'Status must be OPEN, PAUSED or CLOSED.' },
        { status: 400 }
      )
    }
    const settings = await getEventSettings()
    await db.eventSettings.update({ where: { id: settings.id }, data: { status: requested } })
    const payload: EventStatusResponse = {
      ok: true,
      status: requested,
      eventName: settings.eventName,
      tagline: settings.tagline,
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[event-status] update failed:', err)
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
