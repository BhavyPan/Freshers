import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth'
import { requireSameOrigin } from '@/lib/security'

export async function POST(req: Request): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return NextResponse.json({ ok: false, message: origin.message }, { status: origin.status })
  await clearSession()
  return NextResponse.json({ ok: true })
}
