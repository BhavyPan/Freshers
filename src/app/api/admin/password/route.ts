import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, requireAdmin, sessionTokenHash, verifyPassword, SESSION_COOKIE } from '@/lib/auth'
import { requireSameOrigin } from '@/lib/security'

export async function POST(req: Request): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return NextResponse.json({ ok: false, message: origin.message }, { status: origin.status })
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      /* fall through to validation error */
    }
    const parsed = body as { currentPassword?: unknown; newPassword?: unknown } | null
    const currentPassword = typeof parsed?.currentPassword === 'string' ? parsed.currentPassword : ''
    const newPassword = typeof parsed?.newPassword === 'string' ? parsed.newPassword : ''

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, message: 'Current and new password are required' },
        { status: 400 }
      )
    }
    if (newPassword.length < 12) {
      return NextResponse.json(
        { ok: false, message: 'New password must be at least 12 characters' },
        { status: 400 }
      )
    }

    const user = await db.adminUser.findUnique({ where: { username: guard.user.username } })
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ ok: false, message: 'Current password is incorrect' }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)
    await db.adminUser.update({ where: { id: user.id }, data: { passwordHash } })

    const store = await cookies()
    const currentToken = store.get(SESSION_COOKIE)?.value
    await db.adminSession.deleteMany({
      where: currentToken
        ? { userId: user.id, NOT: { tokenHash: sessionTokenHash(currentToken) } }
        : { userId: user.id },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
