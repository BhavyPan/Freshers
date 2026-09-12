import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, SESSION_COOKIE, SESSION_TTL_SECONDS, verifyPassword } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { requireSameOrigin } from '@/lib/security'
import type { LoginResponse } from '@/lib/types'

const FAILURE_MESSAGE = 'Invalid username or password'

export async function POST(req: Request): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return NextResponse.json({ ok: false, message: origin.message }, { status: origin.status })
  try {
    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      /* fall through to invalid credentials */
    }
    const parsed = body as { username?: unknown; password?: unknown } | null
    const username = typeof parsed?.username === 'string' ? parsed.username.trim().toLowerCase() : ''
    const password = typeof parsed?.password === 'string' ? parsed.password : ''

    const ip = getClientIp(req)
    const isDev = process.env.NODE_ENV !== 'production'
    const ipMax = isDev ? 200 : 10
    const accountMax = isDev ? 100 : 5
    const [ipLimit, accountLimit] = await Promise.all([
      checkRateLimit('login:ip:' + ip, ipMax, 15 * 60_000),
      checkRateLimit('login:account:' + (username || 'missing'), accountMax, 15 * 60_000),
    ])
    if (!ipLimit.allowed || !accountLimit.allowed) {
      const retryAfterMs = Math.max(ipLimit.retryAfterMs, accountLimit.retryAfterMs)
      return NextResponse.json(
        { ok: false, message: 'Too many sign-in attempts. Please wait and try again.' } satisfies LoginResponse,
        {
          status: 429,
          headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
        }
      )
    }

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
      user: { id: user.id, username: user.username, displayName: user.displayName, role },
    } satisfies LoginResponse)
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
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
