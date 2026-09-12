import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import type { StatsResponse } from '@/lib/types'

const BUCKET_MS = 15 * 60 * 1000
const TIMELINE_WINDOW_MS = 6 * 60 * 60 * 1000

export async function GET(): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    await ensureSeeded()

    const [totalRegistered, checkedIn, deniedAttempts, lastCheckinRow, distinctDepts, byDeptTotal, byDeptChecked, grantedLogs, recentRows] =
      await Promise.all([
        db.student.count(),
        db.student.count({ where: { checkedIn: true } }),
        db.auditLog.count({ where: { result: { in: ['DENIED', 'RATE_LIMITED'] } } }),
        db.student.findFirst({
          where: { checkedIn: true },
          orderBy: { checkinAt: 'desc' },
          select: { checkinAt: true },
        }),
        db.student.findMany({
          where: { department: { not: null } },
          distinct: ['department'],
          select: { department: true },
        }),
        db.student.groupBy({ by: ['department'], _count: { _all: true } }),
        db.student.groupBy({ by: ['department'], where: { checkedIn: true }, _count: { _all: true } }),
        db.auditLog.findMany({
          where: { result: 'GRANTED', createdAt: { gte: new Date(Date.now() - TIMELINE_WINDOW_MS) } },
          select: { createdAt: true },
        }),
        db.student.findMany({
          where: { checkedIn: true },
          orderBy: { checkinAt: 'desc' },
          take: 12,
          select: { id: true, studentId: true, name: true, department: true, checkinAt: true },
        }),
      ])

    const notArrived = totalRegistered - checkedIn
    const checkinRate = totalRegistered > 0 ? Math.round((checkedIn / totalRegistered) * 1000) / 10 : 0
    const departments = distinctDepts
      .map((row) => row.department)
      .filter((dept): dept is string => dept !== null)
      .sort()

    const deptMap = new Map<string, { dept: string; total: number; checkedIn: number }>()
    for (const group of byDeptTotal) {
      const key = group.department ?? 'Unknown'
      const entry = deptMap.get(key) ?? { dept: key, total: 0, checkedIn: 0 }
      entry.total += group._count._all
      deptMap.set(key, entry)
    }
    for (const group of byDeptChecked) {
      const key = group.department ?? 'Unknown'
      const entry = deptMap.get(key)
      if (entry) entry.checkedIn += group._count._all
    }
    const studentsByDept = [...deptMap.values()].sort(
      (a, b) => b.total - a.total || a.dept.localeCompare(b.dept)
    )

    const bucketCounts = new Map<number, number>()
    for (const log of grantedLogs) {
      const bucket = Math.floor(log.createdAt.getTime() / BUCKET_MS) * BUCKET_MS
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1)
    }
    const nowBucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS
    const startBucket = Math.floor((Date.now() - TIMELINE_WINDOW_MS) / BUCKET_MS) * BUCKET_MS
    const timeline: { bucket: string; count: number }[] = []
    for (let bucket = startBucket; bucket <= nowBucket; bucket += BUCKET_MS) {
      timeline.push({ bucket: new Date(bucket).toISOString(), count: bucketCounts.get(bucket) ?? 0 })
    }

    const recent = recentRows.map((row) => ({
      id: row.id,
      studentId: row.studentId,
      name: row.name,
      department: row.department,
      checkinAt: row.checkinAt ? row.checkinAt.toISOString() : '',
    }))

    return NextResponse.json({
      ok: true,
      stats: {
        totalRegistered,
        checkedIn,
        notArrived,
        deniedAttempts,
        checkinRate,
        lastCheckinAt: lastCheckinRow?.checkinAt ? lastCheckinRow.checkinAt.toISOString() : null,
        departments,
        studentsByDept,
        timeline,
      },
      recent,
    } satisfies StatsResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
