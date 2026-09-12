import { db } from '../src/lib/db'
import { runSeed } from '../src/lib/seed'

async function main(): Promise<void> {
  await runSeed()
  const students = await db.student.count()
  const checkedIn = await db.student.count({ where: { checkedIn: true } })
  const admins = await db.adminUser.count()
  const auditLogs = await db.auditLog.count()
  const settings = await db.eventSettings.findFirst()
  console.log('[seed] OBSIDIAN \'26 database ready')
  console.log(`[seed] students: ${students} (checked in: ${checkedIn})`)
  console.log(`[seed] admin users: ${admins}`)
  console.log(`[seed] audit logs: ${auditLogs}`)
  console.log(`[seed] event token: ${settings?.eventToken ?? 'n/a'}`)
}

main()
  .then(async () => {
    await db.$disconnect()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('[seed] failed:', err)
    await db.$disconnect()
    process.exit(1)
  })
