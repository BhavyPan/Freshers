import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS, verifyPassword } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import type { LoginResponse } from '@/lib/types'

const FAILURE_MESSAGE = 'Invalid username or password'

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await ensureSeeded()
    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      /* fall through to invalid credentials */
    }
    const parsed = body as { username?: unknown; password?: unknown } | null
    const username = typeof parsed?.username === 'string' ? parsed.username.trim().toLowerCase() : ''
    const password = typeof parsed?.password === 'string' ? parsed.password : ''

    if (!username || !password) {
      return NextResponse.json({ ok: false, message: FAILURE_MESSAGE } satisfies LoginResponse, {
        status: 401,
      })
    }

    const user = await db.adminUser.findUnique({ where: { username } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return NextResponse.json({ ok: false, message: FAILURE_MESSAGE } satisfies LoginResponse, {
        status: 401,
      })
    }

    const token = await createSession(user.id)
    const role = user.role === 'VOLUNTEER' ? 'VOLUNTEER' : 'ADMIN'
    const res = NextResponse.json({
      ok: true,
      user: { username: user.username, displayName: user.displayName, role },
    } satisfies LoginResponse)
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    })
    return res
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' } satisfies LoginResponse, {
      status: 500,
    })
  }
}
