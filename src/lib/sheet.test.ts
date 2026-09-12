import { describe, expect, it } from 'vitest'
import { stageImportRows } from '@/lib/sheet'
import type { ImportMapping } from '@/lib/types'

const mapping: ImportMapping = {
  studentId: 0,
  name: 1,
  mobile: 2,
  department: null,
  email: null,
  year: null,
}

describe('spreadsheet import staging', () => {
  it('normalizes IDs and preserves unmapped columns', () => {
    const result = stageImportRows(
      ['Student ID', 'Name', 'Mobile', 'Dietary notes'],
      [[' obs26-001 ', 'Asha Rao', '9999999999', 'No nuts']],
      mapping
    )
    expect(result.validation.valid).toBe(1)
    expect(result.entries[0]).toMatchObject({
      studentId: 'OBS26-001',
      name: 'Asha Rao',
      extraData: { 'Dietary notes': 'No nuts' },
    })
    expect(result.extraColumns).toEqual(['Dietary notes'])
  })

  it('skips malformed and duplicate rows with row numbers', () => {
    const result = stageImportRows(
      ['Student ID', 'Name', 'Mobile'],
      [
        ['ok-001', 'First Student', '1'],
        ['bad id', 'Bad Student', '2'],
        ['OK-001', 'Duplicate Student', '3'],
        ['', '', '4'],
      ],
      mapping
    )
    expect(result.validation).toMatchObject({
      valid: 1,
      invalidId: 1,
      duplicateIdsInFile: 1,
      missingId: 1,
      missingName: 1,
    })
    expect(result.issues.map((issue) => issue.row)).toEqual([3, 4, 5, 5])
  })
})
