import type { Role } from './enums'
import { ROLES } from './enums'

/**
 * Permission model: "<resource>:<action>". The same strings are meant to be
 * issued as claims by the ASP.NET Core API and enforced by policy handlers.
 */
export const RESOURCES = [
  'dashboard',
  'leads',
  'followups',
  'applications',
  'students',
  'courses',
  'batches',
  'trainers',
  'attendance',
  'assignments',
  'progress',
  'fees',
  'payments',
  'invoices',
  'refunds',
  'certificates',
  'reports',
  'financialReports',
  'employees',
  'roles',
  'audit',
  'settings',
] as const
export const ACTIONS = ['view', 'create', 'update', 'delete', 'approve'] as const

export type Resource = (typeof RESOURCES)[number]
export type Action = (typeof ACTIONS)[number]
export type Permission = `${Resource}:${Action}`

export const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  followups: 'Follow-ups',
  applications: 'Applications',
  students: 'Students',
  courses: 'Courses',
  batches: 'Batches',
  trainers: 'Trainers',
  attendance: 'Attendance',
  assignments: 'Assignments',
  progress: 'Student Progress',
  fees: 'Fees & Installments',
  payments: 'Payments',
  invoices: 'Invoices',
  refunds: 'Refunds',
  certificates: 'Certificates',
  reports: 'Reports',
  financialReports: 'Financial Reports',
  employees: 'Employees',
  roles: 'Roles & Permissions',
  audit: 'Audit Logs',
  settings: 'Settings',
}

export const ACTION_LABELS: Record<Action, string> = {
  view: 'View',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve / Issue',
}

const p = (resource: Resource, ...actions: Action[]): Permission[] =>
  actions.map((a) => `${resource}:${a}` as Permission)

const ALL: Permission[] = RESOURCES.flatMap((r) => ACTIONS.map((a) => `${r}:${a}` as Permission))
const CRUD: Action[] = ['view', 'create', 'update', 'delete']

/** Default role → permission matrix (editable at runtime by Super Admin). */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ALL.filter((x) => !['roles:create', 'roles:update', 'roles:delete', 'roles:approve'].includes(x)),
  COUNSELOR: [
    ...p('dashboard', 'view'),
    ...p('leads', ...CRUD),
    ...p('followups', ...CRUD),
    ...p('applications', 'view', 'create', 'update'),
    ...p('students', 'view', 'create', 'update'),
    ...p('courses', 'view'),
    ...p('batches', 'view'),
    ...p('reports', 'view'),
    ...p('certificates', 'view'),
  ],
  ACCOUNTANT: [
    ...p('dashboard', 'view'),
    ...p('students', 'view'),
    ...p('fees', 'view', 'create', 'update'),
    ...p('payments', 'view', 'create', 'update'),
    ...p('invoices', 'view', 'create'),
    ...p('refunds', 'view', 'create'),
    ...p('reports', 'view'),
    ...p('financialReports', 'view'),
  ],
  TRAINER: [
    ...p('dashboard', 'view'),
    ...p('students', 'view'),
    ...p('courses', 'view'),
    ...p('batches', 'view'),
    ...p('trainers', 'view'),
    ...p('attendance', 'view', 'create', 'update'),
    ...p('assignments', ...CRUD),
    ...p('progress', 'view', 'update'),
    ...p('reports', 'view'),
    ...p('certificates', 'view'),
  ],
}

export function cloneDefaultMatrix(): Record<Role, Permission[]> {
  return Object.fromEntries(ROLES.map((r) => [r, [...DEFAULT_ROLE_PERMISSIONS[r]]])) as Record<Role, Permission[]>
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  COUNSELOR: 'Counselor',
  ACCOUNTANT: 'Accountant',
  TRAINER: 'Trainer',
}
