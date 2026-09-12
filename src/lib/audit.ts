import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { getClientIp } from '@/lib/rate-limit'

export interface AuditEntry {
  rawInput: string
  lookupId: string
  result: string
  studentId?: string
  studentKey?: string
  actor?: string | null // desk operator username for MANUAL actions
  req: Request
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const ip = getClientIp(entry.req)
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null
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
