import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { normalizeStudentId, isValidStudentId } from '@/lib/normalize'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { ensureSeeded } from '@/lib/seed'
import { getEventSettings } from '@/lib/qr'
import type { VerifyResponse } from '@/lib/types'

const INVALID_FORMAT_MESSAGE =
  'Please enter a valid Student / College ID (3–40 characters, letters, digits, - / _ .)'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      /* fall through to invalid request */
    }
    const parsed = body as { studentId?: unknown; token?: unknown } | null
    if (typeof parsed?.studentId !== 'string' || parsed.studentId.trim() === '') {
      return NextResponse.json(
        { ok: false, result: 'INVALID', message: 'Invalid request' } satisfies VerifyResponse,
        { status: 400 }
      )
    }

    const rawInput = parsed.studentId
    const token =
      typeof parsed.token === 'string' && parsed.token !== ''
        ? parsed.token
        : new URL(req.url).searchParams.get('t')

    const lookupId = normalizeStudentId(rawInput)
    if (!isValidStudentId(lookupId)) {
      return NextResponse.json(
        { ok: false, result: 'INVALID', message: INVALID_FORMAT_MESSAGE } satisfies VerifyResponse,
        { status: 400 }
      )
    }

    const ip = getClientIp(req)
    const rateLimit = checkRateLimit(`verify:${ip}`)
    if (!rateLimit.allowed) {
      await logAudit({ rawInput, lookupId, result: 'RATE_LIMITED', req })
      return NextResponse.json(
        {
          ok: false,
          result: 'RATE_LIMITED',
          message: 'Too many attempts. Please wait a moment and try again.',
        } satisfies VerifyResponse,
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))) },
        }
      )
    }

    await ensureSeeded()
    const settings = await getEventSettings()
    const tokenValid = !token || token === settings.eventToken

    // Gate control — organizers can pause/close entry without taking the QR down
    const gateStatus =
      settings.status === 'PAUSED' ? 'PAUSED' : settings.status === 'CLOSED' ? 'CLOSED' : 'OPEN'
    if (gateStatus !== 'OPEN') {
      await logAudit({ rawInput, lookupId, result: 'EVENT_CLOSED', req })
      return NextResponse.json(
        {
          ok: false,
          result: 'EVENT_CLOSED',
          message:
            gateStatus === 'PAUSED'
              ? 'Entry is temporarily paused by the organizers. Please wait at the venue entrance.'
              : 'Entry is closed for tonight. Please contact the registration desk for assistance.',
          tokenValid,
        } satisfies VerifyResponse,
        { status: 503, headers: { 'Retry-After': '30' } }
      )
    }

    const student = await db.student.findUnique({
      where: { studentId: lookupId },
      select: { id: true, studentId: true, name: true, department: true, year: true, checkedIn: true, checkinAt: true },
    })

    if (!student) {
      await logAudit({ rawInput, lookupId, result: 'DENIED', req })
      return NextResponse.json(
        {
          ok: true,
          result: 'DENIED',
          message: 'ID not found in the official OBSIDIAN \u201926 registration list.',
          tokenValid,
        } satisfies VerifyResponse
      )
    }

    const updated = await db.student.updateMany({
      where: { id: student.id, checkedIn: false },
      data: { checkedIn: true, checkinAt: new Date(), checkinBy: 'SELF' },
    })

    if (updated.count > 0) {
      await logAudit({
        rawInput,
        lookupId,
        result: 'GRANTED',
        studentId: student.id,
        studentKey: student.studentId,
        req,
      })
      return NextResponse.json(
        {
          ok: true,
          result: 'GRANTED',
          message: 'Access granted. Welcome to OBSIDIAN \u201926!',
          student: {
            studentId: student.studentId,
            name: student.name,
            department: student.department,
            year: student.year,
          },
          checkinAt: new Date().toISOString(),
          tokenValid,
        } satisfies VerifyResponse
      )
    }

    const fresh = await db.student.findUnique({
      where: { id: student.id },
      select: { checkinAt: true },
    })
    await logAudit({
      rawInput,
      lookupId,
      result: 'ALREADY_CHECKED_IN',
      studentId: student.id,
      studentKey: student.studentId,
      req,
    })
    return NextResponse.json(
      {
        ok: true,
        result: 'ALREADY_CHECKED_IN',
        message: 'This ID has already been checked in. No duplicate entry recorded.',
        student: {
          studentId: student.studentId,
          name: student.name,
          department: student.department,
          year: student.year,
        },
        checkinAt: fresh?.checkinAt ? fresh.checkinAt.toISOString() : null,
        tokenValid,
      } satisfies VerifyResponse
    )
  } catch {
    return NextResponse.json(
      { ok: false, result: 'INVALID', message: 'Server error' } satisfies VerifyResponse,
      { status: 500 }
    )
  }
}
