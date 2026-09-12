import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { autoMapHeaders, cellAt, readSheet, stageImportRows } from '@/lib/sheet'
import type { ImportPreviewResponse } from '@/lib/types'
import { requireSameOrigin } from '@/lib/security'

const IMPORT_PERMISSION_MESSAGE = 'Only admins can import registration data'
const DB_LOOKUP_CHUNK = 500

export async function POST(req: Request): Promise<NextResponse> {
  const origin = requireSameOrigin(req)
  if (!origin.ok) return NextResponse.json({ ok: false, message: origin.message }, { status: origin.status })
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  if (guard.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, message: IMPORT_PERMISSION_MESSAGE }, { status: 403 })
  }
  try {
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

    const staged = stageImportRows(headers, dataRows, autoMap)

    let existingInDb = 0
    const candidateIds = staged.entries.map((entry) => entry.studentId)
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
      validation: { ...staged.validation, existingInDb },
      issues: staged.issues,
      issuesTruncated: staged.issuesTruncated,
      extraColumns: staged.extraColumns,
    } satisfies ImportPreviewResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
