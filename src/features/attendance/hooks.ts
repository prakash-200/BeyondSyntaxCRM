import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { assignmentApi, type AssignmentInput } from '@/api/assignmentApi'
import { attendanceApi } from '@/api/attendanceApi'
import { courseApi } from '@/api/courseApi'
import type { AttendanceStatus } from '@/constants/enums'
import { useApiMutation } from '@/hooks/useApiMutation'
import type { AssignmentSubmission, ListParams } from '@/types'

const ATT = ['attendance', 'batches', 'students', 'activity', 'audit', 'dashboard', 'reports', 'applications']
const ASG = ['assignments', 'students', 'activity', 'audit', 'dashboard']

export const useSessions = (params: ListParams) => useQuery({ queryKey: ['attendance', 'sessions', params], queryFn: () => attendanceApi.sessions(params), placeholderData: keepPreviousData })
export const useSession = (id: string | null) => useQuery({ queryKey: ['attendance', 'session', id], queryFn: () => attendanceApi.session(id!), enabled: !!id })
export const useAttendanceSummary = (batchId: string) => useQuery({ queryKey: ['attendance', 'summary', batchId], queryFn: () => attendanceApi.summary(batchId), enabled: !!batchId })
export const useCreateSession = () => useApiMutation({ mutationFn: (b: Parameters<typeof attendanceApi.createSession>[0]) => attendanceApi.createSession(b), invalidate: ['attendance'], silentError: true })
export const useSaveAttendance = () => useApiMutation({ mutationFn: (v: { id: string; records: { studentId: string; status: AttendanceStatus }[] }) => attendanceApi.save(v.id, v.records), success: 'Attendance saved', invalidate: ATT })

export const useAssignments = (params: ListParams) => useQuery({ queryKey: ['assignments', 'list', params], queryFn: () => assignmentApi.list(params), placeholderData: keepPreviousData })
export const useSubmissions = (assignmentId: string | null) => useQuery({ queryKey: ['assignments', 'submissions', assignmentId], queryFn: () => assignmentApi.submissions(assignmentId!), enabled: !!assignmentId })
export const useCourseModulesFor = (courseId: string) => useQuery({ queryKey: ['courses', 'modules', courseId], queryFn: () => courseApi.modules(courseId), enabled: !!courseId })
export const useCreateAssignment = () => useApiMutation({ mutationFn: (b: AssignmentInput) => assignmentApi.create(b), success: 'Assignment created', invalidate: ASG, silentError: true })
export const useUpdateAssignment = () => useApiMutation({ mutationFn: (v: { id: string; body: AssignmentInput }) => assignmentApi.update(v.id, v.body), success: 'Assignment updated', invalidate: ASG, silentError: true })
export const useDeleteAssignment = () => useApiMutation({ mutationFn: (id: string) => assignmentApi.remove(id), success: 'Assignment deleted', invalidate: ASG })
export const useGradeSubmission = () => useApiMutation({ mutationFn: (v: { id: string; body: Partial<Pick<AssignmentSubmission, 'status' | 'score' | 'feedback'>> }) => assignmentApi.grade(v.id, v.body), success: 'Submission saved', invalidate: ASG, silentError: true })
