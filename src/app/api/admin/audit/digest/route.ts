import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import type { AuditDigestResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Daily audit digest — a cron-less "today at the door" roll-up for the
 * Reports page. Computed lazily on admin load; no scheduled jobs needed.
 * `day` is an optional YYYY-MM-DD (server-local); defaults to today.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin(['ADMIN', 'VOLUNTEER'])
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const url = new URL(req.url)
    const dayParam = url.searchParams.get('day') ?? ''

    // resolve the [start, end) window for the requested day (server-local)
    let start: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
      const [y, m, d] = dayParam.split('-').map((p) => Number.parseInt(p, 10))
      start = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
    } else {
      const now = new Date()
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const dayKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
      start.getDate()
    ).padStart(2, '0')}`

    const where = { createdAt: { gte: start, lt: end } }

    const [byResultRaw, hourRows, actorRows, uniqueStudents, firstRow, lastRow] = await Promise.all([
      db.auditLog.groupBy({
        by: ['result'],
        where,
        _count: { _all: true },
        orderBy: { _count: { result: 'desc' } },
      }),
      db.auditLog.findMany({
        where,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.auditLog.groupBy({
        by: ['actor'],
        where: { ...where, actor: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { actor: 'desc' } },
        take: 1,
      }),
      db.auditLog.findMany({
        where: { ...where, studentKey: { not: null } },
        select: { studentKey: true },
        distinct: ['studentKey'],
      }),
      db.auditLog.findFirst({ where, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      db.auditLog.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ])

    const byResult = byResultRaw.map((row) => ({ result: row.result, count: row._count._all }))
    const total = byResult.reduce((sum, r) => sum + r.count, 0)

    // busiest hour-of-day within the window
    const hourBuckets = new Map<number, number>()
    for (const row of hourRows) {
      const h = row.createdAt.getHours()
      hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1)
    }
    let busiestHour: { hourLabel: string; count: number } | null = null
    if (hourRows.length > 0) {
      let bestHour = -1
      let bestCount = 0
      for (const [h, c] of hourBuckets) {
        if (c > bestCount) {
          bestHour = h
          bestCount = c
        }
      }
      if (bestHour >= 0) {
        const hour12 = bestHour % 12 === 0 ? 12 : bestHour % 12
        const suffix = bestHour < 12 ? 'AM' : 'PM'
        busiestHour = { hourLabel: `${hour12}:00 ${suffix}`, count: bestCount }
      }
    }

    const topActorRaw = actorRows[0]
    const topActor =
      topActorRaw?.actor && topActorRaw.actor !== 'SELF'
        ? { actor: topActorRaw.actor, count: topActorRaw._count._all }
        : null

    return NextResponse.json(
      {
        ok: true,
        day: dayKey,
        total,
        byResult,
        busiestHour,
        topActor,
        uniqueStudents: uniqueStudents.length,
        firstAt: firstRow?.createdAt.toISOString() ?? null,
        lastAt: lastRow?.createdAt.toISOString() ?? null,
      } satisfies AuditDigestResponse,
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ ok: false, message: 'Digest unavailable' }, { status: 500 })
  }
}
