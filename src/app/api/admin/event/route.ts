import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { buildAnnouncementHistory, getEventSettings, parseAnnouncementHistory } from '@/lib/qr'
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
    announcementExpiresAt: settings.announcementExpiresAt
      ? settings.announcementExpiresAt.toISOString()
      : null,
    announcementHistory: parseAnnouncementHistory(settings.announcementHistory),
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
    const body = (await req.json()) as {
      status?: unknown
      announcement?: unknown
      expiresInMinutes?: unknown
    }
    const settings = await getEventSettings()
    const data: {
      status?: string
      announcement?: string | null
      announcementExpiresAt?: Date | null
    } = {}

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

    let clearsAnnouncement = false
    if (body?.announcement !== undefined) {
      if (body.announcement === null) {
        data.announcement = null
        clearsAnnouncement = true
      } else {
        const text = String(body.announcement ?? '').trim().slice(0, 200)
        data.announcement = text === '' ? null : text
        if (data.announcement === null) clearsAnnouncement = true
        else data.announcementHistory = buildAnnouncementHistory(settings.announcementHistory, text)
      }
    }

    if (body?.expiresInMinutes !== undefined) {
      if (body.expiresInMinutes === null) {
        data.announcementExpiresAt = null
      } else {
        const minutes = Number(body.expiresInMinutes)
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
          return NextResponse.json(
            { ok: false, message: 'expiresInMinutes must be between 0 and 1440.' },
            { status: 400 }
          )
        }
        // expiry anchors at "now" — both for fresh broadcasts and for extending
        // the currently live notice; minutes=0 clears the schedule
        const anchor = new Date()
        data.announcementExpiresAt =
          minutes === 0 ? null : new Date(anchor.getTime() + minutes * 60 * 1000)
      }
      const effectiveAnnouncement =
        data.announcement !== undefined ? data.announcement : settings.announcement
      if (data.announcementExpiresAt && !effectiveAnnouncement) {
        return NextResponse.json(
          { ok: false, message: 'Broadcast an announcement before scheduling an expiry.' },
          { status: 400 }
        )
      }
    }

    // clearing the announcement also clears any schedule
    if (clearsAnnouncement && data.announcementExpiresAt === undefined) {
      data.announcementExpiresAt = null
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
      announcementExpiresAt: updated.announcementExpiresAt
        ? updated.announcementExpiresAt.toISOString()
        : null,
      announcementHistory: parseAnnouncementHistory(updated.announcementHistory),
    }
    return NextResponse.json(payload)
  } catch (err) {
    console.error('[event-status] update failed:', err)
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
