import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { isValidMapping, readSheet, stageImportRows, type StagedImportEntry } from '@/lib/sheet'
import type { ImportCommitResponse, ImportIssue, ImportMapping } from '@/lib/types'
import { requireSameOrigin } from '@/lib/security'

const IMPORT_PERMISSION_MESSAGE = 'Only admins can import registration data'

function failure(
  message: string,
  status: number,
  issues: ImportIssue[] = [],
  issuesTruncated = false
): NextResponse {
  const body: ImportCommitResponse = {
    ok: false,
    inserted: 0,
    updated: 0,
    skipped: 0,
    deletedAll: false,
    totalInDb: 0,
    message,
    issues,
    issuesTruncated,
  }
  return NextResponse.json(body, { status })
}

function studentData(entry: StagedImportEntry) {
  return {
    name: entry.name,
    mobile: entry.mobile || null,
    department: entry.department || null,
    email: entry.email || null,
    year: entry.year || null,
    extraData: entry.extraData,
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return failure(origin.message, origin.status)

  const guard = await requireAdmin(['ADMIN'])
  if (!guard.ok) return failure(guard.message, guard.status)

  try {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return failure('Invalid form upload', 400)
    }

    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return failure('No file uploaded', 400)
    const sheetValue = form.get('sheet')
    const requestedSheet = typeof sheetValue === 'string' && sheetValue !== '' ? sheetValue : null
    const parsed = await readSheet(file, requestedSheet)
    if (!parsed.ok) return failure(parsed.message, 400)

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

    const staged = stageImportRows(parsed.data.headers, parsed.data.dataRows, mapping as ImportMapping)
    if (staged.entries.length === 0) {
      return failure(
        'No valid student rows were found; the registry was not changed.',
        400,
        staged.issues,
        staged.issuesTruncated
      )
    }

    const mode = form.get('mode') === 'REPLACE' ? 'REPLACE' : 'MERGE'
    const skipped = parsed.data.dataRows.length - staged.entries.length
    const result = await db.$transaction(
      async (tx) => {
        let inserted = 0
        let updated = 0
        let deletedAll = false

        if (mode === 'REPLACE') {
          await tx.student.deleteMany({})
          await tx.student.createMany({
            data: staged.entries.map((entry) => ({
              studentId: entry.studentId,
              ...studentData(entry),
            })),
          })
          inserted = staged.entries.length
          deletedAll = true
        } else {
          const ids = staged.entries.map((entry) => entry.studentId)
          const existing = new Set(
            (
              await tx.student.findMany({
                where: { studentId: { in: ids } },
                select: { studentId: true },
              })
            ).map((row) => row.studentId)
          )
          for (const entry of staged.entries) {
            await tx.student.upsert({
              where: { studentId: entry.studentId },
              update: studentData(entry),
              create: { studentId: entry.studentId, ...studentData(entry) },
            })
            if (existing.has(entry.studentId)) updated += 1
            else inserted += 1
          }
        }

        return { inserted, updated, deletedAll, totalInDb: await tx.student.count() }
      },
      { maxWait: 10_000, timeout: 60_000 }
    )

    const summary =
      'Import complete - ' +
      result.inserted +
      ' added, ' +
      result.updated +
      ' updated, ' +
      skipped +
      ' skipped' +
      (result.deletedAll ? ', previous registry replaced' : '')

    return NextResponse.json({
      ok: true,
      ...result,
      skipped,
      message: summary,
      issues: staged.issues,
      issuesTruncated: staged.issuesTruncated,
    } satisfies ImportCommitResponse)
  } catch (error) {
    console.error('[import] transaction failed:', error)
    return failure('Server error while importing; no partial changes were saved.', 500)
  }
}
