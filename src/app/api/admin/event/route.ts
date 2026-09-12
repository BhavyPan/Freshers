import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getEventSettings } from '@/lib/qr'
import type { EventStatus, EventStatusResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID: EventStatus[] = ['OPEN', 'PAUSED', 'CLOSED']

/** GET current gate status + announcement (any signed-in admin/volunteer). */
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
    announcement: settings.announcement ?? null,
  }
  return NextResponse.json(payload)
}

/** PATCH the gate status and/or live announcement — admins only. */
export async function PATCH(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin(['ADMIN'])
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as { status?: unknown; announcement?: unknown }
    const settings = await getEventSettings()
    const data: { status?: string; announcement?: string | null } = {}

    if (body?.status !== undefined) {
      const requested = String(body.status ?? '').toUpperCase() as EventStatus
      if (!VALID.includes(requested)) {
        return NextResponse.json(
          { ok: false, message: 'Status must be OPEN, PAUSED or CLOSED.' },
          { status: 400 }
        )
      }
      data.status = requested
    }

    if (body?.announcement !== undefined) {
      if (body.announcement === null) {
        data.announcement = null
      } else {
        const text = String(body.announcement ?? '').trim().slice(0, 200)
        data.announcement = text === '' ? null : text
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, message: 'Nothing to update.' }, { status: 400 })
    }

    const updated = await db.eventSettings.update({ where: { id: settings.id }, data })
    const status: EventStatus =
      updated.status === 'PAUSED' ? 'PAUSED' : updated.status === 'CLOSED' ? 'CLOSED' : 'OPEN'
    const payload: EventStatusResponse = {
      ok: true,
      status,
      eventName: updated.eventName,
      tagline: updated.tagline,
      announcement: updated.announcement ?? null,
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[event-status] update failed:', err)
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
