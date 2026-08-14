import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import type {
  AccountantDashboard,
  AdminDashboard,
  ParentDashboard,
  StudentDashboard,
  TeacherDashboard,
} from '../lib/types'
import { Badge, Card, PageHeader, Spinner } from '../components/ui'

type Dashboard = AdminDashboard | TeacherDashboard | StudentDashboard | ParentDashboard | AccountantDashboard

export default function Dashboard() {
  const { t } = useTranslation()
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<Dashboard>('/dashboard')
        setData(res.data)
      } catch {
        setError('Failed to load dashboard.')
      }
    })()
  }, [])

  if (error) {
    return <PageHeader title={t('nav.dashboard')} subtitle={error} />
  }

  if (!data) {
    return <Spinner />
  }

  if (data.role === 'admin') return <AdminView data={data} />
  if (data.role === 'teacher') return <TeacherView data={data} />
  if (data.role === 'student') return <StudentView data={data} />
  if (data.role === 'parent') return <ParentView data={data} />
  return <AccountantView data={data} />
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <Card className="min-w-0 p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-500">{label}</p>
          <p className="truncate text-lg font-semibold text-gray-900 sm:text-xl">{value}</p>
        </div>
      </div>
    </Card>
  )
}

function AdminView({ data }: { data: AdminDashboard }) {
  const { t } = useTranslation()
  const stats = data.stats
  return (
    <div>
      <PageHeader title={t('nav.dashboard')} subtitle={`${t('dashboard.welcome')}, ${data.role}`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('dashboard.totalStudents')} value={stats.total_students} color="bg-indigo-600" icon="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
        <StatCard label={t('dashboard.totalTeachers')} value={stats.total_teachers} color="bg-emerald-600" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        <StatCard label={t('dashboard.totalClasses')} value={stats.total_classes} color="bg-blue-600" icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" />
        <StatCard label={t('dashboard.attendanceToday')} value={stats.attendance_today_rate === null ? '—' : `${stats.attendance_today_rate}%`} color="bg-purple-600" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        <StatCard label={t('dashboard.absentToday')} value={stats.absent_today} color="bg-red-600" icon="M10 9v6m4-6v6m-8 8h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <StatCard label={t('dashboard.pendingFees')} value={formatMoney(stats.pending_fees_amount)} color="bg-amber-500" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.studentsByGrade')}</h3>
          <div className="space-y-2">
            {Object.entries(data.students_by_grade).map(([grade, count]) => (
              <div key={grade} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{grade}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded bg-gray-100">
                    <div
                      className="h-full rounded bg-indigo-600"
                      style={{ width: `${Math.min(100, (count / Math.max(1, Math.max(...Object.values(data.students_by_grade), 1))) * 100)}%` }}
                    />
                  </div>
                  <span className="w-6 text-end font-medium">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(data.students_by_grade).length === 0 && (
              <p className="text-sm text-gray-400">{t('common.noData')}</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.upcomingExams')}</h3>
          <div className="space-y-2">
            {data.upcoming_exams.map((exam) => (
              <div key={exam.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{exam.name}</span>
                <span className="text-gray-400">{exam.start_date ? new Date(exam.start_date).toLocaleDateString() : '—'}</span>
              </div>
            ))}
            {data.upcoming_exams.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.recentPayments')}</h3>
          <div className="space-y-2">
            {data.recent_payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-gray-700">{p.student ?? '—'}</span>
                  <span className="ms-2 text-xs text-gray-400">{p.receipt_number}</span>
                </div>
                <span className="font-semibold text-emerald-600">{formatMoney(p.amount)}</span>
              </div>
            ))}
            {data.recent_payments.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.recentActivity')}</h3>
          <div className="space-y-2">
            {data.recent_activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{a.user ?? 'System'} · <span className="text-gray-400">{a.action}</span></span>
                <span className="text-xs text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
              </div>
            ))}
            {data.recent_activity.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

function TeacherView({ data }: { data: TeacherDashboard }) {
  const { t } = useTranslation()
  return (
    <div>
      <PageHeader title={t('nav.dashboard')} subtitle={t('dashboard.todaysClasses')} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.todays_classes.map((cls) => (
          <Card key={cls.class_id} className="p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{cls.class_name}</h3>
              {cls.attendance_taken ? (
                <Badge color="green">{t('dashboard.attendanceTaken')}</Badge>
              ) : (
                <Badge color="amber">{t('dashboard.takeAttendance')}</Badge>
              )}
            </div>
            <p className="mb-3 text-xs text-gray-500">{t('dashboard.subjects')}:</p>
            <div className="flex flex-wrap gap-2">
              {cls.subjects.map((s) => (
                <span key={s.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {s.name}
                </span>
              ))}
            </div>
            {!cls.attendance_taken && (
              <Link
                to={`/attendance?class_id=${cls.class_id}`}
                className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                {t('dashboard.takeAttendance')} →
              </Link>
            )}
          </Card>
        ))}
        {data.todays_classes.length === 0 && <p className="text-sm text-gray-400">{t('dashboard.noClasses')}</p>}
      </div>
    </div>
  )
}

function StudentView({ data }: { data: StudentDashboard }) {
  const { t } = useTranslation()
  const student = data.student
  return (
    <div>
      <PageHeader title={t('nav.dashboard')} subtitle={`${t('dashboard.welcome')}, ${student?.name ?? ''}`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label={t('dashboard.attendanceRate')} value={student ? `${student.attendance_rate}%` : '—'} color="bg-emerald-600" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        <StatCard label={t('dashboard.pendingAssignments')} value={student?.pending_assignments ?? 0} color="bg-indigo-600" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <StatCard label={t('dashboard.class')} value={student?.class_name ?? '—'} color="bg-blue-600" icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.todaysSchedule')}</h3>
          <div className="space-y-2">
            {data.todays_periods?.map((p) => (
              <div key={p.period_number} className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm">
                <div>
                  <span className="font-semibold text-gray-700">{p.period_number}.</span>{' '}
                  <span className="text-gray-700">{p.subject ?? '—'}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {p.start_time}–{p.end_time} {p.room ? `· ${p.room}` : ''}
                </span>
              </div>
            ))}
            {(!data.todays_periods || data.todays_periods.length === 0) && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.latestResult')}</h3>
          {data.latest_result ? (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
              <div>
                <p className="font-semibold text-gray-800">{data.latest_result.subject}</p>
                <p className="text-xs text-gray-500">{t('exams.fullMarks')}: {data.latest_result.full_marks}</p>
              </div>
              <div className="text-end">
                <p className="text-2xl font-bold text-gray-900">{data.latest_result.marks ?? '—'}</p>
                <Badge color="indigo">{data.latest_result.grade ?? '—'}</Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t('dashboard.noLatestResult')}</p>
          )}
        </Card>
      </div>
    </div>
  )
}

function ParentView({ data }: { data: ParentDashboard }) {
  const { t } = useTranslation()
  return (
    <div>
      <PageHeader title={t('nav.dashboard')} subtitle={t('dashboard.myChildren')} />
      <div className="grid gap-4 md:grid-cols-2">
        {data.children.map((child) => (
          <Card key={child.id} className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{child.name}</h3>
                <p className="text-xs text-gray-500">{child.class_name}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
                {child.name.charAt(0)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 p-2">
                <p className="text-lg font-bold text-emerald-700">{child.attendance_rate}%</p>
                <p className="text-[11px] text-gray-500">{t('dashboard.attendanceRate')}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2">
                <p className="text-lg font-bold text-indigo-700">{child.pending_assignments}</p>
                <p className="text-[11px] text-gray-500">{t('dashboard.pendingAssignments')}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <p className="text-lg font-bold text-amber-700">{formatMoney(child.outstanding_fees)}</p>
                <p className="text-[11px] text-gray-500">{t('dashboard.outstandingFees')}</p>
              </div>
            </div>
            <Link to={`/students/${child.id}`} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
              {t('students.viewStudent')} →
            </Link>
          </Card>
        ))}
        {data.children.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
      </div>
    </div>
  )
}

function AccountantView({ data }: { data: AccountantDashboard }) {
  const { t } = useTranslation()
  return (
    <div>
      <PageHeader title={t('nav.dashboard')} />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label={t('dashboard.collectedThisMonth')} value={formatMoney(data.stats.collected_this_month)} color="bg-emerald-600" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        <StatCard label={t('dashboard.outstandingTotal')} value={formatMoney(data.stats.outstanding_total)} color="bg-red-600" icon="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </div>
      <Card className="mt-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.recentPayments')}</h3>
        <div className="space-y-2">
          {data.recent_payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-700">{p.student ?? '—'}</span>
                <span className="ms-2 text-xs text-gray-400">{p.receipt_number}</span>
              </div>
              <div className="text-end">
                <span className="font-semibold text-emerald-600">{formatMoney(p.amount)}</span>
                <p className="text-[11px] capitalize text-gray-400">{p.method}</p>
              </div>
            </div>
          ))}
          {data.recent_payments.length === 0 && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
        </div>
      </Card>
    </div>
  )
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}
