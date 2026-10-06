import { lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Permission } from '@/constants/permissions'
import { AppLayout } from '@/layouts/AppLayout'
import { PublicOnly, RequireAuth, RequirePermission } from './guards'

// Every page is lazy-loaded so the initial bundle stays small.
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const VerifyCertificatePage = lazy(() => import('@/features/certificates/VerifyCertificatePage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const LeadsPage = lazy(() => import('@/features/leads/LeadsPage'))
const LeadDetailPage = lazy(() => import('@/features/leads/LeadDetailPage'))
const FollowUpsPage = lazy(() => import('@/features/leads/FollowUpsPage'))
const ApplicationsPage = lazy(() => import('@/features/applications/ApplicationsPage'))
const ApplicationDetailPage = lazy(() => import('@/features/applications/ApplicationDetailPage'))
const StudentsPage = lazy(() => import('@/features/students/StudentsPage'))
const ActiveStudentsPage = lazy(() => import('@/features/students/StudentsPage').then((m) => ({ default: m.ActiveStudentsPage })))
const CompletedStudentsPage = lazy(() => import('@/features/students/StudentsPage').then((m) => ({ default: m.CompletedStudentsPage })))
const StudentDetailPage = lazy(() => import('@/features/students/StudentDetailPage'))
const CoursesPage = lazy(() => import('@/features/courses/CoursesPage'))
const CourseDetailPage = lazy(() => import('@/features/courses/CourseDetailPage'))
const BatchesPage = lazy(() => import('@/features/batches/BatchesPage'))
const BatchDetailPage = lazy(() => import('@/features/batches/BatchDetailPage'))
const TrainersPage = lazy(() => import('@/features/batches/TrainersPage'))
const AttendancePage = lazy(() => import('@/features/attendance/AttendancePage'))
const AssignmentsPage = lazy(() => import('@/features/attendance/AssignmentsPage'))
const ProgressPage = lazy(() => import('@/features/attendance/ProgressPage'))
const FeesPage = lazy(() => import('@/features/payments/FeesPage'))
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage'))
const PendingPaymentsPage = lazy(() => import('@/features/payments/PendingPaymentsPage'))
const PaymentDetailPage = lazy(() => import('@/features/payments/PaymentDetailPage'))
const InvoicesPage = lazy(() => import('@/features/payments/InvoicesPage'))
const InvoiceViewPage = lazy(() => import('@/features/payments/InvoiceViewPage'))
const RefundsPage = lazy(() => import('@/features/payments/RefundsPage'))
const CertificatesPage = lazy(() => import('@/features/certificates/CertificatesPage'))
const CertificateDetailPage = lazy(() => import('@/features/certificates/CertificateDetailPage'))
const EmployeesPage = lazy(() => import('@/features/admin/EmployeesPage'))
const RolesPage = lazy(() => import('@/features/admin/RolesPage'))
const AuditLogsPage = lazy(() => import('@/features/admin/AuditLogsPage'))
const SettingsPage = lazy(() => import('@/features/admin/SettingsPage'))
const StudentReportPage = lazy(() => import('@/features/reports/ReportPages').then((m) => ({ default: m.StudentReportPage })))
const FinancialReportPage = lazy(() => import('@/features/reports/ReportPages').then((m) => ({ default: m.FinancialReportPage })))
const BusinessReportPage = lazy(() => import('@/features/reports/ReportPages').then((m) => ({ default: m.BusinessReportPage })))
const EmployeeReportPage = lazy(() => import('@/features/reports/ReportPages').then((m) => ({ default: m.EmployeeReportPage })))

interface AppRoute {
  path: string
  permission: Permission | Permission[]
  element: ReactNode
}

/** Route table: each entry is guarded by the permission the matching API endpoints require. */
const protectedRoutes: AppRoute[] = [
  { path: '/dashboard', permission: 'dashboard:view', element: <DashboardPage /> },

  { path: '/leads', permission: 'leads:view', element: <LeadsPage /> },
  { path: '/leads/:id', permission: 'leads:view', element: <LeadDetailPage /> },
  { path: '/follow-ups', permission: 'followups:view', element: <FollowUpsPage /> },
  { path: '/applications', permission: 'applications:view', element: <ApplicationsPage /> },
  { path: '/applications/:id', permission: 'applications:view', element: <ApplicationDetailPage /> },

  { path: '/students', permission: 'students:view', element: <StudentsPage /> },
  { path: '/students/active', permission: 'students:view', element: <ActiveStudentsPage /> },
  { path: '/students/completed', permission: 'students:view', element: <CompletedStudentsPage /> },
  { path: '/students/:id', permission: 'students:view', element: <StudentDetailPage /> },

  { path: '/courses', permission: 'courses:view', element: <CoursesPage /> },
  { path: '/courses/:id', permission: 'courses:view', element: <CourseDetailPage /> },
  { path: '/batches', permission: 'batches:view', element: <BatchesPage /> },
  { path: '/batches/:id', permission: 'batches:view', element: <BatchDetailPage /> },
  { path: '/trainers', permission: 'trainers:view', element: <TrainersPage /> },
  { path: '/attendance', permission: 'attendance:view', element: <AttendancePage /> },
  { path: '/assignments', permission: 'assignments:view', element: <AssignmentsPage /> },
  { path: '/progress', permission: 'progress:view', element: <ProgressPage /> },

  { path: '/fees', permission: 'fees:view', element: <FeesPage /> },
  { path: '/payments', permission: 'payments:view', element: <PaymentsPage /> },
  { path: '/payments/pending', permission: 'payments:view', element: <PendingPaymentsPage /> },
  { path: '/payments/:id', permission: 'payments:view', element: <PaymentDetailPage /> },
  { path: '/invoices', permission: 'invoices:view', element: <InvoicesPage /> },
  { path: '/invoices/:id', permission: 'invoices:view', element: <InvoiceViewPage /> },
  { path: '/refunds', permission: 'refunds:view', element: <RefundsPage /> },

  { path: '/certificates', permission: 'certificates:view', element: <CertificatesPage /> },
  { path: '/certificates/:id', permission: 'certificates:view', element: <CertificateDetailPage /> },

  { path: '/reports/business', permission: 'financialReports:view', element: <BusinessReportPage /> },
  { path: '/reports/students', permission: 'reports:view', element: <StudentReportPage /> },
  { path: '/reports/financial', permission: 'financialReports:view', element: <FinancialReportPage /> },
  { path: '/reports/employees', permission: 'reports:view', element: <EmployeeReportPage /> },

  { path: '/employees', permission: 'employees:view', element: <EmployeesPage /> },
  { path: '/roles', permission: 'roles:view', element: <RolesPage /> },
  { path: '/audit-logs', permission: 'audit:view', element: <AuditLogsPage /> },
  { path: '/settings', permission: 'settings:view', element: <SettingsPage /> },
]

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      {/* Public: certificate verification needs no account. */}
      <Route path="/verify" element={<VerifyCertificatePage />} />
      <Route path="/verify/:certificateId" element={<VerifyCertificatePage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/reports" element={<Navigate to="/reports/students" replace />} />
          {protectedRoutes.map((r) => (
            <Route key={r.path} path={r.path} element={<RequirePermission permission={r.permission}>{r.element}</RequirePermission>} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
