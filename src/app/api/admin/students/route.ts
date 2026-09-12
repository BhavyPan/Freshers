import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import type { StudentRow, StudentsResponse } from '@/lib/types'

export async function GET(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    await ensureSeeded()
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const status = (url.searchParams.get('status') ?? 'ALL').trim().toUpperCase()
    const dept = url.searchParams.get('dept')?.trim() ?? 'ALL'
    const sort = (url.searchParams.get('sort') ?? 'recent').trim().toLowerCase()
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25)
    )

    const where: Prisma.StudentWhereInput = {}
    if (q) {
      where.OR = [
        { studentId: { contains: q } },
        { name: { contains: q } },
        { mobile: { contains: q } },
        { email: { contains: q } },
      ]
    }
    if (status === 'CHECKED_IN') where.checkedIn = true
    else if (status === 'NOT_ARRIVED') where.checkedIn = false
    if (dept && dept !== 'ALL') {
      where.department = dept === 'Unknown' ? null : dept
    }

    let orderBy: Prisma.StudentOrderByWithRelationInput[]
    if (sort === 'name') {
      orderBy = [{ name: 'asc' }, { studentId: 'asc' }]
    } else if (sort === 'id') {
      orderBy = [{ studentId: 'asc' }]
    } else {
      orderBy = [{ checkedIn: 'desc' }, { checkinAt: 'desc' }, { createdAt: 'desc' }]
    }

    const total = await db.student.count({ where })
    const rows = await db.student.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const attemptCounts = new Map<string, number>()
    const keys = rows.map((row) => row.studentId)
    if (keys.length > 0) {
      const grouped = await db.auditLog.groupBy({
        by: ['studentKey'],
        where: { studentKey: { in: keys } },
        _count: { _all: true },
      })
      for (const group of grouped) {
        attemptCounts.set(group.studentKey ?? '', group._count._all)
      }
    }

    const students: StudentRow[] = rows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      name: row.name,
      mobile: row.mobile,
      department: row.department,
      email: row.email,
      year: row.year,
      checkedIn: row.checkedIn,
      checkinAt: row.checkinAt ? row.checkinAt.toISOString() : null,
      checkinBy: row.checkinBy,
      createdAt: row.createdAt.toISOString(),
      attempts: attemptCounts.get(row.studentId) ?? 0,
    }))

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      students,
    } satisfies StudentsResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
