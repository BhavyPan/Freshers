import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export interface ExportRow {
  studentId: string
  name: string
  department: string
  mobile: string
  status: string
  checkinAt: string
}

const CSV_HEADERS = ['ID', 'Name', 'Department', 'Mobile', 'Status', 'Check-in Time']

function csvEscape(value: string): string {
  const text = value ?? ''
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function buildCsv(rows: ExportRow[], title: string): string {
  const lines: string[] = [
    `# OBSIDIAN '26 — ${title}`,
    `# Generated: ${new Date().toISOString()}`,
    CSV_HEADERS.join(','),
  ]
  for (const row of rows) {
    lines.push(
      [row.studentId, row.name, row.department, row.mobile, row.status, row.checkinAt]
        .map((value) => csvEscape(value ?? ''))
        .join(',')
    )
  }
  return lines.join('\r\n')
}

export function buildXlsx(rows: ExportRow[], sheetName: string): Uint8Array {
  const aoa: string[][] = [
    CSV_HEADERS,
    ...rows.map((row) => [
      row.studentId,
      row.name,
      row.department,
      row.mobile,
      row.status,
      row.checkinAt,
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31) || 'Sheet1')
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new Uint8Array(buffer)
}

const ATTENDANCE_COLUMNS = [
  { label: 'ID', width: 110 },
  { label: 'NAME', width: 195 },
  { label: 'DEPARTMENT', width: 95 },
  { label: 'MOBILE', width: 90 },
  { label: 'STATUS', width: 95 },
  { label: 'CHECK-IN TIME', width: 155 },
]

const ELLIPSIS = '…'

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let value = text ?? ''
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  while (value.length > 1 && font.widthOfTextAtSize(value + ELLIPSIS, size) > maxWidth) {
    value = value.slice(0, -1)
  }
  return value + ELLIPSIS
}

export async function buildAttendancePdf(title: string, rows: ExportRow[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const pageWidth = 841.89
  const pageHeight = 595.28
  const margin = 36
  const headerHeight = 22
  const rowHeight = 13
  const rowsPerPage = 34

  const purple = rgb(0.42, 0.2, 0.72)
  const white = rgb(1, 1, 1)
  const rowBg = rgb(0.97, 0.95, 1.0)
  const grayText = rgb(0.45, 0.45, 0.49)
  const darkText = rgb(0.15, 0.1, 0.25)

  let page: PDFPage = pdfDoc.addPage([pageWidth, pageHeight])
  let pageIndex = 1
  let rowsDrawn = 0

  const drawPageChrome = (target: PDFPage): number => {
    target.drawText(title, { x: margin, y: pageHeight - margin - 14, size: 18, font: bold, color: purple })
    target.drawText(`Generated: ${new Date().toISOString()}`, {
      x: margin,
      y: pageHeight - margin - 27,
      size: 8,
      font: regular,
      color: grayText,
    })

    const headerBottom = pageHeight - margin - 40 - headerHeight
    target.drawRectangle({
      x: margin,
      y: headerBottom,
      width: pageWidth - margin * 2,
      height: headerHeight,
      color: purple,
    })
    let columnX = margin
    for (const column of ATTENDANCE_COLUMNS) {
      target.drawText(column.label, {
        x: columnX + 4,
        y: headerBottom + 6.5,
        size: 9,
        font: bold,
        color: white,
      })
      columnX += column.width
    }

    const footerText = `OBSIDIAN '26 — page ${pageIndex}`
    const footerWidth = regular.widthOfTextAtSize(footerText, 8)
    target.drawText(footerText, {
      x: (pageWidth - footerWidth) / 2,
      y: 20,
      size: 8,
      font: regular,
      color: grayText,
    })
    return headerBottom
  }

  let tableBottom = drawPageChrome(page)

  for (let i = 0; i < rows.length; i++) {
    if (rowsDrawn >= rowsPerPage) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      pageIndex += 1
      rowsDrawn = 0
      tableBottom = drawPageChrome(page)
    }
    const row = rows[i]
    const rowBottom = tableBottom - rowsDrawn * rowHeight - rowHeight
    if (i % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: rowBottom,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rowBg,
      })
    }
    const values = [row.studentId, row.name, row.department, row.mobile, row.status, row.checkinAt]
    let columnX = margin
    for (let c = 0; c < ATTENDANCE_COLUMNS.length; c++) {
      const font = c === 4 ? bold : regular
      const color = c === 4 ? (row.status === 'CHECKED IN' ? purple : grayText) : darkText
      const text = truncateToWidth(values[c] ?? '', font, 8.5, ATTENDANCE_COLUMNS[c].width - 8)
      page.drawText(text, { x: columnX + 4, y: rowBottom + 3.5, size: 8.5, font, color })
      columnX += ATTENDANCE_COLUMNS[c].width
    }
    rowsDrawn += 1
  }

  return pdfDoc.save()
}

export function formatCheckinTime(date: Date): string {
  return format(date, 'dd MMM yyyy, HH:mm')
}
