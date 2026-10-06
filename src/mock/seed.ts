import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getDay,
  isAfter,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns'
import type { ApplicationStatus, AttendanceStatus, LeadSource, LeadStatus, PaymentMethod, StudentStatus, Weekday } from '@/constants/enums'
import { cloneDefaultMatrix } from '@/constants/permissions'
import { humanize } from '@/constants/labels'
import type {
  Application,
  Assignment,
  AssignmentSubmission,
  Attendance,
  Batch,
  BatchStudent,
  Certificate,
  ClassSession,
  Course,
  CourseModule,
  Employee,
  FollowUp,
  Installment,
  Lead,
  Payment,
  Refund,
  StoredDocument,
  Student,
  StudentProgress,
} from '@/types'
import { ANCHOR_DATE, nowIso } from '@/utils/clock'
import { discountedFee, splitAmount } from '@/utils/calc'
import { CITIES, COLLEGES, FEMALE_NAMES, MALE_NAMES, OCCUPATIONS, STREETS, SURNAMES } from './names'
import { makeRng } from './rng'
import { advanceApplication, logAudit, pushNotification, syncCounter, type Db, type StoredFeePlan, type StoredInvoice } from './db'

type StudentState = 'completed' | 'active' | 'hold' | 'dropped' | 'upcoming' | 'nobatch' | 'cancelled'

interface StudentMeta {
  student: Student
  state: StudentState
  batch: Batch | null
  joinedAt: Date
  endedAt: Date | null
  application: Application
  propensity: number
}

const TODAY_STR = '2026-10-05'

export function buildSeed(): Db {
  const rng = makeRng(20261005)
  const today = parseISO(TODAY_STR)
  const f = (d: Date) => format(d, 'yyyy-MM-dd')
  const stamp = (d: Date | string, h: number, m = 0): string => {
    const date = typeof d === 'string' ? parseISO(d) : new Date(d)
    date.setHours(h, m, 0, 0)
    const iso = date.toISOString()
    const limit = nowIso()
    return iso > limit ? new Date(ANCHOR_DATE.getTime() - 60_000 * rng.int(5, 90)).toISOString() : iso
  }

  /* ───────────── Employees ───────────── */
  const employees: Employee[] = [
    { id: 'EMP-001', name: 'Arjun Mehta', email: 'superadmin@company.com', phone: '9845012345', role: 'SUPER_ADMIN', department: 'Administration', joiningDate: '2019-04-01', status: 'ACTIVE' },
    { id: 'EMP-002', name: 'Neha Kapoor', email: 'admin@company.com', phone: '9845023456', role: 'ADMIN', department: 'Administration', joiningDate: '2020-06-15', status: 'ACTIVE' },
    { id: 'EMP-003', name: 'Priya Nair', email: 'counselor@company.com', phone: '9886034567', role: 'COUNSELOR', department: 'Admissions', joiningDate: '2021-02-08', status: 'ACTIVE' },
    { id: 'EMP-004', name: 'Rohit Sharma', email: 'rohit.sharma@company.com', phone: '9886045678', role: 'COUNSELOR', department: 'Admissions', joiningDate: '2022-07-11', status: 'ACTIVE' },
    { id: 'EMP-005', name: 'Sneha Iyer', email: 'sneha.iyer@company.com', phone: '9741056789', role: 'COUNSELOR', department: 'Admissions', joiningDate: '2023-01-16', status: 'ACTIVE' },
    { id: 'EMP-006', name: 'Vikram Singh', email: 'accountant@company.com', phone: '9741067890', role: 'ACCOUNTANT', department: 'Accounts', joiningDate: '2020-11-02', status: 'ACTIVE' },
    { id: 'EMP-007', name: 'Prakash Rao', email: 'trainer@company.com', phone: '9632078901', role: 'TRAINER', department: 'Training', joiningDate: '2020-01-20', status: 'ACTIVE', specialization: 'C#, ASP.NET Core, Azure', courseIds: ['CRS-001'] },
    { id: 'EMP-008', name: 'Anita Desai', email: 'anita.desai@company.com', phone: '9632089012', role: 'TRAINER', department: 'Training', joiningDate: '2021-09-06', status: 'ACTIVE', specialization: 'Java, Spring Boot, Data Analytics, ML', courseIds: ['CRS-002', 'CRS-005', 'CRS-006'] },
    { id: 'EMP-009', name: 'Karthik Subramanian', email: 'karthik.s@company.com', phone: '9448090123', role: 'TRAINER', department: 'Training', joiningDate: '2022-03-14', status: 'ACTIVE', specialization: 'Python, MERN Stack', courseIds: ['CRS-003', 'CRS-004'] },
    { id: 'EMP-010', name: 'Meera Joshi', email: 'meera.joshi@company.com', phone: '9448001234', role: 'TRAINER', department: 'Training', joiningDate: '2023-05-22', status: 'ACTIVE', specialization: 'Video Editing, UI/UX Design', courseIds: ['CRS-007', 'CRS-008'] },
  ]
  const credentials = Object.fromEntries(employees.map((e) => [e.email, 'Password@123']))
  const empName = (id: string) => employees.find((e) => e.id === id)!.name
  const pickCounselor = () => rng.weighted([['EMP-003', 45], ['EMP-004', 30], ['EMP-005', 25]] as const)
  const sys = (id: string) => ({ id, name: empName(id) })

  /* ───────────── Courses & modules ───────────── */
  const courseDefs: {
    code: string
    name: string
    category: Course['category']
    months: number
    fee: number
    mode: Course['mode']
    description: string
    modules: string[]
  }[] = [
    { code: 'DOTNET', name: 'Full Stack .NET', category: 'FULL_STACK_DEVELOPMENT', months: 6, fee: 35000, mode: 'HYBRID', description: 'Job-ready full stack program covering C#, SQL, ASP.NET Core Web API, Angular and Azure deployment with real-world projects.', modules: ['C#', 'SQL', 'HTML/CSS', 'JavaScript', 'ASP.NET Core', 'Web API', 'Angular', 'Azure', 'Final Project'] },
    { code: 'JAVA', name: 'Java Full Stack', category: 'FULL_STACK_DEVELOPMENT', months: 6, fee: 32000, mode: 'ONLINE', description: 'Core Java to Spring Boot microservices with a React front end and CI/CD fundamentals.', modules: ['Core Java', 'OOP & Collections', 'SQL & JDBC', 'Spring Boot', 'REST APIs', 'React', 'Microservices', 'DevOps Basics', 'Capstone Project'] },
    { code: 'PYTHON', name: 'Python Programming', category: 'PROGRAMMING', months: 3, fee: 18000, mode: 'OFFLINE', description: 'Beginner-friendly Python covering data structures, OOP, file handling and web basics with Flask.', modules: ['Python Basics', 'Data Structures', 'OOP in Python', 'Files & Exceptions', 'Modules & Packages', 'Flask', 'Databases', 'Mini Project'] },
    { code: 'MERN', name: 'MERN Full Stack', category: 'FULL_STACK_DEVELOPMENT', months: 5, fee: 30000, mode: 'HYBRID', description: 'MongoDB, Express, React and Node.js with authentication, deployment and a capstone application.', modules: ['HTML/CSS', 'JavaScript ES6', 'React', 'Node.js', 'Express', 'MongoDB', 'Authentication', 'Deployment', 'Capstone Project'] },
    { code: 'DATA', name: 'Data Analytics', category: 'DATA_ANALYTICS', months: 4, fee: 25000, mode: 'OFFLINE', description: 'Excel, SQL, Python and Power BI for business analytics with dashboard projects.', modules: ['Excel', 'SQL', 'Python for Analytics', 'Pandas & NumPy', 'Power BI', 'Statistics', 'Dashboards', 'Capstone Project'] },
    { code: 'AIML', name: 'AI & Machine Learning', category: 'AI_ML', months: 6, fee: 45000, mode: 'ONLINE', description: 'Machine learning, deep learning, NLP and computer vision with MLOps fundamentals.', modules: ['Python Foundations', 'Maths for ML', 'ML Algorithms', 'Deep Learning', 'NLP', 'Computer Vision', 'MLOps', 'Capstone Project'] },
    { code: 'VIDEO', name: 'Video Editing Masterclass', category: 'VIDEO_EDITING', months: 3, fee: 20000, mode: 'OFFLINE', description: 'Professional editing with Premiere Pro and After Effects, colour grading, sound and YouTube workflows.', modules: ['Editing Fundamentals', 'Premiere Pro', 'Colour Grading', 'Audio Editing', 'After Effects', 'Motion Graphics', 'YouTube Workflow', 'Portfolio'] },
    { code: 'UIUX', name: 'UI/UX Design', category: 'DESIGN', months: 3, fee: 22000, mode: 'HYBRID', description: 'User research, Figma, prototyping and design systems with a portfolio case study.', modules: ['Design Principles', 'Figma', 'Prototyping', 'User Research', 'Design Systems', 'Case Study'] },
  ]
  const courses: Course[] = courseDefs.map((c, i) => ({
    id: `CRS-${String(i + 1).padStart(3, '0')}`,
    code: c.code,
    name: c.name,
    category: c.category,
    description: c.description,
    durationMonths: c.months,
    mode: c.mode,
    totalFee: c.fee,
    discountRules: [
      { label: 'Early-bird (enrol 15 days before start)', percent: 5 },
      { label: 'Referral discount', percent: 3 },
    ],
    status: 'ACTIVE',
  }))
  const modules: CourseModule[] = []
  courseDefs.forEach((c, ci) => {
    c.modules.forEach((name, mi) => {
      modules.push({
        id: `MOD-${String(modules.length + 1).padStart(3, '0')}`,
        courseId: courses[ci].id,
        name,
        description: `${name} — concepts, guided labs and graded exercises.`,
        sequence: mi + 1,
        durationWeeks: Math.max(2, Math.round((c.months * 4) / c.modules.length)),
        status: 'ACTIVE',
      })
    })
  })
  const courseByCode = (code: string) => courses.find((c) => c.code === code)!
  const modulesOf = (courseId: string) => modules.filter((m) => m.courseId === courseId).sort((a, b) => a.sequence - b.sequence)

  /* ───────────── Batches ───────────── */
  const mk = (
    n: number,
    name: string,
    code: string,
    trainerId: string,
    start: string,
    end: string,
    st: string,
    et: string,
    days: Weekday[],
    capacity: number,
    mode: Batch['mode'],
    location: string,
    status: Batch['status'],
  ): Batch => ({
    id: `BAT-${String(n).padStart(3, '0')}`,
    name,
    courseId: courseByCode(code).id,
    trainerId,
    startDate: start,
    endDate: end,
    startTime: st,
    endTime: et,
    days,
    capacity,
    currentStudentCount: 0,
    mode,
    location,
    status,
  })
  const WK: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI']
  const batches: Batch[] = [
    mk(1, 'DOTNET-OCT-2026-A', 'DOTNET', 'EMP-007', '2026-10-10', '2027-04-10', '19:00', '21:00', WK, 40, 'HYBRID', 'Indiranagar Campus, Bengaluru', 'UPCOMING'),
    mk(2, 'DOTNET-NOV-2026-B', 'DOTNET', 'EMP-007', '2026-11-07', '2027-05-07', '10:00', '13:00', ['SAT', 'SUN'], 30, 'OFFLINE', 'Indiranagar Campus, Bengaluru', 'UPCOMING'),
    mk(3, 'DOTNET-JUN-2026-A', 'DOTNET', 'EMP-007', '2026-06-15', '2026-12-15', '19:00', '21:00', WK, 40, 'HYBRID', 'Indiranagar Campus, Bengaluru', 'ACTIVE'),
    mk(4, 'JAVA-AUG-2026-A', 'JAVA', 'EMP-008', '2026-08-03', '2027-02-03', '17:30', '19:30', WK, 35, 'ONLINE', 'Online (Zoom)', 'ACTIVE'),
    mk(5, 'PYTHON-SEP-2026-A', 'PYTHON', 'EMP-009', '2026-09-01', '2026-12-01', '10:00', '12:00', ['MON', 'WED', 'FRI'], 30, 'OFFLINE', 'Koramangala Campus, Bengaluru', 'ACTIVE'),
    mk(6, 'MERN-JUL-2026-A', 'MERN', 'EMP-009', '2026-07-06', '2026-12-06', '17:00', '19:00', WK, 30, 'HYBRID', 'Indiranagar Campus, Bengaluru', 'ACTIVE'),
    mk(7, 'VIDEO-SEP-2026-A', 'VIDEO', 'EMP-010', '2026-09-07', '2026-12-07', '16:00', '18:00', ['TUE', 'THU', 'SAT'], 20, 'OFFLINE', 'Koramangala Campus, Bengaluru', 'ACTIVE'),
    mk(8, 'DATA-APR-2026-A', 'DATA', 'EMP-008', '2026-04-06', '2026-08-06', '10:00', '12:00', WK, 25, 'OFFLINE', 'Koramangala Campus, Bengaluru', 'COMPLETED'),
    mk(9, 'PYTHON-FEB-2026-A', 'PYTHON', 'EMP-009', '2026-02-02', '2026-05-02', '10:00', '12:00', ['MON', 'WED', 'FRI'], 30, 'OFFLINE', 'Koramangala Campus, Bengaluru', 'COMPLETED'),
    mk(10, 'AIML-NOV-2026-A', 'AIML', 'EMP-008', '2026-11-02', '2027-05-02', '19:30', '21:30', WK, 25, 'ONLINE', 'Online (Zoom)', 'UPCOMING'),
  ]
  const batch = (n: number) => batches[n - 1]

  /* ───────────── Students (with applications) ───────────── */
  const usedNames = new Set<string>(['Rahul Kumar', 'Rahul Sharma'])
  const makeName = (gender: 'MALE' | 'FEMALE') => {
    for (let i = 0; i < 200; i++) {
      const name = `${rng.pick(gender === 'MALE' ? MALE_NAMES : FEMALE_NAMES)} ${rng.pick(SURNAMES)}`
      if (!usedNames.has(name)) {
        usedNames.add(name)
        return name
      }
    }
    return `${rng.pick(MALE_NAMES)} ${rng.pick(SURNAMES)}`
  }
  const phone = () => `${rng.pick([6, 7, 8, 9])}${String(rng.int(0, 999999999)).padStart(9, '0')}`
  const emailFor = (name: string, i: number) => `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${i % 3 === 0 ? i : ''}@${rng.pick(['gmail.com', 'gmail.com', 'outlook.com', 'yahoo.in'])}`
  const sourceMix = () =>
    rng.weighted([['WEBSITE', 22], ['INSTAGRAM', 20], ['YOUTUBE', 14], ['WHATSAPP', 12], ['REFERRAL', 14], ['WALK_IN', 8], ['ADVERTISEMENT', 7], ['OTHER', 3]] as const) as LeadSource

  const plan: { batch: number | null; status: StudentStatus; state: StudentState; n: number; courseCode?: string }[] = [
    { batch: 9, status: 'COMPLETED', state: 'completed', n: 6 },
    { batch: 8, status: 'COMPLETED', state: 'completed', n: 6 },
    { batch: 3, status: 'ACTIVE', state: 'active', n: 16 },
    { batch: 4, status: 'ACTIVE', state: 'active', n: 11 },
    { batch: 5, status: 'ACTIVE', state: 'active', n: 9 },
    { batch: 6, status: 'ACTIVE', state: 'active', n: 10 },
    { batch: 7, status: 'ACTIVE', state: 'active', n: 10 },
    { batch: 3, status: 'ON_HOLD', state: 'hold', n: 2 },
    { batch: 4, status: 'ON_HOLD', state: 'hold', n: 1 },
    { batch: 5, status: 'ON_HOLD', state: 'hold', n: 1 },
    { batch: 6, status: 'ON_HOLD', state: 'hold', n: 1 },
    { batch: 7, status: 'ON_HOLD', state: 'hold', n: 1 },
    { batch: 3, status: 'DROPPED', state: 'dropped', n: 2 },
    { batch: 4, status: 'DROPPED', state: 'dropped', n: 1 },
    { batch: 6, status: 'DROPPED', state: 'dropped', n: 1 },
    { batch: 5, status: 'DROPPED', state: 'dropped', n: 1 },
    { batch: 1, status: 'ACTIVE', state: 'upcoming', n: 8 },
    { batch: 2, status: 'ACTIVE', state: 'upcoming', n: 2 },
    { batch: 10, status: 'ACTIVE', state: 'upcoming', n: 4 },
    { batch: null, status: 'ACTIVE', state: 'nobatch', n: 1, courseCode: 'DOTNET' },
    { batch: null, status: 'ACTIVE', state: 'nobatch', n: 1, courseCode: 'JAVA' },
    { batch: null, status: 'ACTIVE', state: 'nobatch', n: 1, courseCode: 'PYTHON' },
    { batch: null, status: 'ACTIVE', state: 'nobatch', n: 1, courseCode: 'DATA' },
    { batch: null, status: 'CANCELLED', state: 'cancelled', n: 3, courseCode: 'VIDEO' },
  ]

  const students: Student[] = []
  const applications: Application[] = []
  const metas: StudentMeta[] = []
  const batchStudents: BatchStudent[] = []
  let idx = 0

  for (const group of plan) {
    for (let k = 0; k < group.n; k++) {
      idx++
      const b = group.batch ? batch(group.batch) : null
      const course = b ? courses.find((c) => c.id === b.courseId)! : courseByCode(group.courseCode!)
      const isRahul = idx === 25
      const gender = rng.chance(0.52) ? 'MALE' : 'FEMALE'
      const fullName = isRahul ? 'Rahul Kumar' : makeName(gender)
      const loc = rng.pick(CITIES)

      // admission date
      let admission: Date
      if (isRahul) admission = parseISO('2026-08-05')
      else if (group.state === 'upcoming') admission = subDays(today, rng.int(1, 38))
      else if (group.state === 'nobatch') admission = subDays(today, rng.int(1, 9))
      else if (group.state === 'cancelled') admission = subDays(today, rng.int(35, 70))
      else if (group.state === 'completed') admission = subDays(parseISO(b!.startDate), rng.int(4, 20))
      else if (rng.chance(0.18)) admission = addDays(parseISO(b!.startDate), rng.int(3, 28))
      else admission = subDays(parseISO(b!.startDate), rng.int(3, 25))
      if (isAfter(admission, today)) admission = subDays(today, 1)

      const id = `STU-2026-${String(100 + idx).padStart(5, '0')}`
      const counselorId = isRahul ? 'EMP-003' : pickCounselor()
      const joinedAt = b ? addDays(admission, rng.int(1, 4)) : admission
      const joined = isAfter(joinedAt, today) ? today : joinedAt
      const appDate = subDays(admission, rng.int(6, 14))
      const appId = `APP-2026-${String(idx).padStart(4, '0')}`
      const graduationYear = rng.int(2018, 2026)

      const student: Student = {
        id,
        fullName,
        phone: phone(),
        email: emailFor(fullName, idx),
        dateOfBirth: f(subDays(today, 365 * rng.int(19, 32) + rng.int(0, 300))),
        gender,
        address: rng.pick(STREETS),
        city: loc.city,
        state: loc.state,
        postalCode: loc.pin,
        education: rng.pick(['B.E / B.Tech', 'B.E / B.Tech', 'BCA', 'B.Sc', 'MCA', 'B.Com', 'Diploma', 'MBA']),
        college: rng.pick(COLLEGES),
        graduationYear,
        experience: graduationYear >= 2025 ? 'Fresher' : `${rng.int(1, 4)} years`,
        currentOccupation: graduationYear >= 2025 ? 'Student' : rng.pick(OCCUPATIONS),
        source: sourceMix(),
        counselorId,
        status: group.status,
        leadId: null,
        applicationId: appId,
        courseId: course.id,
        batchId: b && group.state !== 'dropped' ? b.id : null,
        admissionDate: f(admission),
        completedAt: group.state === 'completed' ? b!.endDate : null,
        certificateId: null,
        createdAt: stamp(admission, 10, 15),
      }
      if (isRahul) {
        student.email = 'rahul.kumar@gmail.com'
        student.phone = '9876543210'
        student.city = 'Bengaluru'
        student.state = 'Karnataka'
        student.postalCode = '560034'
        student.education = 'B.E / B.Tech'
        student.graduationYear = 2025
        student.experience = 'Fresher'
        student.currentOccupation = 'Student'
        student.source = 'INSTAGRAM'
      }

      const application: Application = {
        id: appId,
        leadId: null,
        studentId: id,
        applicantName: fullName,
        phone: student.phone,
        email: student.email,
        courseId: course.id,
        preferredBatchId: b?.id ?? null,
        applicationDate: f(appDate),
        counselorId,
        status: 'NEW',
        notes: rng.pick([
          'Wants a placement-oriented program with weekday evening classes.',
          'Working professional looking to switch to software development.',
          'Final-year graduate; parents have been counselled about the fee plan.',
          'Referred by an existing student. Needs EMI-style installments.',
          'Interested in hands-on projects and interview preparation.',
        ]),
        admissionDate: f(admission),
        history: [],
        certificateId: null,
      }
      const counselor = sys(counselorId)
      const admin = sys('EMP-002')
      advanceApplication(application, 'NEW', counselor, stamp(appDate, 9, 30))
      advanceApplication(application, 'CONTACTED', counselor, stamp(addDays(appDate, 1), 11, 0))
      advanceApplication(application, 'COUNSELLING', counselor, stamp(addDays(appDate, 3), 15, 30), 'Counselling session completed.')
      advanceApplication(application, 'APPLICATION_SUBMITTED', counselor, stamp(addDays(appDate, 4), 12, 10))
      advanceApplication(application, 'ADMISSION_APPROVED', admin, stamp(admission, 10, 15), 'Admission approved.')
      advanceApplication(application, 'PAYMENT_PENDING', sys('EMP-006'), stamp(admission, 10, 40), 'Fee plan created.')

      const student0 = student
      students.push(student0)
      applications.push(application)

      let endedAt: Date | null = null
      if (group.state === 'dropped') endedAt = addDays(joined, rng.int(25, 55))
      if (group.state === 'hold') endedAt = subDays(today, rng.int(14, 24))
      if (group.state === 'completed') endedAt = parseISO(b!.endDate)
      if (endedAt && isAfter(endedAt, today)) endedAt = subDays(today, 7)

      if (b) {
        const status: BatchStudent['status'] = group.state === 'dropped' ? 'REMOVED' : 'ACTIVE'
        batchStudents.push({
          id: `BS-${String(batchStudents.length + 1).padStart(4, '0')}`,
          batchId: b.id,
          studentId: id,
          joinedAt: stamp(joined, 11, 30),
          status,
          reason: status === 'REMOVED' ? rng.pick(['Dropped out — relocated to another city.', 'Dropped out — got a job offer.', 'Dropped out — personal reasons.']) : undefined,
        })
      }

      metas.push({
        student: student0,
        state: group.state,
        batch: b,
        joinedAt: joined,
        endedAt,
        application,
        propensity: rng.chance(0.1) ? 0.45 + rng.next() * 0.2 : 0.74 + rng.next() * 0.24,
      })
    }
  }


  /* ───────────── Leads ───────────── */
  const leads: Lead[] = []
  const courseMix = () => {
    const code = rng.weighted([['DOTNET', 25], ['JAVA', 15], ['PYTHON', 15], ['MERN', 12], ['DATA', 8], ['AIML', 8], ['VIDEO', 12], ['UIUX', 5]] as const)
    return courses.find((c) => c.code === code)!
  }
  const noteTexts = [
    'Spoke to the candidate; wants to know about placement support.',
    'Asked for the detailed syllabus on WhatsApp.',
    'Parents are interested; will visit the campus this weekend.',
    'Comparing fees with two other institutes.',
    'Prefers weekend batch because of a current job.',
    'Requested a demo class before deciding.',
  ]
  const addLead = (spec: {
    name: string
    status: LeadStatus
    created: Date
    courseId: string
    counselorId?: string
    source?: LeadSource
    phone?: string
    email?: string
    studentId?: string
    education?: string
    location?: string
  }) => {
    const counselorId = spec.counselorId ?? pickCounselor()
    const loc = rng.pick(CITIES)
    leads.push({
      id: `TMP-${leads.length}`,
      name: spec.name,
      phone: spec.phone ?? phone(),
      email: spec.email ?? emailFor(spec.name, leads.length),
      location: spec.location ?? loc.city,
      education: spec.education ?? rng.pick(['B.E / B.Tech', 'BCA', 'B.Sc', 'MCA', 'B.Com', 'Diploma', 'MBA']),
      interestedCourseId: spec.courseId,
      source: spec.source ?? sourceMix(),
      assignedToId: counselorId,
      status: spec.status,
      priority: spec.status === 'INTERESTED' || spec.status === 'COUNSELLING_COMPLETED' ? rng.weighted([['HIGH', 5], ['MEDIUM', 4], ['LOW', 1]] as const) : rng.weighted([['HIGH', 2], ['MEDIUM', 5], ['LOW', 3]] as const),
      createdAt: stamp(spec.created, rng.int(9, 17), rng.int(0, 59)),
      nextFollowUp: null,
      notes: rng.chance(0.7)
        ? [{ id: `TMP-N${leads.length}`, text: rng.pick(noteTexts), createdById: counselorId, createdByName: empName(counselorId), createdAt: stamp(addDays(spec.created, 1), 12, 15) }]
        : [],
      applicationId: null,
      studentId: spec.studentId ?? null,
    })
    return leads[leads.length - 1]
  }

  // converted leads → derived from selected students (keeps lead history)
  const convertedIdx = [24, 25, 26, 29, 40, 48, 55, 60]
  for (const i of convertedIdx) {
    const s = students[i]
    const app = applications[i]
    const lead = addLead({
      name: s.fullName,
      status: 'CONVERTED',
      created: subDays(parseISO(app.applicationDate), rng.int(6, 12)),
      courseId: s.courseId,
      counselorId: s.counselorId,
      source: s.source,
      phone: s.phone,
      email: s.email,
      studentId: s.id,
      education: s.education,
      location: s.city,
    })
    lead.applicationId = app.id
    s.leadId = lead.id
    app.leadId = lead.id
  }

  const leadSpecs: { status: LeadStatus; n: number; from: string; to: string }[] = [
    { status: 'NEW', n: 6, from: '2026-10-01', to: '2026-10-05' },
    { status: 'CONTACTED', n: 5, from: '2026-09-20', to: '2026-10-03' },
    { status: 'COUNSELLING_SCHEDULED', n: 4, from: '2026-09-22', to: '2026-10-02' },
    { status: 'COUNSELLING_COMPLETED', n: 4, from: '2026-09-10', to: '2026-09-30' },
    { status: 'INTERESTED', n: 10, from: '2026-09-01', to: '2026-09-30' },
    { status: 'FOLLOW_UP', n: 4, from: '2026-08-25', to: '2026-09-25' },
    { status: 'NOT_INTERESTED', n: 4, from: '2026-08-05', to: '2026-09-20' },
    { status: 'LOST', n: 5, from: '2026-08-01', to: '2026-09-10' },
  ]
  let rahulSharmaPlaced = false
  for (const spec of leadSpecs) {
    const span = differenceInCalendarDays(parseISO(spec.to), parseISO(spec.from))
    for (let i = 0; i < spec.n; i++) {
      const forceRahul: boolean = spec.status === 'NEW' && !rahulSharmaPlaced
      rahulSharmaPlaced = rahulSharmaPlaced || forceRahul
      addLead({
        name: forceRahul ? 'Rahul Sharma' : makeName(rng.chance(0.5) ? 'MALE' : 'FEMALE'),
        status: spec.status,
        created: addDays(parseISO(spec.from), rng.int(0, span)),
        courseId: forceRahul ? courseByCode('DOTNET').id : courseMix().id,
      })
    }
  }

  // chronological ids
  leads.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const leadIdMap = new Map<string, string>()
  leads.forEach((l, i) => {
    const newId = `LEAD-${String(i + 1).padStart(4, '0')}`
    leadIdMap.set(l.id, newId)
    l.id = newId
    l.notes.forEach((n, ni) => (n.id = `${newId}-N${ni + 1}`))
  })
  students.forEach((s) => {
    if (s.leadId) s.leadId = leadIdMap.get(s.leadId) ?? s.leadId
  })
  applications.forEach((a) => {
    if (a.leadId) a.leadId = leadIdMap.get(a.leadId) ?? a.leadId
  })

  // open applications for interested leads
  const appCandidates = [
    ...leads.filter((l) => l.status === 'INTERESTED'),
    ...leads.filter((l) => l.status === 'COUNSELLING_COMPLETED').slice(0, 1),
    ...leads.filter((l) => l.status === 'LOST').slice(0, 1),
  ]
  const openStatuses: ApplicationStatus[] = ['NEW', 'NEW', 'CONTACTED', 'CONTACTED', 'CONTACTED', 'COUNSELLING', 'COUNSELLING', 'COUNSELLING', 'APPLICATION_SUBMITTED', 'APPLICATION_SUBMITTED', 'APPLICATION_SUBMITTED', 'CANCELLED']
  const chain: ApplicationStatus[] = ['NEW', 'CONTACTED', 'COUNSELLING', 'APPLICATION_SUBMITTED']
  appCandidates.forEach((lead, i) => {
    const target = openStatuses[i]
    const appDate = addDays(parseISO(lead.createdAt), rng.int(2, 6))
    const bounded = isAfter(appDate, today) ? today : appDate
    const app: Application = {
      id: `APP-2026-${String(students.length + i + 1).padStart(4, '0')}`,
      leadId: lead.id,
      studentId: null,
      applicantName: lead.name,
      phone: lead.phone,
      email: lead.email,
      courseId: lead.interestedCourseId,
      preferredBatchId: rng.pick([batch(1), batch(2), batch(10)].filter((b) => b.courseId === lead.interestedCourseId))?.id ?? null,
      applicationDate: f(bounded),
      counselorId: lead.assignedToId,
      status: 'NEW',
      notes: 'Application raised after counselling. Awaiting document verification.',
      admissionDate: null,
      history: [],
      certificateId: null,
    }
    const counselor = sys(lead.assignedToId)
    const upto = target === 'CANCELLED' ? 1 : chain.indexOf(target)
    for (let s = 0; s <= upto; s++) advanceApplication(app, chain[s], counselor, stamp(addDays(bounded, s), 10 + s, 20))
    if (target === 'CANCELLED') advanceApplication(app, 'CANCELLED', counselor, stamp(addDays(bounded, 3), 16, 0), 'Candidate chose another institute.')
    lead.applicationId = app.id
    applications.push(app)
  })

  /* ───────────── Follow-ups ───────────── */
  const followUps: FollowUp[] = []
  const fuTypes = ['PHONE_CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'COUNSELLING'] as const
  const addFollowUp = (lead: Lead, date: Date, status: FollowUp['status'], hour = rng.int(10, 18)) => {
    const courseName = courses.find((c) => c.id === lead.interestedCourseId)?.name
    followUps.push({
      id: `FU-${String(followUps.length + 1).padStart(4, '0')}`,
      entityType: 'LEAD',
      entityId: lead.id,
      entityName: lead.name,
      courseName,
      employeeId: lead.assignedToId,
      date: f(date),
      time: `${String(hour).padStart(2, '0')}:${rng.pick(['00', '15', '30', '45'])}`,
      type: lead.status === 'COUNSELLING_SCHEDULED' ? 'COUNSELLING' : rng.pick(fuTypes),
      notes: rng.pick([
        'Discuss fee structure and installment options.',
        'Share syllabus PDF and confirm batch timing.',
        'Check if documents are ready for application.',
        'Follow up after demo class feedback.',
        'Confirm campus visit slot.',
      ]),
      outcome: status === 'COMPLETED' ? rng.pick(['Interested — asked for fee details.', 'Needs time to discuss with family.', 'Will confirm by end of week.', 'Counselling done; ready to apply.']) : undefined,
      status,
      createdAt: stamp(subDays(date, rng.int(1, 4)), 10, 0),
    })
  }
  const openLeads = leads.filter((l) => !['CONVERTED', 'NOT_INTERESTED', 'LOST'].includes(l.status))
  openLeads.forEach((lead, i) => {
    const created = parseISO(lead.createdAt)
    // history: one completed follow-up for most leads past NEW
    if (lead.status !== 'NEW') addFollowUp(lead, addDays(created, rng.int(1, 3)), 'COMPLETED')
    if (['INTERESTED', 'FOLLOW_UP', 'COUNSELLING_COMPLETED'].includes(lead.status) && rng.chance(0.7)) addFollowUp(lead, addDays(created, rng.int(4, 9)), 'COMPLETED')
    // next follow-up: spread across overdue / today / upcoming
    const bucket = i % 6
    const date = bucket === 0 || bucket === 1 ? today : bucket === 2 ? subDays(today, rng.int(1, 5)) : addDays(today, rng.int(1, 12))
    addFollowUp(lead, date, 'PENDING', date.getTime() === today.getTime() ? rng.int(11, 17) : undefined)
    lead.nextFollowUp = f(date)
  })
  ;[leads.find((l) => l.status === 'NOT_INTERESTED'), leads.find((l) => l.status === 'LOST')].forEach((l) => {
    if (l) addFollowUp(l, addDays(parseISO(l.createdAt), 2), 'COMPLETED')
  })
  // a few rescheduled / cancelled
  openLeads.slice(0, 3).forEach((l) => addFollowUp(l, subDays(today, 8), 'RESCHEDULED'))
  openLeads.slice(3, 5).forEach((l) => addFollowUp(l, subDays(today, 6), 'CANCELLED'))
  followUps.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  followUps.forEach((fu, i) => (fu.id = `FU-${String(i + 1).padStart(4, '0')}`))

  /* ───────────── Fee plans, installments, payments, invoices ───────────── */
  const feePlans: StoredFeePlan[] = []
  const installments: Installment[] = []
  const payments: Payment[] = []
  const invoices: StoredInvoice[] = []
  const methodMix = (): PaymentMethod => rng.weighted([['UPI', 40], ['BANK_TRANSFER', 20], ['CASH', 15], ['CARD', 10], ['PAYMENT_GATEWAY', 10], ['OTHER', 5]] as const)
  const txnFor = (method: PaymentMethod) => {
    const digits = (n: number) => String(rng.int(0, 10 ** n - 1)).padStart(n, '0')
    switch (method) {
      case 'UPI': return `UPI${digits(12)}`
      case 'BANK_TRANSFER': return `NEFT${digits(10)}`
      case 'CASH': return `CASH-RCPT-${digits(5)}`
      case 'CARD': return `CARD${digits(8)}`
      case 'PAYMENT_GATEWAY': return `pay_${digits(14)}`
      default: return `TXN${digits(8)}`
    }
  }
  const dueDay = (admission: Date, n: number): Date => {
    if (n === 0) return admission
    const m = addMonths(startOfMonth(admission), n)
    m.setDate(5)
    return m
  }
  const pendingPayments: { meta: StudentMeta; installment: Installment; planIdx: number }[] = []

  metas.forEach((meta, i) => {
    const { student, state } = meta
    const course = courses.find((c) => c.id === student.courseId)!
    const rahul = student.fullName === 'Rahul Kumar'
    const discount = rahul ? 5000 : rng.weighted([[0, 45], [2000, 20], [3000, 20], [5000, 15]] as const)
    const scholarship = rng.chance(0.08) ? 2500 : 0
    const finalFee = discountedFee(course.totalFee, discount, scholarship)
    const count = rahul ? 3 : course.totalFee >= 30000 ? rng.weighted([[1, 10], [2, 25], [3, 40], [4, 25]] as const) : rng.weighted([[1, 25], [2, 40], [3, 35]] as const)
    const amounts = splitAmount(finalFee, count)
    const admission = parseISO(student.admissionDate)
    const planId = `FEE-${String(i + 1).padStart(4, '0')}`
    const invoiceNumber = `INV-2026-${String(i + 1).padStart(5, '0')}`
    feePlans.push({ id: planId, studentId: student.id, courseId: course.id, courseFee: course.totalFee, discount, scholarship, finalFee, createdAt: stamp(admission, 10, 40), invoiceId: invoiceNumber })
    invoices.push({
      id: invoiceNumber,
      number: invoiceNumber,
      studentId: student.id,
      feePlanId: planId,
      date: student.admissionDate,
      items: [{ description: `${course.name} — course fee`, amount: course.totalFee }],
      subtotal: course.totalFee,
      discount,
      scholarship,
      taxRate: 0,
      taxAmount: 0,
      total: finalFee,
    })

    const dropAfter = state === 'dropped' ? rng.int(1, 2) : state === 'cancelled' ? (rng.chance(0.6) ? 1 : 0) : count
    amounts.forEach((amount, n) => {
      const due = dueDay(admission, n)
      const inst: Installment = {
        id: `INS-${String(installments.length + 1).padStart(4, '0')}`,
        feePlanId: planId,
        studentId: student.id,
        number: n + 1,
        amount,
        dueDate: f(due),
        status: 'PENDING',
        paidAmount: 0,
        paidAt: null,
      }
      installments.push(inst)

      let paid = false
      if (state === 'completed') paid = true
      else if (state === 'dropped' || state === 'cancelled') {
        if (n >= dropAfter) inst.status = 'CANCELLED'
        else paid = true
      } else if (rahul) paid = n < 2
      else if (!isAfter(due, today)) {
        if (n === 0) paid = true
        else if (f(due) === TODAY_STR) paid = rng.chance(0.55)
        else paid = rng.chance(state === 'hold' ? 0.55 : 0.9)
      } else paid = n === 1 && rng.chance(0.12)

      if (paid) {
        let payDate: Date
        if (n === 0) payDate = addDays(admission, rng.int(0, 1))
        else payDate = rng.chance(0.55) ? subDays(due, rng.int(0, 4)) : addDays(due, rng.int(0, 5))
        if (isAfter(payDate, today)) payDate = subDays(today, rng.int(0, 2))
        if (payDate < admission) payDate = admission
        const method = methodMix()
        payments.push({
          id: `TMP-${payments.length}`,
          studentId: student.id,
          invoiceId: invoiceNumber,
          installmentId: inst.id,
          amount,
          method,
          transactionId: txnFor(method),
          paymentDate: f(payDate),
          status: 'SUCCESS',
          recordedById: rng.chance(0.85) ? 'EMP-006' : 'EMP-002',
          notes: n === 0 ? 'Admission installment' : `Installment ${n + 1} of ${count}`,
          createdAt: stamp(payDate, rng.int(10, 17), rng.int(0, 59)),
        })
        inst.status = 'PAID'
        inst.paidAmount = amount
        inst.paidAt = stamp(payDate, 12, 0)
      } else if (inst.status === 'PENDING' && (state === 'active' || state === 'hold') && !isAfter(due, today) && f(due) !== TODAY_STR) {
        // overdue — presented as OVERDUE by the API layer
      }
      if (inst.status === 'PENDING' && !isAfter(due, today)) pendingPayments.push({ meta, installment: inst, planIdx: i })
    })
  })

  // failed / pending gateway attempts (do not allocate to installments)
  const attemptTargets = metas.filter((m) => m.state === 'active' && m.batch).slice(0, 9)
  attemptTargets.forEach((m, i) => {
    const inv = invoices.find((x) => x.studentId === m.student.id)!
    const unpaid = installments.find((x) => x.studentId === m.student.id && x.status === 'PENDING')
    const failed = i < 5
    const method: PaymentMethod = failed ? rng.pick(['UPI', 'CARD', 'PAYMENT_GATEWAY'] as const) : 'BANK_TRANSFER'
    const date = failed ? subDays(today, rng.int(1, 9)) : subDays(today, rng.int(0, 1))
    payments.push({
      id: `TMP-${payments.length}`,
      studentId: m.student.id,
      invoiceId: inv.id,
      installmentId: unpaid?.id ?? null,
      amount: unpaid?.amount ?? 5000,
      method,
      transactionId: txnFor(method),
      paymentDate: f(date),
      status: failed ? 'FAILED' : 'PENDING',
      recordedById: 'EMP-006',
      notes: failed ? 'Gateway timeout — payment not captured.' : 'Awaiting bank confirmation.',
      createdAt: stamp(date, 14, 10),
    })
  })

  payments.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.createdAt.localeCompare(b.createdAt))
  payments.forEach((p, i) => (p.id = `PAY-${10101 + i}`))

  // refunds for dropped/cancelled students
  const refunds: Refund[] = []
  metas
    .filter((m) => m.state === 'dropped' || m.state === 'cancelled')
    .forEach((m) => {
      const paid = payments.filter((p) => p.studentId === m.student.id && p.status === 'SUCCESS')
      if (!paid.length || refunds.length >= 3) return
      const target = paid[paid.length - 1]
      const full = m.state === 'cancelled'
      const amount = full ? target.amount : Math.round(target.amount * 0.5)
      if (full) target.status = 'REFUNDED'
      refunds.push({
        id: `REF-${String(refunds.length + 1).padStart(3, '0')}`,
        paymentId: target.id,
        studentId: m.student.id,
        amount,
        reason: full ? 'Admission cancelled before batch start — full refund.' : 'Student dropped out — partial refund as per policy.',
        date: f(addDays(parseISO(target.paymentDate), rng.int(5, 15)) > today ? today : addDays(parseISO(target.paymentDate), rng.int(5, 15))),
        processedById: 'EMP-006',
      })
    })

  // mark applications PAYMENT_COMPLETED / BATCH_ASSIGNED / TRAINING_*
  metas.forEach((m) => {
    const { student, application: app } = m
    const sPayments = payments.filter((p) => p.studentId === student.id && p.status === 'SUCCESS')
    const plan = feePlans.find((p) => p.studentId === student.id)!
    const paidTotal = sPayments.reduce((s, p) => s + p.amount, 0)
    const accountant = sys('EMP-006')
    if (paidTotal >= plan.finalFee && sPayments.length) {
      const last = sPayments[sPayments.length - 1]
      advanceApplication(app, 'PAYMENT_COMPLETED', accountant, stamp(last.paymentDate, 15, 0), 'Fee paid in full.')
    }
    if (m.batch) {
      advanceApplication(app, 'BATCH_ASSIGNED', sys('EMP-002'), stamp(m.joinedAt, 11, 30), `Assigned to ${m.batch.name}.`)
      if (['active', 'hold', 'dropped', 'completed'].includes(m.state)) {
        const start = parseISO(m.batch.startDate)
        advanceApplication(app, 'TRAINING_STARTED', sys(m.batch.trainerId), stamp(m.joinedAt > start ? m.joinedAt : start, 19, 5), 'First class attended.')
      }
    }
    if (m.state === 'completed') advanceApplication(app, 'TRAINING_COMPLETED', sys('EMP-002'), stamp(student.completedAt!, 17, 0), 'Course completed.')
    if (m.state === 'cancelled') advanceApplication(app, 'CANCELLED', sys('EMP-002'), stamp(addDays(parseISO(student.admissionDate), 6), 11, 0), 'Admission cancelled at student request.')
  })

  /* ───────────── Sessions & attendance ───────────── */
  const sessions: ClassSession[] = []
  const attendance: Attendance[] = []
  const dayNum: Record<Weekday, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
  for (const b of batches) {
    if (b.status === 'UPCOMING' || b.status === 'CANCELLED') continue
    const mods = modulesOf(b.courseId)
    const allDates: Date[] = []
    for (let d = parseISO(b.startDate); !isAfter(d, parseISO(b.endDate)); d = addDays(d, 1)) {
      if (b.days.some((x) => dayNum[x] === getDay(d))) allDates.push(d)
    }
    const roster = metas.filter((m) => m.batch?.id === b.id)
    allDates.forEach((d, i) => {
      if (isAfter(d, today)) return
      const mod = mods[Math.min(mods.length - 1, Math.floor((i / allDates.length) * mods.length))]
      const session: ClassSession = {
        id: `CLS-${String(sessions.length + 1).padStart(4, '0')}`,
        batchId: b.id,
        date: f(d),
        trainerId: b.trainerId,
        topic: `${mod.name} — session ${i + 1}`,
        moduleId: mod.id,
      }
      sessions.push(session)
      if (f(d) === TODAY_STR) return // today's class has not been marked yet
      for (const m of roster) {
        if (m.joinedAt > d) continue
        if (m.endedAt && m.endedAt < d) continue
        const r = rng.next()
        const status: AttendanceStatus = r < m.propensity ? 'PRESENT' : r < m.propensity + 0.04 ? 'LATE' : r < m.propensity + 0.07 ? 'EXCUSED' : 'ABSENT'
        attendance.push({ id: `ATT-${String(attendance.length + 1).padStart(5, '0')}`, sessionId: session.id, studentId: m.student.id, status })
      }
    })
  }

  /* ───────────── Assignments & submissions ───────────── */
  const assignments: Assignment[] = []
  const submissions: AssignmentSubmission[] = []
  const kinds = ['Practice Set', 'Mini Project', 'Lab Exercise', 'Case Study', 'Coding Challenge', 'Assessment']
  const feedbacks = ['Good structure. Improve naming conventions.', 'Excellent work — clean and well tested.', 'Logic is correct, but handle edge cases.', 'Needs more comments and error handling.', 'Great effort. Review the SQL joins once more.']
  for (const b of batches.filter((x) => x.status === 'ACTIVE' || x.status === 'COMPLETED')) {
    const mods = modulesOf(b.courseId)
    const start = parseISO(b.startDate)
    const end = parseISO(b.endDate)
    const span = differenceInCalendarDays(end, start)
    const roster = metas.filter((m) => m.batch?.id === b.id)
    for (let i = 0; i < 8; i++) {
      const frac = (i + 1) / 8
      let due = addDays(start, Math.round(span * frac * (b.status === 'ACTIVE' ? 0.78 : 1)))
      if (b.status === 'ACTIVE' && isAfter(due, addDays(today, 14))) due = addDays(today, rng.int(3, 14))
      const mod = mods[Math.min(mods.length - 1, Math.floor(frac * mods.length) - (frac === 1 ? 1 : 0))]
      const asg: Assignment = {
        id: `ASG-${String(assignments.length + 1).padStart(3, '0')}`,
        courseId: b.courseId,
        moduleId: mod.id,
        batchId: b.id,
        title: `${mod.name} ${kinds[i % kinds.length]}`,
        description: `Complete the exercises for the ${mod.name} module and submit your work (repository link or ZIP). Follow the naming and documentation guidelines shared in class.`,
        dueDate: f(due),
        maxMarks: rng.pick([10, 20, 25, 50, 100]),
      }
      assignments.push(asg)
      for (const m of roster) {
        if (m.joinedAt > due || (m.endedAt && m.endedAt < subDays(due, 7))) continue
        const past = !isAfter(due, today)
        let status: AssignmentSubmission['status']
        if (past) {
          const daysAgo = differenceInCalendarDays(today, due)
          status = rng.weighted([['REVIEWED', daysAgo > 14 ? 75 : 45], ['SUBMITTED', daysAgo > 14 ? 5 : 25], ['LATE', 12], ['NOT_STARTED', 8]] as const)
        } else status = rng.chance(0.2) && differenceInCalendarDays(due, today) < 6 ? 'SUBMITTED' : 'NOT_STARTED'
        const reviewed = status === 'REVIEWED' || (status === 'LATE' && rng.chance(0.6))
        const submitted = status !== 'NOT_STARTED'
        const submittedAt = submitted ? stamp(status === 'LATE' ? addDays(due, rng.int(1, 3)) : subDays(due, rng.int(0, 3)), rng.int(9, 22), rng.int(0, 59)) : null
        submissions.push({
          id: `SUB-${String(submissions.length + 1).padStart(4, '0')}`,
          assignmentId: asg.id,
          studentId: m.student.id,
          status,
          score: reviewed ? Math.round(asg.maxMarks * (0.5 + rng.next() * 0.5)) : null,
          feedback: reviewed ? rng.pick(feedbacks) : '',
          submittedAt,
          reviewedAt: reviewed && submittedAt ? stamp(addDays(parseISO(submittedAt), rng.int(1, 3)), 18, 0) : null,
        })
      }
    }
  }

  /* ───────────── Progress ───────────── */
  const progress: StudentProgress[] = []
  for (const m of metas) {
    const mods = modulesOf(m.student.courseId)
    let f0 = 0
    if (m.state === 'completed') f0 = 1
    else if (m.batch && ['active', 'hold', 'dropped'].includes(m.state)) {
      const span = Math.max(1, differenceInCalendarDays(parseISO(m.batch.endDate), parseISO(m.batch.startDate)))
      const upto = m.endedAt ?? today
      f0 = Math.min(1, Math.max(0, differenceInCalendarDays(upto, parseISO(m.batch.startDate)) / span))
      f0 *= m.joinedAt > parseISO(m.batch.startDate) ? 0.88 : 1
    }
    mods.forEach((mod, i) => {
      let percent = m.state === 'completed' ? 100 : Math.round((f0 * mods.length - i) * 100 + rng.int(-10, 8))
      percent = Math.max(0, Math.min(100, Math.round(percent / 5) * 5))
      if (m.state !== 'completed' && f0 * mods.length - i >= 1.15) percent = 100
      if (f0 === 0 && m.state !== 'completed') percent = 0
      progress.push({ studentId: m.student.id, moduleId: mod.id, percent })
    })
  }

  /* ───────────── Certificates ───────────── */
  const certificates: Certificate[] = []
  metas
    .filter((m) => m.state === 'completed')
    .forEach((m, i) => {
      if (i % 4 === 3) return // some completed students are still awaiting a certificate
      const course = courses.find((c) => c.id === m.student.courseId)!
      const issued = addDays(parseISO(m.student.completedAt!), rng.int(3, 9))
      const seq = m.student.id.slice(-5)
      const cert: Certificate = {
        id: `CERT-${course.code}-${m.student.completedAt!.slice(0, 4)}-${seq}`,
        studentId: m.student.id,
        courseId: course.id,
        batchId: m.batch!.id,
        startDate: m.batch!.startDate,
        completionDate: m.student.completedAt!,
        issuedDate: f(issued),
        issuedById: 'EMP-002',
      }
      certificates.push(cert)
      m.student.certificateId = cert.id
      m.application.certificateId = cert.id
    })

  /* ───────────── Documents ───────────── */
  const documents: StoredDocument[] = []
  metas.forEach((m, i) => {
    if (i % 10 >= 7) return
    const uploader = m.student.counselorId
    const base = {
      ownerType: 'STUDENT' as const,
      ownerId: m.student.id,
      uploadedById: uploader,
      mimeType: 'application/pdf',
    }
    const add = (category: StoredDocument['category'], fileName: string, kb: number) =>
      documents.push({
        ...base,
        id: `DOC-${String(documents.length + 1).padStart(4, '0')}`,
        category,
        fileName,
        sizeBytes: kb * 1024,
        uploadedAt: stamp(addDays(parseISO(m.application.applicationDate), 2), 14, 0),
        storageKey: `students/${m.student.id}/${category.toLowerCase()}-${documents.length + 1}.pdf`,
      })
    add('ID_PROOF', 'aadhaar-card.pdf', 220 + (i % 5) * 40)
    if (i % 10 < 5) add('EDUCATION', 'degree-certificate.pdf', 480 + (i % 4) * 60)
    if (i % 10 === 0) add('APPLICATION', 'application-form-signed.pdf', 310)
  })

  /* ───────────── Settings & roles ───────────── */
  const settings = {
    companyName: 'Beyond Syntax Solutions Pvt Ltd',
    legalName: 'Beyond Syntax Solutions Pvt Ltd Learning Solutions Pvt. Ltd.',
    address: 'No. 24, 3rd Floor, Orion Business Park, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    phone: '+91 80 4123 7890',
    email: 'accounts@Beyond Syntax Solutions Pvt Ltd.example',
    gstin: '29ABCDE1234F1Z5',
    taxRate: 0,
    currency: 'INR',
    invoicePrefix: 'INV',
    minAttendanceAlert: 75,
    certificateMinProgress: 90,
  }

  // finalise students / batches
  const db: Db = {
    employees,
    credentials,
    rolePermissions: cloneDefaultMatrix(),
    leads,
    followUps,
    applications: applications.sort((a, b) => a.applicationDate.localeCompare(b.applicationDate)),
    students,
    courses,
    modules,
    batches,
    batchStudents,
    sessions,
    attendance,
    assignments,
    submissions,
    progress,
    feePlans,
    installments,
    payments,
    invoices,
    refunds,
    certificates,
    documents,
    auditLogs: [],
    notifications: [],
    settings,
    counters: {},
  }
  batches.forEach((b) => (b.currentStudentCount = batchStudents.filter((x) => x.batchId === b.id && x.status === 'ACTIVE').length))

  /* ───────────── Audit trail ───────────── */
  for (const lead of leads) {
    const by = sys(lead.assignedToId)
    logAudit(db, { userId: by.id, userName: by.name, action: 'LEAD_CREATED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: `Lead ${lead.name} created`, timestamp: lead.createdAt, relatedIds: [lead.studentId ?? ''].filter(Boolean) })
    if (lead.status !== 'NEW')
      logAudit(db, { userId: by.id, userName: by.name, action: 'LEAD_STATUS_CHANGED', entityType: 'LEAD', entityId: lead.id, entityLabel: lead.name, description: `Lead status changed`, previousValue: 'New', newValue: humanize(lead.status), timestamp: stamp(addDays(parseISO(lead.createdAt), 2), 15, 0) })
  }
  for (const fu of followUps) {
    const by = sys(fu.employeeId)
    logAudit(db, { userId: by.id, userName: by.name, action: 'FOLLOW_UP_SCHEDULED', entityType: 'FOLLOW_UP', entityId: fu.id, entityLabel: fu.entityName, description: `${humanize(fu.type)} follow-up scheduled for ${fu.entityName}`, timestamp: fu.createdAt, relatedIds: [fu.entityId] })
    if (fu.status === 'COMPLETED')
      logAudit(db, { userId: by.id, userName: by.name, action: 'FOLLOW_UP_COMPLETED', entityType: 'FOLLOW_UP', entityId: fu.id, entityLabel: fu.entityName, description: `Follow-up with ${fu.entityName} completed`, timestamp: stamp(fu.date, parseInt(fu.time.slice(0, 2)), 30), relatedIds: [fu.entityId] })
  }
  for (const app of db.applications) {
    const related = [app.id, app.leadId ?? '', app.studentId ?? ''].filter(Boolean)
    app.history.forEach((h, i) => {
      const prev = i > 0 ? app.history[i - 1].status : null
      const approving = h.status === 'ADMISSION_APPROVED'
      logAudit(db, {
        userId: h.byId,
        userName: h.byName,
        action: i === 0 ? 'APPLICATION_CREATED' : approving ? 'APPLICATION_APPROVED' : 'APPLICATION_STATUS_CHANGED',
        entityType: 'APPLICATION',
        entityId: app.id,
        entityLabel: app.applicantName,
        description: i === 0 ? `Application submitted for ${app.applicantName}` : approving ? `Admission approved for ${app.applicantName}` : `Application moved to ${humanize(h.status)}`,
        previousValue: prev ? humanize(prev) : null,
        newValue: humanize(h.status),
        timestamp: h.at,
        relatedIds: related,
      })
    })
  }
  for (const m of metas) {
    const s = m.student
    const related = [s.applicationId!, s.leadId ?? '', m.batch?.id ?? ''].filter(Boolean)
    const admin = sys('EMP-002')
    logAudit(db, { userId: admin.id, userName: admin.name, action: 'STUDENT_CREATED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `Student record created for ${s.fullName}`, timestamp: s.createdAt, relatedIds: related })
    const plan = feePlans.find((p) => p.studentId === s.id)!
    logAudit(db, { userId: 'EMP-006', userName: empName('EMP-006'), action: 'FEE_PLAN_CREATED', entityType: 'FEE_PLAN', entityId: plan.id, entityLabel: s.fullName, description: `Fee plan of ${plan.finalFee.toLocaleString('en-IN')} created for ${s.fullName}`, newValue: `₹${plan.finalFee.toLocaleString('en-IN')}`, timestamp: plan.createdAt, relatedIds: [s.id, ...related] })
    if (m.batch)
      logAudit(db, { userId: admin.id, userName: admin.name, action: 'BATCH_ASSIGNED', entityType: 'BATCH', entityId: m.batch.id, entityLabel: m.batch.name, description: `${s.fullName} assigned to ${m.batch.name}`, newValue: m.batch.name, timestamp: stamp(m.joinedAt, 11, 30), relatedIds: [s.id, ...related] })
    if (m.state === 'dropped')
      logAudit(db, { userId: admin.id, userName: admin.name, action: 'STUDENT_STATUS_CHANGED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `Student status changed`, previousValue: 'Active', newValue: 'Dropped', reason: batchStudents.find((b) => b.studentId === s.id)?.reason, timestamp: stamp(m.endedAt!, 12, 0), relatedIds: related })
    if (m.state === 'hold')
      logAudit(db, { userId: admin.id, userName: admin.name, action: 'STUDENT_STATUS_CHANGED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `Student status changed`, previousValue: 'Active', newValue: 'On Hold', reason: 'Student requested a break due to personal reasons.', timestamp: stamp(m.endedAt!, 12, 0), relatedIds: related })
    if (m.state === 'completed')
      logAudit(db, { userId: admin.id, userName: admin.name, action: 'COURSE_COMPLETED', entityType: 'STUDENT', entityId: s.id, entityLabel: s.fullName, description: `${s.fullName} completed the course`, previousValue: 'Active', newValue: 'Completed', timestamp: stamp(s.completedAt!, 17, 0), relatedIds: related })
  }
  for (const p of payments) {
    const by = sys(p.recordedById)
    logAudit(db, { userId: by.id, userName: by.name, action: 'PAYMENT_ADDED', entityType: 'PAYMENT', entityId: p.id, entityLabel: students.find((s) => s.id === p.studentId)?.fullName, description: `Payment of ₹${p.amount.toLocaleString('en-IN')} recorded (${humanize(p.status)})`, newValue: `₹${p.amount.toLocaleString('en-IN')} via ${humanize(p.method)}`, timestamp: p.createdAt, relatedIds: [p.studentId, p.invoiceId] })
  }
  for (const r of refunds) {
    logAudit(db, { userId: r.processedById, userName: empName(r.processedById), action: 'REFUND_ISSUED', entityType: 'REFUND', entityId: r.id, entityLabel: students.find((s) => s.id === r.studentId)?.fullName, description: `Refund of ₹${r.amount.toLocaleString('en-IN')} issued`, newValue: `₹${r.amount.toLocaleString('en-IN')}`, reason: r.reason, timestamp: stamp(r.date, 16, 0), relatedIds: [r.studentId, r.paymentId] })
  }
  for (const c of certificates) {
    const s = students.find((x) => x.id === c.studentId)!
    logAudit(db, { userId: c.issuedById, userName: empName(c.issuedById), action: 'CERTIFICATE_ISSUED', entityType: 'CERTIFICATE', entityId: c.id, entityLabel: s.fullName, description: `Certificate ${c.id} issued to ${s.fullName}`, newValue: c.id, timestamp: stamp(c.issuedDate, 11, 0), relatedIds: [s.id, s.applicationId ?? ''].filter(Boolean) })
  }
  for (const b of batches) {
    logAudit(db, { userId: 'EMP-002', userName: empName('EMP-002'), action: 'BATCH_CREATED', entityType: 'BATCH', entityId: b.id, entityLabel: b.name, description: `Batch ${b.name} created`, timestamp: stamp(subDays(parseISO(b.startDate), 75), 10, 0) })
    const last = sessions.filter((s) => s.batchId === b.id).slice(-4)
    for (const s of last) {
      if (s.date === TODAY_STR) continue
      logAudit(db, { userId: b.trainerId, userName: empName(b.trainerId), action: 'ATTENDANCE_UPDATED', entityType: 'ATTENDANCE', entityId: s.id, entityLabel: b.name, description: `Attendance marked for ${b.name} (${format(parseISO(s.date), 'dd-MMM')})`, timestamp: stamp(s.date, parseInt(b.endTime.slice(0, 2)), 20), relatedIds: [b.id] })
    }
  }
  for (const a of assignments.slice(0, 20)) {
    const b = batches.find((x) => x.id === a.batchId)!
    logAudit(db, { userId: b.trainerId, userName: empName(b.trainerId), action: 'ASSIGNMENT_CREATED', entityType: 'ASSIGNMENT', entityId: a.id, entityLabel: a.title, description: `Assignment "${a.title}" created for ${b.name}`, timestamp: stamp(subDays(parseISO(a.dueDate), 10) > today ? today : subDays(parseISO(a.dueDate), 10), 10, 0), relatedIds: [b.id] })
  }

  db.auditLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  db.counters['LOG-'] = 0
  db.auditLogs.forEach((l, i) => (l.id = `LOG-${String(i + 1).padStart(5, '0')}`))
  db.counters['LOG-'] = db.auditLogs.length

  /* ───────────── Notifications ───────────── */
  const dueToday = followUps.filter((x) => x.status === 'PENDING' && x.date === TODAY_STR).length
  const overdueCount = pendingPayments.length
  pushNotification(db, { type: 'FOLLOW_UP_DUE', title: 'Follow-ups due today', message: `${dueToday} follow-ups are scheduled for today.`, link: '/follow-ups', roles: ['COUNSELOR', 'ADMIN', 'SUPER_ADMIN'], createdAt: stamp(today, 8, 30) })
  pushNotification(db, { type: 'PAYMENT_OVERDUE', title: 'Overdue installments', message: `${overdueCount} installments are overdue or due today.`, link: '/payments/pending', roles: ['ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'], createdAt: stamp(today, 8, 45) })
  pushNotification(db, { type: 'BATCH_STARTING', title: 'Batch starting soon', message: 'DOTNET-OCT-2026-A starts on 10-Oct-2026 with 8 students.', link: '/batches/BAT-001', roles: ['ADMIN', 'SUPER_ADMIN', 'TRAINER'], createdAt: stamp(today, 9, 0) })
  pushNotification(db, { type: 'NEW_LEAD', title: 'New lead assigned', message: 'Rahul Sharma enquired about Full Stack .NET via Website.', link: '/leads', roles: ['COUNSELOR', 'ADMIN', 'SUPER_ADMIN'], createdAt: stamp(today, 9, 40) })
  pushNotification(db, { type: 'NEW_APPLICATION', title: 'New application', message: 'A new application is awaiting admission approval.', link: '/applications', roles: ['ADMIN', 'SUPER_ADMIN'], createdAt: stamp(subDays(today, 1), 16, 10) })
  pushNotification(db, { type: 'COURSE_COMPLETION', title: 'Course completion pending', message: '3 completed students are awaiting certificates.', link: '/certificates', roles: ['ADMIN', 'SUPER_ADMIN'], createdAt: stamp(subDays(today, 2), 11, 0) })
  pushNotification(db, { type: 'CERTIFICATE_READY', title: 'Certificates ready to issue', message: 'Students from DATA-APR-2026-A meet the certificate criteria.', link: '/certificates', roles: ['ADMIN', 'SUPER_ADMIN'], createdAt: stamp(subDays(today, 3), 10, 0), read: true })
  const low = metas.filter((m) => m.state === 'active' && m.propensity < 0.7).length
  pushNotification(db, { type: 'ATTENDANCE_ISSUE', title: 'Low attendance alert', message: `${low || 4} students are below the attendance threshold.`, link: '/attendance', roles: ['TRAINER', 'ADMIN', 'SUPER_ADMIN'], createdAt: stamp(subDays(today, 1), 18, 0) })

  /* ───────────── counters ───────────── */
  syncCounter(db, 'LEAD-', leads.map((l) => l.id))
  syncCounter(db, 'FU-', followUps.map((x) => x.id))
  syncCounter(db, 'APP-2026-', db.applications.map((x) => x.id))
  syncCounter(db, 'STU-2026-', students.map((x) => x.id))
  syncCounter(db, 'BAT-', batches.map((x) => x.id))
  syncCounter(db, 'BS-', batchStudents.map((x) => x.id))
  syncCounter(db, 'CRS-', courses.map((x) => x.id))
  syncCounter(db, 'MOD-', modules.map((x) => x.id))
  syncCounter(db, 'CLS-', sessions.map((x) => x.id))
  syncCounter(db, 'ATT-', attendance.map((x) => x.id))
  syncCounter(db, 'ASG-', assignments.map((x) => x.id))
  syncCounter(db, 'SUB-', submissions.map((x) => x.id))
  syncCounter(db, 'FEE-', feePlans.map((x) => x.id))
  syncCounter(db, 'INS-', installments.map((x) => x.id))
  syncCounter(db, 'PAY-', payments.map((x) => x.id))
  db.counters['PAY-'] = Math.max(db.counters['PAY-'] ?? 0, 10100 + payments.length)
  syncCounter(db, 'INV-2026-', invoices.map((x) => x.id))
  syncCounter(db, 'REF-', refunds.map((x) => x.id))
  syncCounter(db, 'DOC-', documents.map((x) => x.id))
  syncCounter(db, 'EMP-', employees.map((x) => x.id))
  return db
}
