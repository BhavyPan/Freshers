import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { ensureSeeded } from '@/lib/seed'
import type { LookupResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Self-service "Forgot ID" lookup — a student (or the door desk) types the
 * mobile number they registered with and receives their entry ID.
 *
 * Privacy stance:
 * - Phone number is treated as a shared secret: only an exact match on the
 *   REGISTERED mobile reveals anything, so the caller already knows the data.
 * - Responses are rate-limited aggressively (5 / min / IP) to prevent
 *   number-fishing sweeps across the registry.
 * - Every lookup is written to the audit trail (LOOKUP_FOUND / LOOKUP_NONE)
 *   with a hashed IP — organizers can review who queried what.
 * - At most 5 matches are returned; mobile digits are never echoed back
 *   (only a masked ••• last-4 fragment for confirmation).
 */

const MAX_DIGIT_MATCHES = 10 // digits kept from the raw input (handles +91 prefixes)

function normalizeMobile(raw: string): string {
  const digits = raw.replace(/\D+/g, '')
  return digits.length > MAX_DIGIT_MATCHES ? digits.slice(-MAX_DIGIT_MATCHES) : digits
}

function maskMobile(mobile: string): string {
  const tail = mobile.slice(-4)
  return `•••• ${tail}`
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      /* fall through to invalid request */
    }
    const parsed = body as { mobile?: unknown } | null
    if (typeof parsed?.mobile !== 'string' || parsed.mobile.trim() === '') {
      return NextResponse.json(
        { ok: false, message: 'Please enter the mobile number you registered with.' } satisfies LookupResponse,
        { status: 400 }
      )
    }

    const rawInput = parsed.mobile.trim()
    const mobile = normalizeMobile(rawInput)
    if (mobile.length < 10) {
      return NextResponse.json(
        { ok: false, message: 'That number looks too short — enter the full 10-digit mobile.' } satisfies LookupResponse,
        { status: 400 }
      )
    }

    const ip = getClientIp(req)
    const rateLimit = checkRateLimit(`lookup:${ip}`, 5, 60000)
    if (!rateLimit.allowed) {
      await logAudit({ rawInput: `mobile ••• ${mobile.slice(-4)}`, lookupId: 'MOBILE_LOOKUP', result: 'RATE_LIMITED', req })
      return NextResponse.json(
        { ok: false, message: 'Too many lookups. Please wait a minute or ask at the registration desk.' } satisfies LookupResponse,
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))) } }
      )
    }

    await ensureSeeded()

    // exact match on the stored mobile (compared on its digit-normalized tail)
    const candidates = await db.student.findMany({
      where: { mobile: { not: null } },
      select: { id: true, studentId: true, name: true, department: true, year: true, checkedIn: true, mobile: true },
    })
    const matches = candidates
      .filter((s) => normalizeMobile(s.mobile ?? '') === mobile)
      .slice(0, 5)

    if (matches.length === 0) {
      await logAudit({ rawInput: `mobile ••• ${mobile.slice(-4)}`, lookupId: 'MOBILE_LOOKUP', result: 'LOOKUP_NONE', req })
      return NextResponse.json({
        ok: true,
        found: false,
        message: 'No registration found for that number. Double-check the digits, or ask at the registration desk.',
      } satisfies LookupResponse)
    }

    const first = matches[0]!
    await logAudit({
      rawInput: `mobile ••• ${mobile.slice(-4)}`,
      lookupId: 'MOBILE_LOOKUP',
      result: 'LOOKUP_FOUND',
      studentId: first.id,
      studentKey: first.studentId,
      req,
    })

    return NextResponse.json(
      {
        ok: true,
        found: true,
        matches: matches.map((m) => ({
          studentId: m.studentId,
          name: m.name,
          department: m.department,
          year: m.year,
          checkedIn: m.checkedIn,
          mobileMasked: maskMobile(m.mobile ?? ''),
        })),
      } satisfies LookupResponse,
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Server error. Please try again or ask at the registration desk.' } satisfies LookupResponse,
      { status: 500 }
    )
  }
}
