import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeeded } from '@/lib/seed'
import { getEventSettings } from '@/lib/qr'
import type { EventStatus, PublicPulseResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Public "pulse" — aggregate, privacy-safe event stats for the landing page.
 * Exposes counts and first-name + last-initial only. No IDs, no contact data.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await ensureSeeded()
    const [settings, checkedIn, totalRegistered, recent] = await Promise.all([
      getEventSettings(),
      db.student.count({ where: { checkedIn: true } }),
      db.student.count(),
      db.student.findMany({
        where: { checkedIn: true },
        orderBy: { checkinAt: 'desc' },
        take: 8,
        select: { id: true, name: true, department: true, checkinAt: true },
      }),
    ])

    const status: EventStatus =
      settings.status === 'PAUSED' ? 'PAUSED' : settings.status === 'CLOSED' ? 'CLOSED' : 'OPEN'

    const payload: PublicPulseResponse = {
      ok: true,
      eventName: settings.eventName,
      tagline: settings.tagline,
      status,
      checkedIn,
      totalRegistered,
      recent: recent.map((s) => {
        const parts = s.name.trim().split(/\s+/)
        const firstName = parts[0] ?? s.name
        const lastInitial = parts.length > 1 ? `${parts[parts.length - 1].charAt(0).toUpperCase()}.` : ''
        return {
          id: s.id,
          firstName,
          lastInitial,
          department: s.department,
          at: s.checkinAt ? s.checkinAt.toISOString() : new Date().toISOString(),
        }
      }),
    }
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
