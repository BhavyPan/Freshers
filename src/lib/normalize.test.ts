import { describe, expect, it } from 'vitest'
import { isValidStudentId, normalizeStudentId, sanitizeCell } from '@/lib/normalize'

describe('student ID normalization', () => {
  it('trims and normalizes case', () => {
    expect(normalizeStudentId('  obs26-041  ')).toBe('OBS26-041')
  })

  it('accepts supported IDs and rejects malformed values', () => {
    expect(isValidStudentId('2K26/CSE_001')).toBe(true)
    expect(isValidStudentId('A')).toBe(false)
    expect(isValidStudentId('BAD ID')).toBe(false)
  })

  it('removes control characters and bounds spreadsheet cells', () => {
    expect(sanitizeCell('  A\u0000B\u0007C  ')).toBe('ABC')
    expect(sanitizeCell('x'.repeat(500))).toHaveLength(200)
  })
})
