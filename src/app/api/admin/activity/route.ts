import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import type { ActivityResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Desk activity attribution — who is checking juniors in.
 *
 * Two views:
 * 1. `desks` — attributed ENTRIES (students currently inside) grouped by
 *    `Student.checkinBy` ("SELF" = verified their own QR), over the whole event.
 * 2. `manualActions` — audit-trail actions per operator (manual check-ins,
 *    reversals, edits) over the recent window, so corrections are visible too.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    await ensureSeeded()
    const url = new URL(req.url)
    const windowHours = Math.min(
      168,
      Math.max(1, Number.parseInt(url.searchParams.get('window') ?? '24', 10) || 24)
    )
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000)

    const [byOperator, actions] = await Promise.all([
      db.student.groupBy({
        by: ['checkinBy'],
        where: { checkedIn: true },
        _count: { _all: true },
        _max: { checkinAt: true },
      }),
      db.auditLog.groupBy({
        by: ['actor', 'result'],
        where: { actor: { not: null }, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ])

    const deskMap = new Map<string, { actor: string; label: string; entries: number; lastAt: Date | null }>()
    for (const row of byOperator) {
      const by = row.checkinBy ?? 'SELF'
      const isSelf = by === 'SELF'
      const key = isSelf ? 'SELF' : by
      const entry =
        deskMap.get(key) ??
        { actor: key, label: isSelf ? 'Self scan (venue QR)' : by, entries: 0, lastAt: null }
      entry.entries += row._count._all
      const at = row._max.checkinAt
      if (at && (!entry.lastAt || at > entry.lastAt)) entry.lastAt = at
      deskMap.set(key, entry)
    }
    const desks = [...deskMap.values()]
      .map((e) => ({ ...e, lastAt: e.lastAt ? e.lastAt.toISOString() : null }))
      .sort((a, b) => b.entries - a.entries)

    const merged = new Map<
      string,
      { actor: string; checkins: number; reversals: number; edits: number; lastAt: Date | null }
    >()
    for (const row of actions) {
      const actor = row.actor ?? ''
      if (!actor) continue
      const entry =
        merged.get(actor) ?? { actor, checkins: 0, reversals: 0, edits: 0, lastAt: null }
      if (row.result === 'GRANTED') entry.checkins += row._count._all
      else if (row.result === 'UNCHECKED') entry.reversals += row._count._all
      else if (row.result === 'EDITED' || row.result === 'DELETED') entry.edits += row._count._all
      const at = row._max.createdAt
      if (at && (!entry.lastAt || at > entry.lastAt)) entry.lastAt = at
      merged.set(actor, entry)
    }
    const manualActions = [...merged.values()]
      .map((e) => ({ ...e, lastAt: e.lastAt ? e.lastAt.toISOString() : null }))
      .sort((a, b) => b.checkins + b.reversals + b.edits - (a.checkins + a.reversals + a.edits))

    const payload: ActivityResponse = { ok: true, desks, manualActions, windowHours }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
