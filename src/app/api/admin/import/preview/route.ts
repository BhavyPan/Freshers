import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { autoMapHeaders, cellAt, readSheet } from '@/lib/sheet'
import { normalizeStudentId } from '@/lib/normalize'
import type { ImportPreviewResponse } from '@/lib/types'

const IMPORT_PERMISSION_MESSAGE = 'Only admins can import registration data'
const DB_LOOKUP_CHUNK = 500

export async function POST(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  if (guard.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, message: IMPORT_PERMISSION_MESSAGE }, { status: 403 })
  }
  try {
    await ensureSeeded()
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ ok: false, message: 'Invalid form upload' }, { status: 400 })
    }

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, message: 'No file uploaded' }, { status: 400 })
    }
    const sheetValue = form.get('sheet')
    const requestedSheet = typeof sheetValue === 'string' && sheetValue !== '' ? sheetValue : null

    const parsed = await readSheet(file, requestedSheet)
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 })
    }
    const { sheets, activeSheet, headers, dataRows } = parsed.data
    const autoMap = autoMapHeaders(headers)

    const seenIds = new Set<string>()
    let valid = 0
    let missingId = 0
    let missingName = 0
    let duplicateIdsInFile = 0
    for (const row of dataRows) {
      const id = autoMap.studentId !== null ? normalizeStudentId(cellAt(row, autoMap.studentId)) : ''
      const name = autoMap.name !== null ? cellAt(row, autoMap.name) : ''
      const hasId = autoMap.studentId !== null && id !== ''
      const hasName = autoMap.name !== null && name !== ''
      let duplicate = false
      if (hasId) {
        if (seenIds.has(id)) {
          duplicateIdsInFile += 1
          duplicate = true
        } else {
          seenIds.add(id)
        }
      }
      if (!hasId) missingId += 1
      if (!hasName) missingName += 1
      if (hasId && hasName && !duplicate) valid += 1
    }

    let existingInDb = 0
    const candidateIds = [...seenIds]
    for (let i = 0; i < candidateIds.length; i += DB_LOOKUP_CHUNK) {
      const chunk = candidateIds.slice(i, i + DB_LOOKUP_CHUNK)
      const found = await db.student.findMany({
        where: { studentId: { in: chunk } },
        select: { studentId: true },
      })
      existingInDb += found.length
    }

    const sample = dataRows.slice(0, 8).map((row) =>
      headers.map((_, index) => cellAt(row, index).slice(0, 60))
    )

    return NextResponse.json({
      ok: true,
      sheets,
      activeSheet,
      headers,
      rowCount: dataRows.length,
      sample,
      autoMap,
      validation: { valid, missingId, missingName, duplicateIdsInFile, existingInDb },
    } satisfies ImportPreviewResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
