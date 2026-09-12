const hits = new Map<string, number[]>()
const MAX_KEYS = 5000

function prune(now: number, windowMs: number): void {
  for (const [key, stamps] of hits) {
    const fresh = stamps.filter((t) => now - t < windowMs)
    if (fresh.length === 0) hits.delete(key)
    else hits.set(key, fresh)
  }
  if (hits.size >= MAX_KEYS) hits.clear()
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

export function checkRateLimit(key: string, limit = 12, windowMs = 60000): RateLimitResult {
  const now = Date.now()
  if (hits.size >= MAX_KEYS) prune(now, windowMs)
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= limit) {
    hits.set(key, list)
    const oldest = list[0] ?? now
    return { allowed: false, retryAfterMs: Math.max(oldest + windowMs - now, 0) }
  }
  list.push(now)
  hits.set(key, list)
  return { allowed: true, retryAfterMs: 0 }
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
