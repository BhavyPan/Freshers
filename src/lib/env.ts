const MIN_SECRET_LENGTH = 32

function requiredSecret(name: 'SESSION_SECRET' | 'IP_HASH_SECRET'): string {
  const value = process.env[name]?.trim()
  if (value && value.length >= MIN_SECRET_LENGTH) return value
  if (process.env.NODE_ENV !== 'production') {
    return 'development-only-' + name.toLowerCase() + '-not-for-production'
  }
  throw new Error(name + ' must be configured with at least 32 characters')
}

export function getSessionSecret(): string {
  return requiredSecret('SESSION_SECRET')
}

export function getIpHashSecret(): string {
  return requiredSecret('IP_HASH_SECRET')
}

export function canonicalBaseUrl(req?: Request): string {
  const configured = process.env.APP_BASE_URL?.trim()
  if (configured) {
    const url = new URL(configured)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('APP_BASE_URL must use http or https')
    }
    return url.origin
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_BASE_URL is required in production')
  }
  if (!req) return 'http://localhost:3000'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return new URL(proto + '://' + host).origin
}
