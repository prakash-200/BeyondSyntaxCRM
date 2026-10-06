/**
 * Domain enumerations. Values are SCREAMING_SNAKE strings so they map 1:1 to
 * ASP.NET Core enums serialised with JsonStringEnumConverter.
 */

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'COUNSELOR', 'ACCOUNTANT', 'TRAINER'] as const
export const LEAD_SOURCES = [
  'WEBSITE',
  'INSTAGRAM',
  'YOUTUBE',
  'WHATSAPP',
  'REFERRAL',
  'WALK_IN',
  'ADVERTISEMENT',
  'OTHER',
] as const
export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'COUNSELLING_SCHEDULED',
  'COUNSELLING_COMPLETED',
  'INTERESTED',
  'NOT_INTERESTED',
  'FOLLOW_UP',
  'CONVERTED',
  'LOST',
] as const
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export const FOLLOW_UP_TYPES = ['PHONE_CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'COUNSELLING'] as const
export const FOLLOW_UP_STATUSES = ['PENDING', 'COMPLETED', 'RESCHEDULED', 'CANCELLED'] as const
export const APPLICATION_STATUSES = [
  'NEW',
  'CONTACTED',
  'COUNSELLING',
  'APPLICATION_SUBMITTED',
  'ADMISSION_APPROVED',
  'PAYMENT_PENDING',
  'PAYMENT_COMPLETED',
  'BATCH_ASSIGNED',
  'TRAINING_STARTED',
  'TRAINING_COMPLETED',
  'CANCELLED',
] as const
export const STUDENT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'DROPPED', 'CANCELLED'] as const
export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const
export const COURSE_CATEGORIES = [
  'PROGRAMMING',
  'FULL_STACK_DEVELOPMENT',
  'DATA_ANALYTICS',
  'AI_ML',
  'VIDEO_EDITING',
  'DESIGN',
  'OTHER',
] as const
export const COURSE_MODES = ['ONLINE', 'OFFLINE', 'HYBRID'] as const
export const ACTIVE_STATES = ['ACTIVE', 'INACTIVE'] as const
export const BATCH_STATUSES = ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const
export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const
export const SUBMISSION_STATUSES = ['NOT_STARTED', 'SUBMITTED', 'REVIEWED', 'LATE'] as const
export const INSTALLMENT_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'] as const
export const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'PAYMENT_GATEWAY', 'OTHER'] as const
export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const
export const FEE_STATUSES = ['PAID', 'PARTIALLY_PAID', 'PENDING', 'OVERDUE'] as const
export const DOCUMENT_CATEGORIES = [
  'ID_PROOF',
  'EDUCATION',
  'APPLICATION',
  'PAYMENT_RECEIPT',
  'CERTIFICATE',
  'OTHER',
] as const
export const DEPARTMENTS = ['Administration', 'Admissions', 'Accounts', 'Training'] as const
export const EDUCATION_LEVELS = [
  '12th Pass',
  'Diploma',
  'B.E / B.Tech',
  'B.Sc',
  'BCA',
  'B.Com',
  'BBA',
  'B.A',
  'MCA',
  'M.Tech',
  'M.Sc',
  'MBA',
  'Other',
] as const

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'LEAD_DELETED',
  'LEAD_STATUS_CHANGED',
  'LEAD_ASSIGNED',
  'LEAD_CONVERTED',
  'NOTE_ADDED',
  'FOLLOW_UP_SCHEDULED',
  'FOLLOW_UP_COMPLETED',
  'FOLLOW_UP_RESCHEDULED',
  'APPLICATION_CREATED',
  'APPLICATION_STATUS_CHANGED',
  'APPLICATION_APPROVED',
  'STUDENT_CREATED',
  'STUDENT_UPDATED',
  'STUDENT_STATUS_CHANGED',
  'STUDENT_DELETED',
  'BATCH_CREATED',
  'BATCH_UPDATED',
  'BATCH_ASSIGNED',
  'BATCH_CHANGED',
  'BATCH_REMOVED',
  'COURSE_CREATED',
  'COURSE_UPDATED',
  'MODULES_REORDERED',
  'FEE_PLAN_CREATED',
  'FEE_CHANGED',
  'PAYMENT_ADDED',
  'PAYMENT_MODIFIED',
  'REFUND_ISSUED',
  'ATTENDANCE_UPDATED',
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_GRADED',
  'PROGRESS_UPDATED',
  'COURSE_COMPLETED',
  'CERTIFICATE_ISSUED',
  'DOCUMENT_UPLOADED',
  'EMPLOYEE_CREATED',
  'EMPLOYEE_UPDATED',
  'EMPLOYEE_STATUS_CHANGED',
  'PERMISSIONS_CHANGED',
  'SETTINGS_UPDATED',
] as const

export const ENTITY_TYPES = [
  'AUTH',
  'LEAD',
  'FOLLOW_UP',
  'APPLICATION',
  'STUDENT',
  'COURSE',
  'MODULE',
  'BATCH',
  'FEE_PLAN',
  'PAYMENT',
  'INVOICE',
  'REFUND',
  'ATTENDANCE',
  'ASSIGNMENT',
  'CERTIFICATE',
  'DOCUMENT',
  'EMPLOYEE',
  'ROLE',
  'SETTINGS',
] as const

export const NOTIFICATION_TYPES = [
  'NEW_LEAD',
  'FOLLOW_UP_DUE',
  'PAYMENT_OVERDUE',
  'NEW_APPLICATION',
  'BATCH_STARTING',
  'ATTENDANCE_ISSUE',
  'COURSE_COMPLETION',
  'CERTIFICATE_READY',
] as const

export type Role = (typeof ROLES)[number]
export type LeadSource = (typeof LEAD_SOURCES)[number]
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number]
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number]
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]
export type StudentStatus = (typeof STUDENT_STATUSES)[number]
export type Gender = (typeof GENDERS)[number]
export type CourseCategory = (typeof COURSE_CATEGORIES)[number]
export type CourseMode = (typeof COURSE_MODES)[number]
export type ActiveState = (typeof ACTIVE_STATES)[number]
export type BatchStatus = (typeof BATCH_STATUSES)[number]
export type Weekday = (typeof WEEKDAYS)[number]
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number]
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export type FeeStatus = (typeof FEE_STATUSES)[number]
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
export type EntityType = (typeof ENTITY_TYPES)[number]
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
