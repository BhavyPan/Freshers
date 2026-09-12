import bcrypt from 'bcryptjs'
import { db } from '../src/lib/db'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(name + ' is required')
  return value
}

function validateUsername(value: string, name: string): string {
  const username = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
    throw new Error(name + ' must be 3-40 characters using letters, digits, dot, underscore or hyphen')
  }
  return username
}

function validatePassword(value: string, name: string): string {
  if (value.length < 12) throw new Error(name + ' must contain at least 12 characters')
  if (['obsidian26', 'volunteer26', 'password123'].includes(value.toLowerCase())) {
    throw new Error(name + ' must not use a known demo password')
  }
  return value
}

async function createUser(
  username: string,
  password: string,
  displayName: string,
  role: 'ADMIN' | 'VOLUNTEER'
): Promise<void> {
  const existing = await db.adminUser.findUnique({ where: { username } })
  if (existing) {
    console.log('[bootstrap] ' + role.toLowerCase() + ' ' + username + ' already exists; password was not changed')
    return
  }
  await db.adminUser.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      displayName: displayName || null,
      role,
    },
  })
  console.log('[bootstrap] created ' + role.toLowerCase() + ' ' + username)
}

async function main(): Promise<void> {
  await db.eventSettings.upsert({
    where: { id: 'primary' },
    update: {},
    create: { id: 'primary' },
  })

  await createUser(
    validateUsername(required('BOOTSTRAP_ADMIN_USERNAME'), 'BOOTSTRAP_ADMIN_USERNAME'),
    validatePassword(required('BOOTSTRAP_ADMIN_PASSWORD'), 'BOOTSTRAP_ADMIN_PASSWORD'),
    process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || 'Head Organizer',
    'ADMIN'
  )

  const volunteerUsername = process.env.BOOTSTRAP_VOLUNTEER_USERNAME?.trim()
  const volunteerPassword = process.env.BOOTSTRAP_VOLUNTEER_PASSWORD
  if (volunteerUsername || volunteerPassword) {
    if (!volunteerUsername || !volunteerPassword) {
      throw new Error('Supply both BOOTSTRAP_VOLUNTEER_USERNAME and BOOTSTRAP_VOLUNTEER_PASSWORD')
    }
    await createUser(
      validateUsername(volunteerUsername, 'BOOTSTRAP_VOLUNTEER_USERNAME'),
      validatePassword(volunteerPassword, 'BOOTSTRAP_VOLUNTEER_PASSWORD'),
      process.env.BOOTSTRAP_VOLUNTEER_DISPLAY_NAME?.trim() || 'Entry Desk',
      'VOLUNTEER'
    )
  }
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (error) => {
    console.error('[bootstrap] failed:', error instanceof Error ? error.message : error)
    await db.$disconnect()
    process.exitCode = 1
  })
