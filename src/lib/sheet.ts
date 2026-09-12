import * as XLSX from 'xlsx'
import { sanitizeCell } from '@/lib/normalize'
import type { ImportMapping } from '@/lib/types'

export const MAX_IMPORT_SIZE = 8 * 1024 * 1024

export interface ParsedSheet {
  sheets: string[]
  activeSheet: string
  headers: string[]
  dataRows: string[][]
}

export type SheetReadResult =
  | { ok: true; data: ParsedSheet }
  | { ok: false; message: string }

export async function readSheet(
  file: File,
  requestedSheet: string | null
): Promise<SheetReadResult> {
  if (file.size > MAX_IMPORT_SIZE) {
    return { ok: false, message: 'File too large — maximum size is 8 MB' }
  }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { ok: false, message: 'Unsupported file type — upload .xlsx, .xls or .csv' }
  }
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  } catch {
    return { ok: false, message: 'Could not read the uploaded file' }
  }
  const sheets = workbook.SheetNames
  if (sheets.length === 0) {
    return { ok: false, message: 'The workbook contains no sheets' }
  }
  const activeSheet = requestedSheet && sheets.includes(requestedSheet) ? requestedSheet : sheets[0]
  const sheet = workbook.Sheets[activeSheet]
  if (!sheet) {
    return { ok: false, message: 'The selected sheet is empty' }
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][]
  const rows = rawRows.map((row) => (Array.isArray(row) ? row.map((cell) => sanitizeCell(cell)) : []))
  const headers = rows[0] ?? []
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== ''))
  return { ok: true, data: { sheets, activeSheet, headers, dataRows } }
}

export function cellAt(row: string[], index: number | null): string {
  if (index === null || index < 0 || index >= row.length) return ''
  return row[index]
}

const HEADER_PATTERNS: { key: keyof ImportMapping; re: RegExp }[] = [
  { key: 'studentId', re: /student\s*id|roll|reg(istration)?\s*(no|number|id)?|admission|enrollment|college\s*id|id/ },
  { key: 'name', re: /^name|student\s*name|full\s*name|applicant/ },
  { key: 'mobile', re: /mobile|phone|contact|whats?app/ },
  { key: 'department', re: /dept|department|branch|course|stream/ },
  { key: 'email', re: /e-?mail|mail/ },
  { key: 'year', re: /year|sem|study/ },
]

export function autoMapHeaders(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {
    studentId: null,
    name: null,
    mobile: null,
    department: null,
    email: null,
    year: null,
  }
  for (const { key, re } of HEADER_PATTERNS) {
    for (let index = 0; index < headers.length; index++) {
      if (re.test(headers[index].toLowerCase())) {
        mapping[key] = index
        break
      }
    }
  }
  return mapping
}

export function isValidMapping(mapping: unknown): mapping is ImportMapping {
  if (mapping === null || typeof mapping !== 'object') return false
  const m = mapping as Record<string, unknown>
  return (
    typeof m.studentId === 'number' &&
    Number.isInteger(m.studentId) &&
    m.studentId >= 0 &&
    typeof m.name === 'number' &&
    Number.isInteger(m.name) &&
    m.name >= 0
  )
}
