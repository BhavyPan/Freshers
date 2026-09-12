import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { normalizeStudentId, isValidStudentId } from '@/lib/normalize'
import type { QuickCheckinResponse } from '@/lib/types'
import { requireSameOrigin } from '@/lib/security'

/**
 * Manual check-in from the entry desk — for juniors whose phone died / no QR.
 * Volunteers + admins allowed. Uses the same duplicate-protection as self check-in.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return NextResponse.json({ ok: false, message: origin.message }, { status: origin.status })
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const body = (await req.json()) as { studentId?: unknown }
    const raw = typeof body?.studentId === 'string' ? body.studentId.trim() : ''
    if (!raw) {
      return NextResponse.json(
        { ok: false, result: 'DENIED', message: 'Enter a Student / College ID.' } satisfies QuickCheckinResponse,
        { status: 400 }
      )
    }
    const lookupId = normalizeStudentId(raw)
    if (!isValidStudentId(lookupId)) {
      return NextResponse.json(
        { ok: false, result: 'DENIED', message: 'Invalid ID format.' } satisfies QuickCheckinResponse,
        { status: 400 }
      )
    }

    const student = await db.student.findUnique({ where: { studentId: lookupId } })
    if (!student) {
      await logAudit({
        req,
        rawInput: raw,
        lookupId,
        result: 'DENIED',
        actor: guard.user.username,
      })
      return NextResponse.json({
        ok: true,
        result: 'DENIED',
        message: `No registered student with ID ${lookupId}.`,
      } satisfies QuickCheckinResponse)
    }

    if (student.checkedIn) {
      return NextResponse.json({
        ok: true,
        result: 'ALREADY_CHECKED_IN',
        message: `${student.name} is already inside (since ${
          student.checkinAt ? student.checkinAt.toLocaleTimeString('en-IN', { hour12: false }) : 'earlier'
        }).`,
        student: {
          studentId: student.studentId,
          name: student.name,
          department: student.department,
          checkinAt: student.checkinAt ? student.checkinAt.toISOString() : new Date().toISOString(),
        },
      } satisfies QuickCheckinResponse)
    }

    const now = new Date()
    const checkedIn = await db.$transaction(async (tx) => {
      const updated = await tx.student.updateMany({
        where: { id: student.id, checkedIn: false },
        data: { checkedIn: true, checkinAt: now, checkinBy: guard.user.username },
      })
      if (updated.count === 0) return false
      await tx.checkIn.create({
        data: {
          studentId: student.id,
          studentKey: student.studentId,
          enteredAt: now,
          method: 'DESK',
          actorUserId: guard.user.id,
          actorUsername: guard.user.username,
        },
      })
      return true
    })

    if (!checkedIn) {
      return NextResponse.json({
        ok: true,
        result: 'ALREADY_CHECKED_IN',
        message: `${student.name} is already inside.`,
        student: {
          studentId: student.studentId,
          name: student.name,
          department: student.department,
          checkinAt: student.checkinAt ? student.checkinAt.toISOString() : now.toISOString(),
        },
      } satisfies QuickCheckinResponse)
    }

    await logAudit({
      req,
      rawInput: raw,
      lookupId,
      result: 'GRANTED',
      studentId: student.id,
      studentKey: student.studentId,
      actor: guard.user.username,
    })

    return NextResponse.json({
      ok: true,
      result: 'GRANTED',
      message: `${student.name} checked in by ${guard.user.displayName || guard.user.username}.`,
      student: {
        studentId: student.studentId,
        name: student.name,
        department: student.department,
        checkinAt: now.toISOString(),
      },
    } satisfies QuickCheckinResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
