import {
  Award,
  BarChart3,
  Banknote,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  Layers,
  LayoutDashboard,
  LineChart,
  Receipt,
  RotateCcw,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  Clock4,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from './permissions'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  permission: Permission | Permission[]
  end?: boolean
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

/** Sidebar structure. Items are filtered by the signed-in employee's permissions. */
export const NAVIGATION: NavSection[] = [
  { items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard:view' }] },
  {
    title: 'CRM',
    items: [
      { label: 'Leads', to: '/leads', icon: UserPlus, permission: 'leads:view' },
      { label: 'Follow-ups', to: '/follow-ups', icon: CalendarClock, permission: 'followups:view' },
      { label: 'Applications', to: '/applications', icon: ClipboardList, permission: 'applications:view' },
    ],
  },
  {
    title: 'Students',
    items: [
      { label: 'All Students', to: '/students', icon: Users, permission: 'students:view', end: true },
      { label: 'Active Students', to: '/students/active', icon: UserCheck, permission: 'students:view' },
      { label: 'Completed Students', to: '/students/completed', icon: GraduationCap, permission: 'students:view' },
      { label: 'Certificates', to: '/certificates', icon: Award, permission: 'certificates:view' },
    ],
  },
  {
    title: 'Training',
    items: [
      { label: 'Courses', to: '/courses', icon: BookOpen, permission: 'courses:view' },
      { label: 'Batches', to: '/batches', icon: Layers, permission: 'batches:view' },
      { label: 'Trainers', to: '/trainers', icon: UsersRound, permission: 'trainers:view' },
      { label: 'Attendance', to: '/attendance', icon: CalendarCheck, permission: 'attendance:view' },
      { label: 'Assignments', to: '/assignments', icon: ClipboardCheck, permission: 'assignments:view' },
      { label: 'Progress', to: '/progress', icon: TrendingUp, permission: 'progress:view' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Fee Management', to: '/fees', icon: Wallet, permission: 'fees:view' },
      { label: 'Payments', to: '/payments', icon: Banknote, permission: 'payments:view', end: true },
      { label: 'Pending Payments', to: '/payments/pending', icon: Clock4, permission: 'payments:view' },
      { label: 'Invoices', to: '/invoices', icon: Receipt, permission: 'invoices:view' },
      { label: 'Refunds', to: '/refunds', icon: RotateCcw, permission: 'refunds:view' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Business Reports', to: '/reports/business', icon: BarChart3, permission: 'financialReports:view' },
      { label: 'Student Reports', to: '/reports/students', icon: FileText, permission: 'reports:view' },
      { label: 'Financial Reports', to: '/reports/financial', icon: LineChart, permission: 'financialReports:view' },
      { label: 'Employee Performance', to: '/reports/employees', icon: UserCog, permission: 'reports:view' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Employees', to: '/employees', icon: Users, permission: 'employees:view' },
      { label: 'Roles & Permissions', to: '/roles', icon: ShieldCheck, permission: 'roles:view' },
      { label: 'Audit Logs', to: '/audit-logs', icon: History, permission: 'audit:view' },
      { label: 'Settings', to: '/settings', icon: Settings, permission: 'settings:view' },
    ],
  },
]
