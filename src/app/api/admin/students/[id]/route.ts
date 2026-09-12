import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sanitizeCell } from '@/lib/normalize'
import type { StudentRow } from '@/lib/types'
import { requireSameOrigin } from '@/lib/security'

type RouteContext = { params: Promise<{ id: string }> }

interface EditBody {
  action?: unknown
  reason?: unknown
  name?: unknown
  mobile?: unknown
  department?: unknown
  email?: unknown
  year?: unknown
}

async function toStudentRow(id: string): Promise<StudentRow | null> {
  const student = await db.student.findUnique({ where: { id } })
  if (!student) return null
  const attempts = await db.auditLog.count({ where: { studentKey: student.studentId } })
  return {
    id: student.id,
    studentId: student.studentId,
    name: student.name,
    mobile: student.mobile,
    department: student.department,
    email: student.email,
    year: student.year,
    checkedIn: student.checkedIn,
    checkinAt: student.checkinAt ? student.checkinAt.toISOString() : null,
    checkinBy: student.checkinBy,
    createdAt: student.createdAt.toISOString(),
    attempts,
  }
}

// GET — full profile + per-student audit history (volunteers included)
export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const { id } = await context.params
    const row = await toStudentRow(id)
    if (!row) {
      return NextResponse.json({ ok: false, message: 'Student not found' }, { status: 404 })
    }
    const logs = await db.auditLog.findMany({
      where: {
        OR: [{ studentId: row.id }, { studentKey: row.studentId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        rawInput: true,
        lookupId: true,
        result: true,
        studentKey: true,
        actor: true,
        createdAt: true,
      },
    })
    return NextResponse.json({
      ok: true,
      student: row,
      history: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return NextResponse.json({ ok: false, message: origin.message }, { status: origin.status })
  const guard = await requireAdmin(['ADMIN'])
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const { id } = await context.params
    const student = await db.student.findUnique({ where: { id } })
    if (!student) {
      return NextResponse.json({ ok: false, message: 'Student not found' }, { status: 404 })
    }

    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      /* fall through to invalid action */
    }
    const parsed = body as EditBody | null
    const action = typeof parsed?.action === 'string' ? parsed.action : ''

    if (action === 'checkin') {
      const enteredAt = new Date()
      const updated = await db.$transaction(async (tx) => {
        const changed = await tx.student.updateMany({
          where: { id: student.id, checkedIn: false },
          data: { checkedIn: true, checkinAt: enteredAt, checkinBy: guard.user.username },
        })
        if (changed.count > 0) {
          await tx.checkIn.create({
            data: {
              studentId: student.id,
              studentKey: student.studentId,
              enteredAt,
              method: 'DESK',
              actorUserId: guard.user.id,
              actorUsername: guard.user.username,
            },
          })
        }
        return changed
      })
      if (updated.count > 0) {
        await logAudit({
          rawInput: `[MANUAL] ${student.studentId}`,
          lookupId: student.studentId,
          result: 'GRANTED',
          studentId: student.id,
          studentKey: student.studentId,
          actor: guard.user.username,
          req,
        })
      }
      const row = await toStudentRow(student.id)
      return NextResponse.json({ ok: true, student: row })
    }

    if (action === 'uncheckin') {
      if (guard.user.role !== 'ADMIN') {
        return NextResponse.json(
          { ok: false, message: 'Only admins can undo a check-in' },
          { status: 403 }
        )
      }
      const reason = typeof parsed?.reason === 'string' ? sanitizeCell(parsed.reason) : ''
      const revertedAt = new Date()
      await db.$transaction([
        db.student.updateMany({
          where: { id: student.id, checkedIn: true },
          data: { checkedIn: false, checkinAt: null, checkinBy: null },
        }),
        db.checkIn.updateMany({
          where: { studentKey: student.studentId, revertedAt: null },
          data: {
            revertedAt,
            reversedByUserId: guard.user.id,
            reversalReason: reason || null,
          },
        }),
      ])
      await logAudit({
        rawInput: `[MANUAL] ${student.studentId}${reason ? ` — ${reason}` : ''}`,
        lookupId: student.studentId,
        result: 'UNCHECKED',
        studentId: student.id,
        studentKey: student.studentId,
        actor: guard.user.username,
        req,
      })
      const row = await toStudentRow(student.id)
      return NextResponse.json({ ok: true, student: row })
    }

    if (action === 'edit') {
      if (guard.user.role !== 'ADMIN') {
        return NextResponse.json(
          { ok: false, message: 'Only admins can edit student records' },
          { status: 403 }
        )
      }
      const data: Prisma.StudentUpdateInput = {}
      if (typeof parsed?.name === 'string') {
        const name = sanitizeCell(parsed.name)
        if (!name) {
          return NextResponse.json({ ok: false, message: 'Name cannot be empty' }, { status: 400 })
        }
        data.name = name
      }
      if (typeof parsed?.mobile === 'string') data.mobile = sanitizeCell(parsed.mobile) || null
      if (typeof parsed?.department === 'string') {
        data.department = sanitizeCell(parsed.department) || null
      }
      if (typeof parsed?.email === 'string') data.email = sanitizeCell(parsed.email) || null
      if (typeof parsed?.year === 'string') data.year = sanitizeCell(parsed.year) || null
      await db.student.update({ where: { id: student.id }, data })
      await logAudit({
        rawInput: `[EDIT] ${student.studentId}`,
        lookupId: student.studentId,
        result: 'EDITED',
        studentId: student.id,
        studentKey: student.studentId,
        actor: guard.user.username,
        req,
      })
      const row = await toStudentRow(student.id)
      return NextResponse.json({ ok: true, student: row })
    }

    return NextResponse.json(
      { ok: false, message: 'Invalid action. Use checkin, uncheckin or edit.' },
      { status: 400 }
    )
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, context: RouteContext): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return NextResponse.json({ ok: false, message: origin.message }, { status: origin.status })
  const guard = await requireAdmin(['ADMIN'])
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const { id } = await context.params
    const student = await db.student.findUnique({ where: { id } })
    if (!student) {
      return NextResponse.json({ ok: false, message: 'Student not found' }, { status: 404 })
    }
    await db.student.delete({ where: { id } })
    await logAudit({
      rawInput: `[DELETE] ${student.studentId}`,
      lookupId: student.studentId,
      result: 'DELETED',
      studentKey: student.studentId,
      actor: guard.user.username,
      req,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
