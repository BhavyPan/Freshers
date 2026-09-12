import { createHmac } from 'crypto'
import { db } from '@/lib/db'
import { getIpHashSecret } from '@/lib/env'

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

function hashKey(key: string): string {
  return createHmac('sha256', getIpHashSecret()).update(key).digest('hex')
}

export async function checkRateLimit(
  key: string,
  limit = 12,
  windowMs = 60000
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStartMs = Math.floor(now / windowMs) * windowMs
  const windowStart = new Date(windowStartMs)
  const expiresAt = new Date(windowStartMs + windowMs * 2)
  const keyHash = hashKey(key)
  const bucket = await db.rateLimitBucket.upsert({
    where: { keyHash_windowStart: { keyHash, windowStart } },
    update: { count: { increment: 1 }, expiresAt },
    create: { keyHash, windowStart, count: 1, expiresAt },
  })

  // Keep cleanup off the critical path and best-effort.
  if (Math.random() < 0.01) {
    void db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => undefined)
  }
  return {
    allowed: bucket.count <= limit,
    retryAfterMs: Math.max(windowStartMs + windowMs - now, 0),
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get('x-real-ip')
  if (real && real.trim()) return real.trim()
  return 'unknown'
}

export function hashClientIp(req: Request): string {
  return createHmac('sha256', getIpHashSecret())
    .update(getClientIp(req))
    .digest('hex')
    .slice(0, 24)
}
