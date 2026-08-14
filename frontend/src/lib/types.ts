export interface User {
  id: number
  school_id: number
  name: string
  email: string | null
  phone: string | null
  locale: string
  timezone: string
  avatar: string | null
  status: 'active' | 'suspended' | 'invited'
  must_change_password: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
  roles?: { id: number; name: string }[]
  permissions?: { name: string }[]
  student?: Student | null
  teacher?: Teacher | null
  school?: School
}

export interface School {
  id: number
  name: string
  slug: string
  logo: string | null
  address: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  currency: string
  timezone: string
  status: string
  subscription_plan: string
  current_academic_year_id: number | null
  academic_years_count?: number
  grades_count?: number
  subjects_count?: number
  students_count?: number
  teachers_count?: number
  terms_count?: number
  grade_scales_count?: number
  fee_types_count?: number
}

export interface Grade {
  id: number
  school_id: number
  name: string
  level: number
  description: string | null
  is_active: boolean
  classes_count: number
}

export interface Subject {
  id: number
  school_id: number
  name: string
  code: string | null
  description: string | null
  is_active: boolean
}

export interface GradeScale {
  id: number
  school_id: number
  name: string
  min_percentage: number
  max_percentage: number
  points: number | null
  color: string | null
  is_default: boolean
}

export interface Term {
  id: number
  school_id: number
  academic_year_id: number
  name: string
  term_number: number
  start_date: string
  end_date: string
  is_current: boolean
}

export interface AcademicYear {
  id: number
  school_id: number
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  status: string
  terms?: Term[]
}

export interface Guardian {
  id: number
  name: string
  phone: string | null
  email: string | null
  relationship: string | null
}

export interface Student {
  id: number
  student_number: string
  admission_number: string
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  date_of_birth: string | null
  gender: 'male' | 'female' | null
  nationality: string | null
  photo: string | null
  status: string
  enrollment_date: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  class_id: number | null
  class?: { id: number; name: string } | null
  user_id: number | null
  user?: { id: number; name: string; email: string; phone: string } | null
  guardians?: Guardian[] | null
  attendance_rate?: number | null
  created_at: string
}

export interface Teacher {
  id: number
  employee_id: string | null
  qualification: string | null
  joining_date: string | null
  status: 'active' | 'archived'
  user_id: number
  user: { id: number; name: string; email: string; phone: string | null } | null
  subjects?: { class_id: number; class_name: string; subject_id: number; subject_name: string }[]
}

export interface SchoolClass {
  id: number
  name: string
  section_name: string
  room: string | null
  capacity: number | null
  is_active: boolean
  students_count: number
  grade: { id: number; name: string } | null
  academic_year: { id: number; name: string } | null
  class_teacher: { id: number; name: string } | null
  subjects: { subject_id: number; subject_name: string; teacher_id: number | null; weekly_periods: number }[] | null
  students: { id: number; name: string; student_number: string; status: string }[] | null
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface AttendanceRow {
  student_id: number
  name: string
  student_number: string
  status: AttendanceStatus | null
  record_id: number | null
}

export interface AttendanceSession {
  id: number
  school_id: number
  academic_year_id: number
  term_id: number | null
  class_id: number
  subject_id: number | null
  taken_by: number
  date: string
  period: number | null
  notes: string | null
  records: AttendanceRecord[]
}

export interface AttendanceRecord {
  id: number
  attendance_session_id: number
  student_id: number
  status: AttendanceStatus
  notes: string | null
  marked_by: number
  date?: string
  student?: { id: number; full_name: string }
}

export interface Exam {
  id: number
  school_id: number
  academic_year_id: number
  term_id: number | null
  name: string
  type: 'exam' | 'quiz' | 'midterm' | 'final'
  start_date: string | null
  end_date: string | null
  status: 'draft' | 'published'
  academic_year?: AcademicYear
  term?: Term
  exam_subjects?: ExamSubject[]
}

export interface ExamSubject {
  id: number
  exam_id: number
  class_id: number
  subject_id: number
  teacher_id: number | null
  full_marks: number
  pass_marks: number
  status: 'draft' | 'submitted' | 'reviewed' | 'published'
  subject?: { id: number; name: string }
  class?: { id: number; name: string; grade?: { id: number; name: string } }
  teacher?: { id: number; name: string }
  results?: ExamResult[]
}

export interface ExamResult {
  id: number
  exam_subject_id: number
  student_id: number
  marks: number | null
  grade: string | null
  remarks: string | null
  status: string
  student?: Student
}

export interface FeeType {
  id: number
  school_id: number
  name: string
  code: string | null
  amount: number
  frequency: 'term' | 'year' | 'one-time'
  description: string | null
  is_active: boolean
}

export interface Invoice {
  id: number
  school_id: number
  student_id: number
  fee_type_id: number | null
  academic_year_id: number | null
  term_id: number | null
  invoice_number: string
  title: string
  amount: number
  discount_amount: number
  discount_reason: string | null
  due_date: string | null
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  student?: { id: number; full_name: string; student_number?: string | null }
  fee_type?: FeeType
  payments?: FeePayment[]
}

export interface FeePayment {
  id: number
  school_id: number
  student_fee_id: number
  student_id: number
  amount: number
  payment_method: 'cash' | 'card' | 'bank' | 'online'
  reference: string | null
  notes: string | null
  receipt_number: string
  received_by: number
  paid_by_name: string | null
  paid_at: string
  student?: { id: number; full_name: string; student_number?: string | null }
  studentFee?: { id: number; invoice_number: string }
  received_by_user?: User
}

export interface Assignment {
  id: number
  school_id: number
  class_id: number
  subject_id: number
  teacher_id: number | null
  title: string
  description: string | null
  due_date: string
  due_time: string | null
  status: 'published' | 'closed'
  subject?: { id: number; name: string }
  class?: { id: number; name: string }
  teacher?: { id: number; name: string }
  submissions_count?: number
  attachments?: AssignmentAttachment[]
  submissions?: AssignmentSubmission[]
}

export interface AssignmentAttachment {
  id: number
  assignment_id: number
  name: string
  path: string
  mime_type: string
  size: number
}

export interface AssignmentSubmission {
  id: number
  assignment_id: number
  student_id: number
  text: string | null
  file_name: string | null
  submitted_at: string
  grade: number | null
  feedback: string | null
  status: 'submitted' | 'late' | 'graded'
  student?: { id: number; full_name: string }
}

export interface Announcement {
  id: number
  school_id: number
  created_by: number
  title: string
  body: string
  audience: 'everyone' | 'teachers' | 'students' | 'parents' | 'class'
  class_id: number | null
  status: string
  published_at: string | null
  expires_at: string | null
  created_at: string
  author?: { id: number; name: string }
}

export interface AppNotification {
  id: number
  school_id: number
  user_id: number
  type: string
  title: string
  body: string | null
  action_url: string | null
  read_at: string | null
  created_at: string
}

export interface Timetable {
  id: number
  school_id: number
  academic_year_id: number
  term_id: number | null
  class_id: number
  name: string
  is_active: boolean
  class?: { id: number; name: string; grade?: { id: number; name: string } }
  entries?: TimetableEntry[]
}

export interface TimetableEntry {
  id: number
  timetable_id: number
  school_id: number
  day_of_week: number
  period_number: number
  start_time: string
  end_time: string
  subject_id: number | null
  teacher_id: number | null
  room: string | null
  subject?: { id: number; name: string }
  teacher?: { id: number; name: string }
}

export interface Paginated<T> {
  current_page: number
  data: T[]
  per_page: number
  total: number
  last_page: number
  from: number
  to: number
}

export interface DashboardStats {
  total_students: number
  total_teachers: number
  total_classes: number
  attendance_today_rate: number | null
  absent_today: number
  pending_fees_amount: number
}

export interface AdminDashboard {
  role: 'admin'
  stats: DashboardStats
  students_by_grade: Record<string, number>
  upcoming_exams: Exam[]
  recent_payments: { id: number; receipt_number: string; student: string | null; amount: number; paid_at: string }[]
  recent_announcements: Announcement[]
  recent_activity: { action: string; user: string | null; created_at: string }[]
}

export interface TeacherDashboard {
  role: 'teacher'
  classes: {
    class_id: number
    class_name: string | null
    subjects: { id: number; name: string }[]
  }[]
  todays_classes: {
    class_id: number
    class_name: string | null
    subjects: { id: number; name: string }[]
    attendance_taken: boolean
  }[]
}

export interface StudentDashboard {
  role: 'student'
  student: { id: number; name: string; class_name: string | null; attendance_rate: number; pending_assignments: number }
  todays_periods: {
    period_number: number
    start_time: string
    end_time: string
    subject: string | null
    room: string | null
  }[]
  latest_result: { subject: string | null; marks: number | null; grade: string | null; full_marks: number } | null
}

export interface ParentDashboard {
  role: 'parent'
  children: {
    id: number
    name: string
    class_name: string | null
    attendance_rate: number
    pending_assignments: number
    outstanding_fees: number
  }[]
}

export interface AccountantDashboard {
  role: 'accountant'
  stats: { collected_this_month: number; outstanding_total: number }
  recent_payments: {
    id: number
    receipt_number: string
    student: string | null
    amount: number
    method: string
    paid_at: string
  }[]
}
