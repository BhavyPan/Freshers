import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import { cellAt, isValidMapping, readSheet } from '@/lib/sheet'
import { normalizeStudentId } from '@/lib/normalize'
import type { ImportCommitResponse, ImportMapping } from '@/lib/types'

const IMPORT_PERMISSION_MESSAGE = 'Only admins can import registration data'
const DB_LOOKUP_CHUNK = 500

interface ImportEntry {
  studentId: string
  name: string
  mobile: string
  department: string
  email: string
  year: string
}

function failure(message: string, status: number): NextResponse {
  const body: ImportCommitResponse = {
    ok: false,
    inserted: 0,
    updated: 0,
    skipped: 0,
    deletedAll: false,
    totalInDb: 0,
    message,
  }
  return NextResponse.json(body, { status })
}

export async function POST(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return failure(guard.message, guard.status)
  }
  if (guard.user.role !== 'ADMIN') {
    return failure(IMPORT_PERMISSION_MESSAGE, 403)
  }
  try {
    await ensureSeeded()
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return failure('Invalid form upload', 400)
    }

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return failure('No file uploaded', 400)
    }
    const sheetValue = form.get('sheet')
    const requestedSheet = typeof sheetValue === 'string' && sheetValue !== '' ? sheetValue : null

    const parsed = await readSheet(file, requestedSheet)
    if (!parsed.ok) {
      return failure(parsed.message, 400)
    }
    const { dataRows } = parsed.data

    let mapping: unknown = null
    const mappingValue = form.get('mapping')
    if (typeof mappingValue === 'string' && mappingValue.trim() !== '') {
      try {
        mapping = JSON.parse(mappingValue)
      } catch {
        mapping = null
      }
    }
    if (!isValidMapping(mapping)) {
      return failure('Column mapping must include the Student ID and Name columns', 400)
    }
    const columnMap: ImportMapping = mapping
    const mode = form.get('mode') === 'REPLACE' ? 'REPLACE' : 'MERGE'

    const entries: ImportEntry[] = []
    let skipped = 0
    for (const row of dataRows) {
      const studentId = normalizeStudentId(cellAt(row, columnMap.studentId))
      const name = cellAt(row, columnMap.name)
      if (!studentId || !name) {
        skipped += 1
        continue
      }
      entries.push({
        studentId,
        name,
        mobile: cellAt(row, columnMap.mobile),
        department: cellAt(row, columnMap.department),
        email: cellAt(row, columnMap.email),
        year: cellAt(row, columnMap.year),
      })
    }

    const existingIds = new Set<string>()
    const uniqueIds = [...new Set(entries.map((entry) => entry.studentId))]
    for (let i = 0; i < uniqueIds.length; i += DB_LOOKUP_CHUNK) {
      const chunk = uniqueIds.slice(i, i + DB_LOOKUP_CHUNK)
      const found = await db.student.findMany({
        where: { studentId: { in: chunk } },
        select: { studentId: true },
      })
      for (const row of found) existingIds.add(row.studentId)
    }

    let deletedAll = false
    if (mode === 'REPLACE') {
      await db.student.deleteMany({})
      deletedAll = true
      existingIds.clear()
    }

    let inserted = 0
    let updated = 0
    const seenInFile = new Set<string>()
    for (const entry of entries) {
      const exists = existingIds.has(entry.studentId) || seenInFile.has(entry.studentId)
      if (!exists) {
        try {
          await db.student.create({
            data: {
              studentId: entry.studentId,
              name: entry.name,
              mobile: entry.mobile || null,
              department: entry.department || null,
              email: entry.email || null,
              year: entry.year || null,
            },
          })
          inserted += 1
        } catch {
          await db.student.update({
            where: { studentId: entry.studentId },
            data: {
              name: entry.name,
              mobile: entry.mobile || undefined,
              department: entry.department || undefined,
              email: entry.email || undefined,
              year: entry.year || undefined,
            },
          })
          updated += 1
        }
      } else {
        await db.student.update({
          where: { studentId: entry.studentId },
          data: {
            name: entry.name,
            mobile: entry.mobile || undefined,
            department: entry.department || undefined,
            email: entry.email || undefined,
            year: entry.year || undefined,
          },
        })
        updated += 1
      }
      seenInFile.add(entry.studentId)
    }

    const totalInDb = await db.student.count()
    const summary =
      `Import complete — ${inserted} student${inserted === 1 ? '' : 's'} added, ` +
      `${updated} updated, ${skipped} row${skipped === 1 ? '' : 's'} skipped` +
      (deletedAll ? ', previous registry replaced' : '')

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      skipped,
      deletedAll,
      totalInDb,
      message: summary,
    } satisfies ImportCommitResponse)
  } catch {
    return failure('Server error while importing', 500)
  }
}
