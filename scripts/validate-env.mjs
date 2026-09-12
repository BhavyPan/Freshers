const required = ['DATABASE_URL', 'DIRECT_URL', 'APP_BASE_URL', 'SESSION_SECRET', 'IP_HASH_SECRET']
const errors = []

for (const name of required) {
  if (!process.env[name]?.trim()) errors.push(name + ' is required')
}

for (const name of ['DATABASE_URL', 'DIRECT_URL']) {
  const value = process.env[name]
  if (value && !/^postgres(ql)?:\/\//i.test(value)) {
    errors.push(name + ' must be a PostgreSQL connection URL')
  }
}

if (process.env.APP_BASE_URL) {
  try {
    const url = new URL(process.env.APP_BASE_URL)
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      errors.push('APP_BASE_URL must use HTTPS in production')
    }
  } catch {
    errors.push('APP_BASE_URL must be a valid absolute URL')
  }
}

for (const name of ['SESSION_SECRET', 'IP_HASH_SECRET']) {
  const value = process.env[name] || ''
  if (value.length < 32 || /replace-with/i.test(value)) {
    errors.push(name + ' must be a non-placeholder secret of at least 32 characters')
  }
}

if (errors.length > 0) {
  console.error('Environment validation failed:')
  for (const error of errors) console.error(' - ' + error)
  process.exitCode = 1
} else {
  console.log('Environment configuration is valid.')
}
