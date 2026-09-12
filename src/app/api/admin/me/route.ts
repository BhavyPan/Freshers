import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import type { LoginResponse } from '@/lib/types'

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ ok: false } satisfies LoginResponse, { status: 401 })
  }
  return NextResponse.json({ ok: true, user } satisfies LoginResponse)
}
