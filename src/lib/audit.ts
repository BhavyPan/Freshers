import type { AuditResult } from '@prisma/client'
import { db } from '@/lib/db'
import { hashClientIp } from '@/lib/rate-limit'

export interface AuditEntry {
  rawInput: string
  lookupId: string
  result: AuditResult
  studentId?: string
  studentKey?: string
  actor?: string | null // desk operator username for MANUAL actions
  req: Request
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const ipHash = hashClientIp(entry.req)
    const userAgent = entry.req.headers.get('user-agent')
    await db.auditLog.create({
      data: {
        rawInput: entry.rawInput.slice(0, 200),
        lookupId: entry.lookupId.slice(0, 200),
        result: entry.result,
        studentId: entry.studentId ?? null,
        studentKey: entry.studentKey ?? null,
        actor: entry.actor ?? null,
        ipHash,
        userAgent: userAgent ? userAgent.slice(0, 180) : null,
      },
    })
  } catch {
    /* audit logging must never break the request */
  }
}
