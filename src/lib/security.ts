import { timingSafeEqual } from 'crypto'
import { canonicalBaseUrl } from '@/lib/env'

function equalText(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const originUrl = new URL(origin).origin
    if (equalText(originUrl, canonicalBaseUrl(req))) return true
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    if (host) {
      const hostOrigin = new URL(`${proto}://${host}`).origin
      if (equalText(originUrl, hostOrigin)) return true
    }
    return false
  } catch {
    return false
  }
}

export function requireSameOrigin(req: Request): { ok: true } | { ok: false; status: 403; message: string } {
  return isSameOrigin(req)
    ? { ok: true }
    : { ok: false, status: 403, message: 'Cross-origin request rejected.' }
}
