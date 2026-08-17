import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, downloadBlob, errorMessage } from '../lib/api'
import { localizedName } from '../lib/format'
import { Alert, Button, Card, EmptyState, PageHeader, Spinner, Table } from '../components/ui'
import { Field, Input } from '../components/form'

type Section = 'students' | 'attendance' | 'academic' | 'finance'

interface StudentsReport {
  total: number
  active: number
  inactive: number
  archived: number
  by_grade: { name: string; name_ar?: string | null; count: number }[]
  new_admissions_this_month: number
}

interface AttendanceReport {
  summary: { present: number; absent: number; late: number; excused: number; rate: number }
  by_day: { date: string; present: number; absent: number }[]
}

interface AcademicReport {
  subject_averages: { name: string | null; name_ar?: string | null; class: string | null; class_ar?: string | null; grade?: string | null; grade_ar?: string | null; exam: string | null; average: number; full_marks: number; students: number }[]
}

interface FinanceReport {
  collected: number
  invoiced: number
  outstanding: number
  discounted: number
  payments_count: number
}

export default function ReportsPage() {
  const { t } = useTranslation()
  const [section, setSection] = useState<Section>('students')

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [students, setStudents] = useState<StudentsReport | null>(null)
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null)
  const [academic, setAcademic] = useState<AcademicReport | null>(null)
  const [finance, setFinance] = useState<FinanceReport | null>(null)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ data: StudentsReport }>('/reports/students')
      setStudents(res.data.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAttendance = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    setError('')
    try {
      const res = await api.get<AttendanceReport>('/reports/attendance', { params: { from, to } })
      setAttendance(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  const loadAcademic = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<AcademicReport>('/reports/academic')
      setAcademic(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFinance = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<FinanceReport>('/reports/finance')
      setFinance(res.data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  const runSection = () => {
    if (section === 'students') void loadStudents()
    if (section === 'attendance') void loadAttendance()
    if (section === 'academic') void loadAcademic()
    if (section === 'finance') void loadFinance()
  }

  const exportCsv = async () => {
    setError('')
    try {
      await downloadBlob('/reports/export.csv?type=students', 'students.csv')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const tabs = [
    { key: 'students', label: t('reports.students') },
    { key: 'attendance', label: t('reports.attendance') },
    { key: 'academic', label: t('reports.academic') },
    { key: 'finance', label: t('reports.finance') },
  ]

  return (
    <div>
      <PageHeader
        title={t('reports.title')}
        actions={section === 'students' ? <Button variant="secondary" onClick={() => void exportCsv()}>{t('common.exportCsv')}</Button> : undefined}
        tabs={{ value: section, onChange: (v) => setSection(v as Section), items: tabs }}
      />

      {section === 'attendance' && (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-52">
              <Field label={t('attendance.from')}>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
            </div>
            <div className="w-52">
              <Field label={t('attendance.to')}>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            <Button onClick={() => void loadAttendance()}>{t('common.submit')}</Button>
          </div>
        </Card>
      )}

      {section !== 'attendance' && section !== 'students' && (
        <div className="mb-4">
          <Button onClick={runSection}>{t('common.refresh')}</Button>
        </div>
      )}

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Spinner />
      ) : section === 'students' ? (
        students ? (
          <div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: t('reports.totalStudents'), value: students.total, color: 'text-indigo-700 bg-indigo-50' },
                { label: t('reports.activeStudents'), value: students.active, color: 'text-emerald-700 bg-emerald-50' },
                { label: t('reports.inactiveStudents'), value: students.inactive, color: 'text-gray-700 bg-gray-100' },
                { label: t('reports.newThisMonth'), value: students.new_admissions_this_month, color: 'text-amber-700 bg-amber-50' },
              ].map((card) => (
                <Card key={card.label} className={`p-5 ${card.color}`}>
                  <p className="text-xs font-medium opacity-70">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </Card>
              ))}
            </div>
            <Card className="mt-6 p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('reports.byGrade')}</h3>
              {students.by_grade.length === 0 ? (
                <p className="text-sm text-gray-400">{t('common.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {students.by_grade.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{localizedName(item)}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-40 overflow-hidden rounded bg-gray-100">
                          <div className="h-full rounded bg-indigo-600" style={{ width: `${Math.min(100, (item.count / Math.max(1, students.active)) * 100)}%` }} />
                        </div>
                        <span className="w-6 text-end font-medium">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <EmptyState message={t('common.noData')} />
        )
      ) : section === 'attendance' ? (
        attendance ? (
          <div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                { label: t('attendance.present'), value: attendance.summary.present, color: 'text-emerald-700 bg-emerald-50' },
                { label: t('attendance.absent'), value: attendance.summary.absent, color: 'text-red-700 bg-red-50' },
                { label: t('attendance.late'), value: attendance.summary.late, color: 'text-amber-700 bg-amber-50' },
                { label: t('attendance.excused'), value: attendance.summary.excused, color: 'text-blue-700 bg-blue-50' },
                { label: t('reports.attendanceRate'), value: `${attendance.summary.rate}%`, color: 'text-indigo-700 bg-indigo-50' },
              ].map((card) => (
                <Card key={card.label} className={`p-5 ${card.color}`}>
                  <p className="text-xs font-medium opacity-70">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </Card>
              ))}
            </div>
            {attendance.by_day.length > 0 && (
              <Card className="mt-6">
                <Table headers={[t('attendance.date'), t('attendance.present'), t('attendance.absent')]}>
                  {attendance.by_day.map((day, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{day.date}</td>
                      <td className="px-4 py-3 text-emerald-600">{day.present}</td>
                      <td className="px-4 py-3 text-red-600">{day.absent}</td>
                    </tr>
                  ))}
                </Table>
              </Card>
            )}
          </div>
        ) : (
          <EmptyState message={t('reports.pickDateRange')} />
        )
      ) : section === 'academic' ? (
        academic && academic.subject_averages.length > 0 ? (
          <Card>
            <Table headers={[t('academic.subjectName'), t('classes.title'), t('exams.title'), t('reports.average'), t('exams.fullMarks'), t('reports.students')]}>
              {academic.subject_averages.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{localizedName(row)}</td>
                  <td className="px-4 py-3 text-gray-600">{localizedName({ name: row.class, name_ar: row.class_ar }) || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.exam ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{row.average.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-600">{row.full_marks}</td>
                  <td className="px-4 py-3 text-gray-600">{row.students}</td>
                </tr>
              ))}
            </Table>
          </Card>
        ) : (
          <EmptyState message={t('common.noData')} />
        )
      ) : finance ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: t('reports.collected'), value: finance.collected, color: 'text-emerald-700 bg-emerald-50' },
            { label: t('reports.invoiced'), value: finance.invoiced, color: 'text-indigo-700 bg-indigo-50' },
            { label: t('reports.outstanding'), value: finance.outstanding, color: 'text-red-700 bg-red-50' },
            { label: t('reports.discounted'), value: finance.discounted, color: 'text-amber-700 bg-amber-50' },
          ].map((card) => (
            <Card key={card.label} className={`p-5 ${card.color}`}>
              <p className="text-xs font-medium opacity-70">{card.label}</p>
              <p className="mt-1 text-2xl font-bold">{card.value.toFixed(2)}</p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState message={t('common.noData')} />
      )}
    </div>
  )
}
