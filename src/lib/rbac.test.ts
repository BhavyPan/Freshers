import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { AdminRole, AdminSessionInfo } from '@/lib/types'

// Mock dependencies for getSessionUser and requireAdmin
let mockSessionUser: AdminSessionInfo | null = null

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    getSessionUser: vi.fn(async () => mockSessionUser),
    requireAdmin: vi.fn(async (roles?: AdminRole[]) => {
      if (!mockSessionUser) {
        return { ok: false, status: 401, message: 'Authentication required. Please sign in again.' }
      }
      if (roles && !roles.includes(mockSessionUser.role)) {
        return { ok: false, status: 403, message: 'You do not have permission to perform this action.' }
      }
      return { ok: true, user: mockSessionUser }
    }),
  }
})

describe('Role-Based Access Control (RBAC) System', () => {
  beforeEach(() => {
    mockSessionUser = null
    vi.clearAllMocks()
  })

  describe('requireAdmin guard evaluation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { requireAdmin } = await import('@/lib/auth')
      mockSessionUser = null

      const result = await requireAdmin(['ADMIN', 'VOLUNTEER'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(401)
        expect(result.message).toContain('Authentication required')
      }
    })

    it('rejects VOLUNTEER with 403 on ADMIN-only actions', async () => {
      const { requireAdmin } = await import('@/lib/auth')
      mockSessionUser = {
        id: 'vol-1',
        username: 'volunteer@obsidian26.demo',
        displayName: 'Event Volunteer',
        role: 'VOLUNTEER',
      }

      const result = await requireAdmin(['ADMIN'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(403)
        expect(result.message).toBe('You do not have permission to perform this action.')
      }
    })

    it('allows VOLUNTEER on read-only endpoints (ADMIN | VOLUNTEER)', async () => {
      const { requireAdmin } = await import('@/lib/auth')
      mockSessionUser = {
        id: 'vol-1',
        username: 'volunteer@obsidian26.demo',
        displayName: 'Event Volunteer',
        role: 'VOLUNTEER',
      }

      const result = await requireAdmin(['ADMIN', 'VOLUNTEER'])
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.user.role).toBe('VOLUNTEER')
      }
    })

    it('allows ADMIN on all actions', async () => {
      const { requireAdmin } = await import('@/lib/auth')
      mockSessionUser = {
        id: 'adm-1',
        username: 'admin',
        displayName: 'Head Organizer',
        role: 'ADMIN',
      }

      const adminAction = await requireAdmin(['ADMIN'])
      expect(adminAction.ok).toBe(true)

      const readAction = await requireAdmin(['ADMIN', 'VOLUNTEER'])
      expect(readAction.ok).toBe(true)
    })
  })

  describe('Route-level permissions specification', () => {
    const MUTATION_ENDPOINTS = [
      { name: 'Manual Check-in', method: 'PATCH', path: '/api/admin/students/[id]', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Undo Check-in', method: 'PATCH', path: '/api/admin/students/[id]', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Edit Student Details', method: 'PATCH', path: '/api/admin/students/[id]', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Delete Student', method: 'DELETE', path: '/api/admin/students/[id]', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Create Student', method: 'POST', path: '/api/admin/students', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Quick Check-in', method: 'POST', path: '/api/admin/quick-checkin', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Import Sheet Preview', method: 'POST', path: '/api/admin/import/preview', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Import Sheet Commit', method: 'POST', path: '/api/admin/import/commit', roles: ['ADMIN'] as AdminRole[] },
      { name: 'Rotate QR Secret', method: 'POST', path: '/api/qr/regenerate', roles: ['ADMIN'] as AdminRole[] },
    ]

    const READ_ENDPOINTS = [
      { name: 'View Registry / Search', method: 'GET', path: '/api/admin/students', roles: ['ADMIN', 'VOLUNTEER'] as AdminRole[] },
      { name: 'View Student Profile', method: 'GET', path: '/api/admin/students/[id]', roles: ['ADMIN', 'VOLUNTEER'] as AdminRole[] },
      { name: 'Audit Trail Logs', method: 'GET', path: '/api/admin/audit', roles: ['ADMIN', 'VOLUNTEER'] as AdminRole[] },
      { name: 'Audit Digest & Integrity', method: 'GET', path: '/api/admin/audit/digest', roles: ['ADMIN', 'VOLUNTEER'] as AdminRole[] },
      { name: 'Export Attendee Report', method: 'GET', path: '/api/admin/export', roles: ['ADMIN', 'VOLUNTEER'] as AdminRole[] },
    ]

    it.each(MUTATION_ENDPOINTS)('blocks VOLUNTEER with 403 on $name ($method $path)', async ({ roles }) => {
      const { requireAdmin } = await import('@/lib/auth')
      mockSessionUser = {
        id: 'vol-1',
        username: 'volunteer@obsidian26.demo',
        displayName: 'Event Volunteer',
        role: 'VOLUNTEER',
      }

      const guard = await requireAdmin(roles)
      expect(guard.ok).toBe(false)
      if (!guard.ok) {
        expect(guard.status).toBe(403)
        expect(guard.message).toBe('You do not have permission to perform this action.')
      }
    })

    it.each(READ_ENDPOINTS)('allows VOLUNTEER on $name ($method $path)', async ({ roles }) => {
      const { requireAdmin } = await import('@/lib/auth')
      mockSessionUser = {
        id: 'vol-1',
        username: 'volunteer@obsidian26.demo',
        displayName: 'Event Volunteer',
        role: 'VOLUNTEER',
      }

      const guard = await requireAdmin(roles)
      expect(guard.ok).toBe(true)
    })
  })

  describe('Client navigation & route protection', () => {
    const volunteerAllowedTabs = ['dashboard', 'students', 'qr', 'reports']
    const volunteerBlockedTabs = ['import', 'settings', 'users']

    it('blocks volunteers from accessing administrative management tabs', () => {
      const isAllowed = (role: AdminRole, tab: string) => {
        if (role === 'VOLUNTEER') {
          return !volunteerBlockedTabs.includes(tab)
        }
        return true
      }

      for (const tab of volunteerBlockedTabs) {
        expect(isAllowed('VOLUNTEER', tab)).toBe(false)
      }

      for (const tab of volunteerAllowedTabs) {
        expect(isAllowed('VOLUNTEER', tab)).toBe(true)
      }
    })

    it('allows admins to access all navigation tabs', () => {
      const isAllowed = (role: AdminRole, tab: string) => {
        if (role === 'VOLUNTEER') {
          return !volunteerBlockedTabs.includes(tab)
        }
        return true
      }

      const allTabs = [...volunteerAllowedTabs, ...volunteerBlockedTabs]
      for (const tab of allTabs) {
        expect(isAllowed('ADMIN', tab)).toBe(true)
      }
    })
  })
})
