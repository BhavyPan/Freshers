import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeStudentId, isValidStudentId } from '@/lib/normalize'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getEventSettings } from '@/lib/qr'
import type { EventStatus, EntryStatusResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Public "My Entry" status — the personal mini-page a student reaches from
 * their receipt QR / invite link. Privacy stance: returns only what is
 * already printed on the student's own pass (name, ID, dept, year, entry
 * state). Never exposes mobile or email. Rate limited per IP so the link
 * can be shared without becoming an oracle.
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const ip = getClientIp(req)
    const rateLimit = await checkRateLimit(`status:${ip}`, 30, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, found: false, message: 'Too many requests — slow down a little.' } satisfies EntryStatusResponse,
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))) } }
      )
    }

    const rawId = new URL(req.url).searchParams.get('id') ?? ''
    const lookupId = normalizeStudentId(rawId)
    if (!isValidStudentId(lookupId)) {
      return NextResponse.json(
        { ok: true, found: false, message: 'This link is missing a valid Student ID.' } satisfies EntryStatusResponse
      )
    }

    const [settings, student] = await Promise.all([
      getEventSettings(),
      db.student.findUnique({
        where: { studentId: lookupId },
        select: {
          studentId: true,
          name: true,
          department: true,
          year: true,
          checkedIn: true,
          checkinAt: true,
          checkinBy: true,
        },
      }),
    ])

    const status: EventStatus =
      settings.status === 'PAUSED' ? 'PAUSED' : settings.status === 'CLOSED' ? 'CLOSED' : 'OPEN'

    const event = {
      name: settings.eventName,
      tagline: settings.tagline,
      status,
      announcement: settings.announcement?.trim() ? settings.announcement.trim().slice(0, 200) : null,
      announcementExpiresAt: settings.announcementExpiresAt
        ? settings.announcementExpiresAt.toISOString()
        : null,
    }

    if (!student) {
      return NextResponse.json(
        {
          ok: true,
          found: false,
          message: "We couldn't find this ID in the official registration list.",
          event,
        } satisfies EntryStatusResponse
      )
    }

    const [inside, totalRegistered, checkedInLastHour] = await Promise.all([
      db.student.count({ where: { checkedIn: true } }),
      db.student.count(),
      db.student.count({
        where: { checkedIn: true, checkinAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      }),
    ])

    // Human phrasing for how they got in (matches the audit attribution)
    const checkinByLabel = !student.checkinAt
      ? null
      : student.checkinBy && student.checkinBy !== 'SELF'
        ? 'Checked in at the desk'
        : 'Self scan at the venue QR'

    return NextResponse.json(
      {
        ok: true,
        found: true,
        student: {
          studentId: student.studentId,
          name: student.name,
          department: student.department,
          year: student.year,
        },
        checkedIn: student.checkedIn,
        checkinAt: student.checkinAt ? student.checkinAt.toISOString() : null,
        checkinByLabel,
        event,
        inside,
        totalRegistered,
        checkedInLastHour,
      } satisfies EntryStatusResponse,
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ ok: false, found: false } satisfies EntryStatusResponse, { status: 500 })
  }
}
