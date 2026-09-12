import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    await db.$queryRawUnsafe('SELECT 1')
    return NextResponse.json({
      ok: true,
      service: 'obsidian-qr',
      database: 'ready',
      time: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      { ok: false, service: 'obsidian-qr', database: 'unavailable', time: new Date().toISOString() },
      { status: 503 }
    )
  }
}
