import { createHmac, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getSessionSecret } from '@/lib/env'
import type { AdminRole, AdminSessionInfo } from '@/lib/types'

export const SESSION_COOKIE = 'obsidian_session'
export const SESSION_TTL_SECONDS = 43200

export function sessionTokenHash(token: string): string {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex')
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10)
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash)
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
  await db.adminSession.create({ data: { tokenHash: sessionTokenHash(token), userId, expiresAt } })
  return token
}

export async function getSessionUser(): Promise<AdminSessionInfo | null> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return null
    const session = await db.adminSession.findUnique({
      where: { tokenHash: sessionTokenHash(token) },
      include: { user: true },
    })
    if (!session) return null
    if (session.expiresAt.getTime() <= Date.now()) {
      await db.adminSession.delete({ where: { id: session.id } }).catch(() => undefined)
      return null
    }
    const role: AdminRole = session.user.role
    return {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      role,
    }
  } catch {
    return null
  }
}

export type AdminGuard =
  | { ok: true; user: AdminSessionInfo }
  | { ok: false; status: number; message: string }

export async function requireAdmin(roles?: AdminRole[]): Promise<AdminGuard> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, status: 401, message: 'Authentication required. Please sign in again.' }
  }
  if (roles && !roles.includes(user.role)) {
    return { ok: false, status: 403, message: 'You do not have permission to perform this action.' }
  }
  return { ok: true, user }
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await db.adminSession
      .deleteMany({ where: { tokenHash: sessionTokenHash(token) } })
      .catch(() => undefined)
  }
  store.delete(SESSION_COOKIE)
}
