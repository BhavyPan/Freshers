import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ensureSeeded } from '@/lib/seed'
import type { AuditResponse, AuditRow } from '@/lib/types'

const RESULT_VALUES = [
  'GRANTED',
  'ALREADY_CHECKED_IN',
  'DENIED',
  'RATE_LIMITED',
  'EVENT_CLOSED',
  'UNCHECKED',
  'DELETED',
  'EDITED',
  'LOOKUP_FOUND',
  'LOOKUP_NONE',
]

// composite filter: "LOOKUPS" expands to both lookup result kinds
const RESULT_ALIASES: Record<string, string[]> = {
  LOOKUPS: ['LOOKUP_FOUND', 'LOOKUP_NONE'],
}

export async function GET(req: Request): Promise<NextResponse> {
  const guard = await requireAdmin(['ADMIN'])
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    await ensureSeeded()
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const resultParam = (url.searchParams.get('result') ?? 'ALL').trim()
    const studentKey = url.searchParams.get('studentKey')?.trim() ?? ''
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25)
    )

    const where: Prisma.AuditLogWhereInput = {}
    if (q) {
      where.OR = [
        { rawInput: { contains: q } },
        { lookupId: { contains: q } },
        { studentKey: { contains: q } },
        { actor: { contains: q } },
      ]
    }
    if (resultParam.toUpperCase() !== 'ALL' && resultParam !== '') {
      const results = resultParam
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .flatMap((value) => RESULT_ALIASES[value] ?? (RESULT_VALUES.includes(value) ? [value] : []))
      if (results.length > 0) where.result = { in: results }
    }
    if (studentKey) where.studentKey = studentKey

    const total = await db.auditLog.count({ where })
    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const rows: AuditRow[] = logs.map((log) => ({
      id: log.id,
      rawInput: log.rawInput,
      lookupId: log.lookupId,
      result: log.result,
      studentKey: log.studentKey,
      actor: log.actor,
      createdAt: log.createdAt.toISOString(),
    }))

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      logs: rows,
    } satisfies AuditResponse)
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
