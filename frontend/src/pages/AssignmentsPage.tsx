import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, listMeta, unwrapList } from '../lib/api'
import type { Assignment, AssignmentSubmission, SchoolClass, Subject } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner, Table } from '../components/ui'
import { Field, Input, Modal, Select, Textarea } from '../components/form'

interface FormState {
  title: string
  description: string
  class_id: string
  subject_id: string
  due_date: string
  due_time: string
}

const formatDueTime = (iso: string): string => {
  const time = iso.length > 8 ? iso.slice(11, 16) : iso.slice(0, 5)
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = ((h % 12) || 12).toString()
  return `${hour12}:${mStr} ${suffix}`
}

const toTimeInput = (iso: string | null): string => {
  if (!iso) return ''
  return iso.length > 8 ? iso.slice(11, 16) : iso.slice(0, 5)
}

export default function AssignmentsPage() {
  const { t } = useTranslation()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [form, setForm] = useState<FormState>({ title: '', description: '', class_id: '', subject_id: '', due_date: '', due_time: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [submissionsFor, setSubmissionsFor] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([])
  const [gradeRows, setGradeRows] = useState<Record<number, { grade: string; feedback: string }>>({})
  const [gradeSaving, setGradeSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/assignments', { params: { per_page: 25, page } })
      setAssignments(unwrapList<Assignment>(res.data))
      const meta = listMeta(res.data)
      setLastPage(meta.last_page)
      setTotal(meta.total)
    } catch {
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const [c, s] = await Promise.all([
        api.get<{ data: SchoolClass[] }>('/classes').catch(() => ({ data: { data: [] as SchoolClass[] } })),
        api.get<{ data: Subject[] }>('/subjects').catch(() => ({ data: { data: [] as Subject[] } })),
      ])
      setClasses(c.data.data)
      setSubjects(s.data.data)
    })()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', description: '', class_id: '', subject_id: '', due_date: '', due_time: '' })
    setError('')
    setCreateOpen(true)
  }

  const openEdit = (a: Assignment) => {
    setEditing(a)
    setForm({
      title: a.title,
      description: a.description ?? '',
      class_id: String(a.class_id),
      subject_id: String(a.subject_id),
      due_date: a.due_date.slice(0, 10),
      due_time: toTimeInput(a.due_time),
    })
    setError('')
    setCreateOpen(true)
  }

  const createAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        class_id: Number(form.class_id),
        subject_id: form.subject_id ? Number(form.subject_id) : undefined,
        due_date: form.due_date,
        due_time: form.due_time || undefined,
      }
      if (editing) {
        await api.put(`/assignments/${editing.id}`, payload)
      } else {
        await api.post('/assignments', payload)
      }
      setCreateOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const closeAssignment = async (assignment: Assignment) => {
    setError('')
    try {
      await api.delete(`/assignments/${assignment.id}`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const openSubmissions = async (assignment: Assignment) => {
    setError('')
    setSubmissionsFor(assignment)
    setSubmissions([])
    setGradeRows({})
    try {
      const res = await api.get<{ data: Assignment }>(`/assignments/${assignment.id}`)
      const subs = res.data.data.submissions ?? []
      setSubmissions(subs)
      setGradeRows(
        Object.fromEntries(subs.filter((s) => s.grade !== null).map((s) => [s.id, { grade: String(s.grade), feedback: s.feedback ?? '' }])),
      )
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const saveGrades = async () => {
    if (!submissionsFor) return
    setGradeSaving(true)
    setError('')
    try {
      for (const [id, row] of Object.entries(gradeRows)) {
        if (row.grade === '') continue
        await api.post(`/assignments/${submissionsFor.id}/submissions/${id}/grade`, {
          grade: Number(row.grade),
          feedback: row.feedback || undefined,
        })
      }
      setSubmissionsFor(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGradeSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('assignments.title')} actions={<Button onClick={openCreate}>{t('assignments.addAssignment')}</Button>} />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Spinner />
      ) : assignments.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <>
          <Card>
            <Table
              headers={[t('assignments.assignmentTitle'), t('assignments.class'), t('assignments.subject'), t('assignments.dueDate'), t('assignments.submissions'), t('common.status'), t('common.actions')]}
            >
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.title}</td>
                  <td className="px-4 py-3 text-gray-600">{a.class?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.subject?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.due_date.slice(0, 10)}
                    {a.due_time ? ` - ${formatDueTime(a.due_time)}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.submissions_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge color={a.status === 'published' ? 'green' : 'gray'}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(a)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => void openSubmissions(a)}>
                        {t('assignments.submissions')}
                      </Button>
                      {a.status === 'published' && (
                        <Button variant="danger" size="sm" onClick={() => void closeAssignment(a)}>
                          {t('common.close')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
          <div className="mt-4">
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setEditing(null)
        }}
        title={editing ? t('assignments.editAssignment') : t('assignments.addAssignment')}
        wide
      >
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void createAssignment(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-full">
            <Field label={t('assignments.assignmentTitle')} required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
          </div>
          <div className="col-span-full">
            <Field label={t('assignments.description')}>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
          <Field label={t('assignments.class')} required>
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
              <option value="">—</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('assignments.subject')} required>
            <Select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required>
              <option value="">—</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('assignments.dueDate')} required>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
          </Field>
          <Field label={t('assignments.dueTime')}>
            <Input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} />
          </Field>
          <div className="col-span-full mt-4 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setCreateOpen(false); setEditing(null) }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={submissionsFor !== null} onClose={() => setSubmissionsFor(null)} title={`${t('assignments.submissions')} — ${submissionsFor?.title ?? ''}`} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        {submissions.length === 0 ? (
          <EmptyState message={t('common.noData')} />
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">{s.student?.full_name ?? `#${s.student_id}`}</p>
                  <Badge color={s.status === 'graded' ? 'green' : s.status === 'late' ? 'amber' : 'blue'}>{s.status}</Badge>
                </div>
                <p className="text-xs text-gray-500">{s.submitted_at}</p>
                {s.text && <p className="mt-1 text-sm text-gray-600">{s.text}</p>}
                {s.file_name && <p className="mt-1 text-xs text-gray-500">{s.file_name}</p>}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={t('assignments.grade')}
                    value={gradeRows[s.id]?.grade ?? ''}
                    onChange={(e) => setGradeRows({ ...gradeRows, [s.id]: { grade: e.target.value, feedback: gradeRows[s.id]?.feedback ?? '' } })}
                  />
                  <Input
                    placeholder={t('assignments.feedback')}
                    value={gradeRows[s.id]?.feedback ?? ''}
                    onChange={(e) => setGradeRows({ ...gradeRows, [s.id]: { grade: gradeRows[s.id]?.grade ?? '', feedback: e.target.value } })}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSubmissionsFor(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void saveGrades()} loading={gradeSaving}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
