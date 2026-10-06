import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { courseApi, type CourseInput, type ModuleInput } from '@/api/courseApi'
import { INVALIDATE, useApiMutation } from '@/hooks/useApiMutation'
import type { ListParams } from '@/types'

export const useCourses = (params: ListParams) => useQuery({ queryKey: ['courses', 'list', params], queryFn: () => courseApi.list(params), placeholderData: keepPreviousData })
export const useCourse = (id: string) => useQuery({ queryKey: ['courses', 'detail', id], queryFn: () => courseApi.get(id) })
export const useCourseModules = (id: string) => useQuery({ queryKey: ['courses', 'modules', id], queryFn: () => courseApi.modules(id) })

export const useCreateCourse = () => useApiMutation({ mutationFn: (b: CourseInput) => courseApi.create(b), success: (c) => `Course ${c.name} created`, invalidate: INVALIDATE.academic, silentError: true })
export const useUpdateCourse = () => useApiMutation({ mutationFn: (v: { id: string; body: CourseInput }) => courseApi.update(v.id, v.body), success: 'Course updated', invalidate: INVALIDATE.academic, silentError: true })
export const useDeleteCourse = () => useApiMutation({ mutationFn: (id: string) => courseApi.remove(id), success: 'Course archived', invalidate: INVALIDATE.academic })
export const useAddModule = () => useApiMutation({ mutationFn: (v: { courseId: string; body: ModuleInput }) => courseApi.addModule(v.courseId, v.body), success: 'Module added', invalidate: INVALIDATE.academic, silentError: true })
export const useUpdateModule = () => useApiMutation({ mutationFn: (v: { id: string; body: ModuleInput }) => courseApi.updateModule(v.id, v.body), success: 'Module updated', invalidate: INVALIDATE.academic, silentError: true })
export const useRemoveModule = () => useApiMutation({ mutationFn: (id: string) => courseApi.removeModule(id), success: 'Module removed', invalidate: INVALIDATE.academic })
export const useReorderModules = () => useApiMutation({ mutationFn: (v: { courseId: string; orderedIds: string[] }) => courseApi.reorderModules(v.courseId, v.orderedIds), invalidate: INVALIDATE.academic })
