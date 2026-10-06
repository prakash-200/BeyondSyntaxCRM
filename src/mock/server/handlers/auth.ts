import type { AuthSession } from '@/types'
import { issueTokens } from '../tokens'
import { badRequest, get, HttpError, post, type Ctx } from '../router'
import { audit, toUser } from './helpers'

function sessionFor(ctx: Ctx, empId: string): AuthSession {
  const emp = ctx.db.employees.find((e) => e.id === empId)!
  return { ...issueTokens(emp.id), user: toUser(emp), permissions: ctx.db.rolePermissions[emp.role] }
}

post('/auth/login', 'public', (ctx) => {
  const { email, password } = ctx.body ?? {}
  if (!email || !password) throw badRequest('Email and password are required')
  const emp = ctx.db.employees.find((e) => e.email.toLowerCase() === String(email).toLowerCase())
  if (!emp || ctx.db.credentials[emp.email] !== password) throw new HttpError(401, 'Invalid email or password')
  if (emp.status !== 'ACTIVE') throw new HttpError(403, 'This account has been deactivated. Contact an administrator.')
  ctx.user = emp
  audit(ctx, { action: 'LOGIN', entityType: 'AUTH', entityId: emp.id, entityLabel: emp.name, description: `${emp.name} signed in` })
  return sessionFor(ctx, emp.id)
})

post('/auth/refresh', 'public', (ctx) => {
  const token = String(ctx.body?.refreshToken ?? '')
  const [kind, empId] = token.split('.')
  const emp = ctx.db.employees.find((e) => e.id === empId)
  if (kind !== 'mockr' || !emp || emp.status !== 'ACTIVE') throw new HttpError(401, 'Refresh token is invalid')
  return sessionFor(ctx, emp.id)
})

get('/auth/me', 'authenticated', (ctx) => sessionFor(ctx, ctx.user.id))

post('/auth/logout', 'authenticated', () => ({ ok: true }))

post('/auth/forgot-password', 'public', (ctx) => {
  if (!ctx.body?.email) throw badRequest('Email is required')
  // Always succeed so account existence is not leaked.
  return { ok: true }
})
