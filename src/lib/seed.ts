import bcrypt from 'bcryptjs'
import type { AuditResult } from '@prisma/client'
import { db } from '@/lib/db'
import { normalizeStudentId } from '@/lib/normalize'

const FIRST_NAMES = [
  'Aarav', 'Vihaan', 'Aditya', 'Vivaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna',
  'Ishaan', 'Shaurya', 'Atharv', 'Advik', 'Kabir', 'Ayaan', 'Dhruv', 'Rudra',
  'Aryan', 'Kartik', 'Rohan', 'Vikram', 'Ananya', 'Diya', 'Aadhya', 'Myra',
  'Saanvi', 'Ira', 'Kiara', 'Anika', 'Riya', 'Tara', 'Meera', 'Nitya',
  'Sharvari', 'Aarohi', 'Navya', 'Kavya', 'Shanaya', 'Avni', 'Pihu', 'Aditi',
]

const LAST_NAMES = [
  'Sharma', 'Verma', 'Reddy', 'Nair', 'Iyer', 'Patel', 'Gupta', 'Mehta',
  'Joshi', 'Rao', 'Chowdhury', 'Banerjee', 'Mukherjee', 'Das', 'Mishra', 'Tiwari',
  'Singh', 'Yadav', 'Chauhan', 'Pillai', 'Menon', 'Kulkarni', 'Deshpande', 'Hegde',
  'Shetty', 'Naik', 'Bose', 'Ghosh', 'Sengupta', 'Malhotra', 'Kapoor', 'Chopra',
  'Bhatt', 'Trivedi', 'Saxena', 'Srivastava', 'Ranjan', 'Prasad', 'Kar', 'Dubey',
]

const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'IT', 'AIML']
const STUDENT_COUNT = 80
const CHECKED_IN_COUNT = 14

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

function demoName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length]
  const last = LAST_NAMES[(index * 7 + 3) % LAST_NAMES.length]
  if (index % 9 === 2) return `${first} ${last[0]}.`
  return `${first} ${last}`
}

function demoEmail(name: string): string {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'student@example.com'
  if (parts.length === 1) return `${parts[0]}@example.com`
  return `${parts[0]}.${parts[parts.length - 1]}@example.com`
}

function demoMobile(index: number): string {
  const prefix = index % 2 === 0 ? '98' : '97'
  const digits = pad((index * 7919 + 10000001) % 100000000, 8)
  return `${prefix}${digits}`
}

interface SeededStudent {
  id: string
  studentId: string
  checkedIn: boolean
  checkinAt: Date | null
}

async function ensureAdminUser(
  username: string,
  password: string,
  role: 'ADMIN' | 'VOLUNTEER',
  displayName: string
): Promise<void> {
  const existing = await db.adminUser.findUnique({ where: { username } })
  if (existing) return
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    await db.adminUser.create({ data: { username, passwordHash, role, displayName } })
  } catch {
    /* concurrent seed — unique constraint, ignore */
  }
}

async function seedStudents(): Promise<void> {
  const now = Date.now()
  const spreadMs = 40 * 60 * 1000
  const created: SeededStudent[] = []

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const name = demoName(i)
    const checkedIn = i < CHECKED_IN_COUNT
    const checkinAt = checkedIn
      ? new Date(now - spreadMs + Math.round((spreadMs / (CHECKED_IN_COUNT - 1)) * i))
      : null
    try {
      const row = await db.student.create({
        data: {
          studentId: `OBS26-${pad(i + 1, 3)}`,
          name,
          mobile: demoMobile(i),
          department: DEPARTMENTS[i % DEPARTMENTS.length],
          email: demoEmail(name),
          year: i % 6 === 4 ? '2nd Year' : '1st Year',
          checkedIn,
          checkinAt,
          checkinBy: checkedIn ? 'SELF' : null,
        },
      })
      created.push({ id: row.id, studentId: row.studentId, checkedIn: row.checkedIn, checkinAt: row.checkinAt })
    } catch {
      /* concurrent seed — unique constraint, ignore */
    }
  }

  for (const student of created) {
    if (!student.checkedIn || !student.checkinAt) continue
    await db.checkIn.create({
      data: {
        studentId: student.id,
        studentKey: student.studentId,
        enteredAt: student.checkinAt,
        method: 'SELF',
      },
    })
  }

  await seedAuditLogs(created, now)
}

async function seedAuditLogs(students: SeededStudent[], now: number): Promise<void> {
  const logs: {
    rawInput: string
    lookupId: string
    result: AuditResult
    studentId?: string
    studentKey?: string
    createdAt: Date
  }[] = []

  for (const student of students) {
    if (student.checkedIn && student.checkinAt) {
      logs.push({
        rawInput: student.studentId,
        lookupId: student.studentId,
        result: 'GRANTED',
        studentId: student.id,
        studentKey: student.studentId,
        createdAt: student.checkinAt,
      })
    }
  }

  const deniedInputs = ['OBS26-999', 'UNKNOWN123', 'OBS26-081', 'GUEST-01', 'TEST-1234', 'XYZ789']
  deniedInputs.forEach((raw, index) => {
    logs.push({
      rawInput: raw,
      lookupId: normalizeStudentId(raw),
      result: 'DENIED',
      createdAt: new Date(now - 30 * 60 * 1000 + index * 5 * 60 * 1000),
    })
  })

  const alreadyInputs = ['OBS26-003', 'OBS26-011']
  alreadyInputs.forEach((raw, index) => {
    const student = students.find((s) => s.studentId === raw)
    logs.push({
      rawInput: raw,
      lookupId: raw,
      result: 'ALREADY_CHECKED_IN',
      studentId: student?.id,
      studentKey: raw,
      createdAt: new Date(now - (12 - index * 7) * 60 * 1000),
    })
  })

  for (const log of logs) {
    try {
      await db.auditLog.create({
        data: {
          rawInput: log.rawInput,
          lookupId: log.lookupId,
          result: log.result,
          studentId: log.studentId ?? null,
          studentKey: log.studentKey ?? null,
          createdAt: log.createdAt,
        },
      })
    } catch {
      /* ignore — seed logs are best-effort */
    }
  }
}

export async function seedDemoData(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seeding is disabled in production')
  }

  await db.eventSettings.upsert({
    where: { id: 'primary' },
    update: {},
    create: { id: 'primary' },
  })

  await ensureAdminUser('admin', 'obsidian26', 'ADMIN', 'Head Organizer')
  await ensureAdminUser('volunteer', 'volunteer26', 'VOLUNTEER', 'Entry Desk')

  const studentCount = await db.student.count()
  if (studentCount === 0) {
    await seedStudents()
  }
}
