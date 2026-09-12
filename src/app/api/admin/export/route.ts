import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { buildAttendancePdf, buildCsv, buildXlsx, formatCheckinTime, type ExportRow } from '@/lib/export'

export async function GET(req: Request): Promise<NextResponse | Response> {
  const guard = await requireAdmin(['ADMIN'])
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  try {
    const url = new URL(req.url)
    const scopeParam = (url.searchParams.get('scope') ?? 'full').trim().toLowerCase()
    const formatParam = (url.searchParams.get('format') ?? 'csv').trim().toLowerCase()

    const scope = scopeParam === 'checkedin' || scopeParam === 'notarrived' || scopeParam === 'audit' ? scopeParam : 'full'
    const fileFormat = formatParam === 'xlsx' || formatParam === 'pdf' ? formatParam : 'csv'

    if (scope === 'audit') {
      const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 })
      const auditRows = logs.map((log) => ({
        Time: format(log.createdAt, 'yyyy-MM-dd HH:mm:ss'),
        'Raw Input': log.rawInput,
        'Looked-up ID': log.lookupId,
        Result: log.result,
        'Matched Student': log.studentKey ?? '',
        'IP Hash': log.ipHash ?? '',
      }))
      const stamp = format(new Date(), 'yyyyMMdd-HHmm')
      if (fileFormat === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(auditRows)
        ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 18 }]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Audit Trail')
        const data = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
        return new Response(new Uint8Array(data), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="obsidian26-audit-${stamp}.xlsx"`,
          },
        })
      }
      const header = 'Time,Raw Input,Looked-up ID,Result,Matched Student,IP Hash'
      const csvLines = auditRows.map((r) =>
        [r.Time, r['Raw Input'], r['Looked-up ID'], r.Result, r['Matched Student'], r['IP Hash']]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      return new Response(`\uFEFF# OBSIDIAN '26 — Verification Audit Trail\n${header}\n${csvLines.join('\n')}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="obsidian26-audit-${stamp}.csv"`,
        },
      })
    }

    let students
    if (scope === 'checkedin') {
      students = await db.student.findMany({ where: { checkedIn: true }, orderBy: { checkinAt: 'desc' } })
    } else if (scope === 'notarrived') {
      students = await db.student.findMany({ where: { checkedIn: false }, orderBy: { name: 'asc' } })
    } else {
      students = await db.student.findMany({ orderBy: { studentId: 'asc' } })
    }

    const rows: ExportRow[] = students.map((student) => ({
      studentId: student.studentId,
      name: student.name,
      department: student.department ?? '',
      mobile: student.mobile ?? '',
      status: student.checkedIn ? 'CHECKED IN' : 'NOT ARRIVED',
      checkinAt: student.checkinAt ? formatCheckinTime(student.checkinAt) : '—',
    }))

    const title =
      scope === 'checkedin'
        ? 'Checked-in Students'
        : scope === 'notarrived'
          ? 'Not Arrived Students'
          : 'Full Attendance'
    const stamp = format(new Date(), 'yyyyMMdd-HHmm')
    const filename = `obsidian26-${scope}-${stamp}.${fileFormat}`
    const disposition = `attachment; filename="${filename}"`

    if (fileFormat === 'xlsx') {
      const data = buildXlsx(rows, title)
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': disposition,
        },
      })
    }
    if (fileFormat === 'pdf') {
      const data = await buildAttendancePdf(title, rows)
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': disposition,
        },
      })
    }

    const csv = buildCsv(rows, title)
    return new Response(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': disposition,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 })
  }
}
