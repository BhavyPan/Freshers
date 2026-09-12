import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TEMPLATE_ROWS = [
  {
    'Student ID': 'OBS26-001',
    'Full Name': 'Aarav Sharma',
    'Mobile Number': '9800000001',
    Branch: 'CSE',
    Email: 'aarav.sharma@example.com',
    Year: '1st Year',
  },
  {
    'Student ID': 'OBS26-002',
    'Full Name': 'Diya Verma',
    'Mobile Number': '9800000002',
    Branch: 'ECE',
    Email: 'diya.verma@example.com',
    Year: '1st Year',
  },
  {
    'Student ID': 'OBS26-003',
    'Full Name': 'Rohan Iyer',
    'Mobile Number': '9800000003',
    Branch: 'IT',
    Email: 'rohan.iyer@example.com',
    Year: '2nd Year',
  },
]

/** Downloadable Excel template for the registration sheet import. */
export async function GET(): Promise<Response> {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ ok: false, message: guard.message }, { status: guard.status })
  }
  const sheet = XLSX.utils.json_to_sheet(TEMPLATE_ROWS)
  sheet['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 8 }, { wch: 32 }, { wch: 10 }]

  const guide = XLSX.utils.aoa_to_sheet([
    ['OBSIDIAN \u201926 — Registration Import Template'],
    [''],
    ['Rules:'],
    ['1. Student ID is REQUIRED and must be unique — it is the verification key at the gate.'],
    ['2. Full Name is REQUIRED.'],
    ['3. Mobile / Branch / Email / Year are optional but recommended.'],
    ['4. Keep the header row exactly as provided — the importer auto-maps these column names.'],
    ['5. Save as .xlsx or .csv, then upload it in Student Registry → Import.'],
  ])
  guide['!cols'] = [{ wch: 95 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Students')
  XLSX.utils.book_append_sheet(wb, guide, 'Guide')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="obsidian26-registration-template.xlsx"',
    },
  })
}
