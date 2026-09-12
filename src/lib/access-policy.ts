import { timingSafeEqual } from 'crypto'

function tokensMatch(supplied: string | null, current: string): boolean {
  if (!supplied) return false
  const left = Buffer.from(supplied)
  const right = Buffer.from(current)
  return left.length === right.length && timingSafeEqual(left, right)
}

export interface QrAccessDecision {
  allowed: boolean
  tokenValid: boolean
}

export function evaluateQrAccess(input: {
  requireQrToken: boolean
  suppliedToken: string | null
  currentToken: string
  organizerAuthenticated: boolean
}): QrAccessDecision {
  const tokenValid = tokensMatch(input.suppliedToken, input.currentToken)
  return {
    allowed: !input.requireQrToken || tokenValid || input.organizerAuthenticated,
    tokenValid: input.suppliedToken === null ? !input.requireQrToken : tokenValid,
  }
}
