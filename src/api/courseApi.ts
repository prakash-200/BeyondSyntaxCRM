import type { Course, CourseModule, ListParams, Paged } from '@/types'
import { http } from './apiClient'

export type CourseInput = Partial<Pick<Course, 'name' | 'code' | 'category' | 'description' | 'durationMonths' | 'mode' | 'totalFee' | 'discountRules' | 'status'>> & { reason?: string }
export type ModuleInput = Partial<Pick<CourseModule, 'name' | 'description' | 'durationWeeks'>>

export const courseApi = {
  list: (params: ListParams) => http.get<Paged<Course>>('/courses', params),
  get: (id: string) => http.get<Course>(`/courses/${id}`),
  create: (body: CourseInput) => http.post<Course>('/courses', body),
  update: (id: string, body: CourseInput) => http.put<Course>(`/courses/${id}`, body),
  remove: (id: string) => http.delete<{ ok: boolean }>(`/courses/${id}`),
  modules: (courseId: string) => http.get<CourseModule[]>(`/courses/${courseId}/modules`),
  addModule: (courseId: string, body: ModuleInput) => http.post<CourseModule>(`/courses/${courseId}/modules`, body),
  updateModule: (id: string, body: ModuleInput) => http.put<CourseModule>(`/modules/${id}`, body),
  removeModule: (id: string) => http.delete<{ ok: boolean }>(`/modules/${id}`),
  reorderModules: (courseId: string, orderedIds: string[]) => http.put<CourseModule[]>(`/courses/${courseId}/modules/reorder`, { orderedIds }),
}
