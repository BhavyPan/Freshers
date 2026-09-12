import { describe, expect, it } from 'vitest'
import { evaluateQrAccess } from '@/lib/access-policy'

describe('venue QR access policy', () => {
  const currentToken = '0123456789abcdef0123456789abcdef'

  it('allows direct verification while enforcement is disabled', () => {
    expect(
      evaluateQrAccess({
        requireQrToken: false,
        suppliedToken: null,
        currentToken,
        organizerAuthenticated: false,
      })
    ).toEqual({ allowed: true, tokenValid: true })
  })

  it('rejects missing and stale tokens while enforcement is enabled', () => {
    for (const suppliedToken of [null, 'stale-token']) {
      expect(
        evaluateQrAccess({
          requireQrToken: true,
          suppliedToken,
          currentToken,
          organizerAuthenticated: false,
        }).allowed
      ).toBe(false)
    }
  })

  it('allows the current token and authenticated desk users', () => {
    expect(
      evaluateQrAccess({
        requireQrToken: true,
        suppliedToken: currentToken,
        currentToken,
        organizerAuthenticated: false,
      })
    ).toEqual({ allowed: true, tokenValid: true })
    expect(
      evaluateQrAccess({
        requireQrToken: true,
        suppliedToken: null,
        currentToken,
        organizerAuthenticated: true,
      }).allowed
    ).toBe(true)
  })
})
