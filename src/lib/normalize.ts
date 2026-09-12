export function normalizeStudentId(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function isValidStudentId(id: string): boolean {
  return /^[A-Z0-9][A-Z0-9\-/_.]{2,39}$/.test(id)
}

function stripControlChars(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code > 31 && code !== 127) out += ch
  }
  return out
}

export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const cleaned = stripControlChars(String(value).slice(0, 400))
  return cleaned.trim().slice(0, 200)
}
