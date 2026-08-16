import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, unwrapList } from '../lib/api'
import { localizedName } from '../lib/format'
import { roleOf, useAuth } from '../context/AuthContext'
import type { Assignment, AssignmentSubmission, Invoice, ParentDashboard, StudentDashboard } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { Field, Input, Modal, Textarea } from '../components/form'

type Section = 'overview' | 'assignments' | 'fees'

export default function PortalPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const role = roleOf(user)
  const [section, setSection] = useState<Section>('overview')

  const [dashboard, setDashboard] = useState<StudentDashboard | ParentDashboard | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [submitFor, setSubmitFor] = useState<Assignment | null>(null)
  const [submitText, setSubmitText] = useState('')
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError('')
      try {
        const dash = await api.get<StudentDashboard | ParentDashboard>('/dashboard')
        setDashboard(dash.data)
        if (role === 'student') {
          const a = await api.get<{ data: unknown }>('/assignments')
          setAssignments(unwrapList<Assignment>(a.data))
        } else {
          const inv = await api.get<{ data: unknown }>('/invoices').catch(() => ({ data: { data: [] as unknown } }))
          setInvoices(unwrapList<Invoice>(inv.data as { data: unknown }))
        }
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [role])

  const submitAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submitFor) return
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      if (submitText) formData.append('text', submitText)
      if (submitFile) formData.append('file', submitFile)
      const res = await api.post<{ data: AssignmentSubmission }>(`/assignments/${submitFor.id}/submit`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setSubmissions((prev) => [...prev.filter((s) => s.assignment_id !== submitFor.id), res.data.data])
      setSubmitFor(null)
      setSubmitText('')
      setSubmitFile(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  if (role === 'student') {
    const studentDash = dashboard as StudentDashboard | null
    const mySubmission = (a: Assignment) => submissions.find((s) => s.assignment_id === a.id)
    const tabs = [
      { key: 'overview', label: t('common.view') },
      { key: 'assignments', label: t('assignments.title') },
    ]
    return (
      <div>
        <PageHeader
          title={t('nav.portal')}
          tabs={{ value: section, onChange: (v) => setSection(v as Section), items: tabs }}
        />
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        {section === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.todaysSchedule')}</h3>
              <div className="space-y-2">
                {studentDash?.todays_periods?.map((p) => (
                  <div key={p.period_number} className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">{p.period_number}.</span> <span className="text-gray-700">{p.subject_ar && isArabic() ? p.subject_ar : (p.subject ?? '—')}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {p.start_time}–{p.end_time} {p.room ? `· ${p.room}` : ''}
                    </span>
                  </div>
                ))}
                {!studentDash?.todays_periods?.length && <p className="text-sm text-gray-400">{t('common.noData')}</p>}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">{t('dashboard.latestResult')}</h3>
              {studentDash?.latest_result ? (
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="font-semibold text-gray-800">{studentDash.latest_result.subject_ar && isArabic() ? studentDash.latest_result.subject_ar : studentDash.latest_result.subject}</p>
                    <p className="text-xs text-gray-500">{t('exams.fullMarks')}: {studentDash.latest_result.full_marks}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-2xl font-bold text-gray-900">{studentDash.latest_result.marks ?? '—'}</p>
                    <Badge color="indigo">{studentDash.latest_result.grade ?? '—'}</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t('dashboard.noLatestResult')}</p>
              )}
            </Card>
          </div>
        )}
        {section === 'assignments' && (
          <div className="space-y-4">
            {assignments.length === 0 && <EmptyState message={t('common.noData')} />}
            {assignments.map((a) => {
              const sub = mySubmission(a)
              return (
                <Card key={a.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-800">{a.title}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {a.subject ? localizedName(a.subject) : ''} · {t('assignments.dueDate')}: {a.due_date}
                      </p>
                      {a.description && <p className="mt-2 text-sm text-gray-600">{a.description}</p>}
                    </div>
                    {sub ? (
                      <div className="text-end">
                        <Badge color={sub.status === 'graded' ? 'green' : sub.status === 'late' ? 'amber' : 'blue'}>{sub.status}</Badge>
                        {sub.grade !== null && <p className="mt-1 text-sm font-semibold text-gray-800">{t('assignments.grade')}: {sub.grade}</p>}
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setSubmitFor(a)}>
                        {t('assignments.submitWork')}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
        <Modal open={submitFor !== null} onClose={() => setSubmitFor(null)} title={t('assignments.submitWork')}>
          {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
          <form onSubmit={(e) => void submitAssignment(e)} className="space-y-4">
            <Field label={t('assignments.description')}>
              <Textarea value={submitText} onChange={(e) => setSubmitText(e.target.value)} />
            </Field>
            <Field label={t('assignments.attachments')}>
              <Input type="file" onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setSubmitFor(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={saving}>
                {t('common.submit')}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    )
  }

  const parentDash = dashboard as ParentDashboard | null
  const childIds = new Set((parentDash?.children ?? []).map((c) => c.id))
  const myInvoices = invoices.filter((inv) => childIds.has(inv.student_id))
  const tabs = [
    { key: 'overview', label: t('dashboard.myChildren') },
    { key: 'fees', label: t('fees.invoices') },
  ]

  return (
    <div>
      <PageHeader title={t('nav.portal')} tabs={{ value: section, onChange: (v) => setSection(v as Section), items: tabs }} />
      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {section === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(parentDash?.children ?? []).map((child) => (
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
                  <p className="text-lg font-bold text-amber-700">{child.outstanding_fees.toFixed(2)}</p>
                  <p className="text-[11px] text-gray-500">{t('dashboard.outstandingFees')}</p>
                </div>
              </div>
            </Card>
          ))}
          {(parentDash?.children ?? []).length === 0 && <EmptyState message={t('common.noData')} />}
        </div>
      ) : (
        <div className="space-y-4">
          {myInvoices.length === 0 && <EmptyState message={t('common.noData')} />}
          {myInvoices.map((inv) => (
            <Card key={inv.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{inv.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {inv.invoice_number} · {inv.student?.full_name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge color={inv.status === 'paid' ? 'green' : inv.status === 'partial' ? 'blue' : inv.status === 'overdue' ? 'red' : 'amber'}>
                    {inv.status}
                  </Badge>
                  <span className="font-semibold text-gray-900">{inv.amount.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
