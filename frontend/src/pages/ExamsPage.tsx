import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, listMeta, unwrapList } from '../lib/api'
import type { AcademicYear, Exam, ExamResult, ExamSubject, SchoolClass, Subject, Term } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'

interface MarksRow {
  student_id: number
  name: string
  marks: string
}

interface SubjectRow {
  class_id: string
  subject_id: string
  full_marks: string
  pass_marks: string
}

export default function ExamsPage() {
  const { t } = useTranslation()
  const [exams, setExams] = useState<Exam[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [years, setYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [examForm, setExamForm] = useState({ name: '', type: 'exam', academic_year_id: '', term_id: '', start_date: '', end_date: '' })
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([{ class_id: '', subject_id: '', full_marks: '', pass_marks: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<ExamSubject | null>(null)
  const [marksRows, setMarksRows] = useState<MarksRow[]>([])
  const [marksSaving, setMarksSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/exams', { params: { per_page: 25, page } })
      setExams(unwrapList<Exam>(res.data))
      const meta = listMeta(res.data)
      setLastPage(meta.last_page)
      setTotal(meta.total)
    } catch {
      setExams([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const [y, c, s] = await Promise.all([
        api.get<{ data: AcademicYear[] }>('/academic-years'),
        api.get<{ data: SchoolClass[] }>('/classes'),
        api.get<{ data: Subject[] }>('/subjects'),
      ])
      setYears(y.data.data)
      setClasses(c.data.data)
      setSubjects(s.data.data)
    })()
  }, [])

  const loadTerms = async (yearId: string) => {
    if (!yearId) {
      setTerms([])
      return
    }
    try {
      const res = await api.get<{ data: Term[] }>(`/academic-years/${yearId}/terms`)
      setTerms(res.data.data)
    } catch {
      setTerms([])
    }
  }

  const openCreate = () => {
    setError('')
    setExamForm({ name: '', type: 'exam', academic_year_id: '', term_id: '', start_date: '', end_date: '' })
    setSubjectRows([{ class_id: '', subject_id: '', full_marks: '', pass_marks: '' }])
    setCreateOpen(true)
  }

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const validSubjects = subjectRows.filter((r) => r.class_id && r.subject_id)
      await api.post('/exams', {
        name: examForm.name,
        type: examForm.type,
        academic_year_id: Number(examForm.academic_year_id),
        term_id: examForm.term_id ? Number(examForm.term_id) : undefined,
        start_date: examForm.start_date || undefined,
        end_date: examForm.end_date || undefined,
        subjects: validSubjects.map((r) => ({
          class_id: Number(r.class_id),
          subject_id: Number(r.subject_id),
          full_marks: r.full_marks ? Number(r.full_marks) : 100,
          pass_marks: r.pass_marks ? Number(r.pass_marks) : 50,
        })),
      })
      setCreateOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openMarks = async (es: ExamSubject) => {
    setError('')
    setSelected(es)
    setMarksSaving(true)
    try {
      const [st, res] = await Promise.all([
        api.get<{ data: unknown }>('/students', { params: { class_id: es.class_id, per_page: 500 } }),
        api.get<{ data: { results: ExamResult[] } }>(`/exam-subjects/${es.id}`),
      ])
      const students = unwrapList<{ id: number; full_name: string }>(st.data as { data: unknown })
      const existing = Object.fromEntries(res.data.data.results.map((r) => [r.student_id, String(r.marks ?? '')]))
      setMarksRows(students.map((s) => ({ student_id: s.id, name: s.full_name, marks: existing[s.id] ?? '' })))
    } catch (err) {
      setError(errorMessage(err))
      setMarksRows([])
    } finally {
      setMarksSaving(false)
    }
  }

  const saveMarks = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setMarksSaving(true)
    setError('')
    try {
      const marks: Record<number, number | null> = {}
      for (const r of marksRows) marks[r.student_id] = r.marks === '' ? null : Number(r.marks)
      await api.post(`/exam-subjects/${selected.id}/marks`, { marks })
      setSelected(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setMarksSaving(false)
    }
  }

  const transition = async (es: ExamSubject, status: 'submit' | 'review' | 'publish') => {
    setError('')
    try {
      await api.post(`/exam-subjects/${es.id}/${status}`, {})
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const statusColor = (s: string) => (s === 'draft' ? 'gray' : s === 'submitted' ? 'amber' : s === 'reviewed' ? 'blue' : 'green')

  return (
    <div>
      <PageHeader title={t('exams.title')} actions={<Button onClick={openCreate}>{t('exams.addExam')}</Button>} />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Spinner />
      ) : exams.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <>
          <div className="space-y-4">
            {exams.map((exam) => (
              <Card key={exam.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{exam.name}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      <Badge color="purple">{exam.type}</Badge> · {exam.academic_year?.name} · {exam.term?.name ?? '—'} · {exam.start_date ?? ''} → {exam.end_date ?? ''}
                    </p>
                  </div>
                </div>

                {(exam.exam_subjects ?? []).length > 0 && (
                  <div className="mt-4 space-y-2">
                    {(exam.exam_subjects ?? []).map((es) => (
                      <div key={es.id} className="flex flex-wrap items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {es.subject?.name} — {es.class?.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t('exams.fullMarks')}: {es.full_marks} · {t('exams.passMarks')}: {es.pass_marks}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={statusColor(es.status)}>{es.status}</Badge>
                          <Button variant="secondary" size="sm" onClick={() => void openMarks(es)}>
                            {t('exams.enterMarks')}
                          </Button>
                          {es.status === 'draft' && (
                            <Button variant="secondary" size="sm" onClick={() => void transition(es, 'submit')}>
                              {t('exams.submit')}
                            </Button>
                          )}
                          {es.status === 'submitted' && (
                            <Button variant="secondary" size="sm" onClick={() => void transition(es, 'review')}>
                              {t('exams.review')}
                            </Button>
                          )}
                          {es.status === 'reviewed' && (
                            <Button size="sm" onClick={() => void transition(es, 'publish')}>
                              {t('exams.publish')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('exams.addExam')} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void createExam(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-full">
            <Field label={t('exams.name')} required>
              <Input value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} required />
            </Field>
          </div>
          <Field label={t('exams.type')} required>
            <Select value={examForm.type} onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}>
              <option value="exam">{t('exams.exam')}</option>
              <option value="quiz">{t('exams.quiz')}</option>
              <option value="midterm">{t('exams.midterm')}</option>
              <option value="final">{t('exams.final')}</option>
            </Select>
          </Field>
          <Field label={t('exams.academicYear')} required>
            <Select
              value={examForm.academic_year_id}
              onChange={(e) => {
                setExamForm({ ...examForm, academic_year_id: e.target.value })
                void loadTerms(e.target.value)
              }}
              required
            >
              <option value="">—</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('exams.term')}>
            <Select value={examForm.term_id} onChange={(e) => setExamForm({ ...examForm, term_id: e.target.value })}>
              <option value="">—</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('exams.startDate')}>
            <Input type="date" value={examForm.start_date} onChange={(e) => setExamForm({ ...examForm, start_date: e.target.value })} />
          </Field>
          <Field label={t('exams.endDate')}>
            <Input type="date" value={examForm.end_date} onChange={(e) => setExamForm({ ...examForm, end_date: e.target.value })} />
          </Field>

          <div className="col-span-full border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-gray-700">{t('exams.addSubjects')}</p>
            <div className="space-y-3">
              {subjectRows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  <Select value={row.class_id} onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, class_id: e.target.value } : r)))}>
                    <option value="">{t('classes.title')}</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select value={row.subject_id} onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, subject_id: e.target.value } : r)))}>
                    <option value="">{t('academic.subjectName')}</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <Input type="number" min={1} placeholder={t('exams.fullMarks')} value={row.full_marks} onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, full_marks: e.target.value } : r)))} />
                  <Input type="number" min={0} placeholder={t('exams.passMarks')} value={row.pass_marks} onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, pass_marks: e.target.value } : r)))} />
                  <Button variant="ghost" size="sm" type="button" onClick={() => setSubjectRows(subjectRows.filter((_, j) => j !== i))}>
                    ×
                  </Button>
                </div>
              ))}
              <Button variant="secondary" type="button" onClick={() => setSubjectRows([...subjectRows, { class_id: '', subject_id: '', full_marks: '', pass_marks: '' }])}>
                + {t('common.add')}
              </Button>
            </div>
          </div>

          <div className="col-span-full mt-4 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={t('exams.enterMarks')} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        {marksSaving ? (
          <Spinner />
        ) : (
          <form onSubmit={(e) => void saveMarks(e)} className="space-y-2">
            <p className="mb-2 text-sm text-gray-500">
              {selected?.subject?.name} — {selected?.class?.name} · {t('exams.fullMarks')}: {selected?.full_marks}
            </p>
            {marksRows.map((row) => (
              <div key={row.student_id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2">
                <span className="text-sm font-medium text-gray-800">{row.name}</span>
                <input
                  type="number"
                  min={0}
                  max={selected?.full_marks ?? 100}
                  step="0.25"
                  value={row.marks}
                  onChange={(e) => setMarksRows(marksRows.map((r) => (r.student_id === row.student_id ? { ...r, marks: e.target.value } : r)))}
                  className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-right text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="—"
                />
              </div>
            ))}
            {marksRows.length === 0 && <EmptyState message={t('common.noData')} />}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" type="button" onClick={() => setSelected(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={marksSaving}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
