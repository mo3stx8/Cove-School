import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../lib/api'
import type { AcademicYear, Grade, Subject, Term } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { Field, Input, Modal } from '../components/form'

type Section = 'years' | 'grades' | 'subjects'

interface TermForm {
  name: string
  term_number: string
  start_date: string
  end_date: string
  is_current: boolean
}
interface GradeForm {
  name: string
  level: string
  is_active: boolean
}
interface SubjectForm {
  name: string
  code: string
  description: string
}

export default function AcademicPage() {
  const { t } = useTranslation()
  const [section, setSection] = useState<Section>('years')
  const [loading, setLoading] = useState(true)

  const [years, setYears] = useState<AcademicYear[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<unknown>(null)
  const [termYear, setTermYear] = useState<AcademicYear | null>(null)
  const [form, setForm] = useState<Record<string, string | boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [y, g, s] = await Promise.all([
        api.get<{ data: AcademicYear[] }>('/academic-years'),
        api.get<{ data: Grade[] }>('/grades'),
        api.get<{ data: Subject[] }>('/subjects'),
      ])
      setYears(y.data.data)
      setGrades(g.data.data)
      setSubjects(s.data.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tabs: { key: Section; label: string }[] = [
    { key: 'years', label: t('academic.academicYears') },
    { key: 'grades', label: t('academic.grades') },
    { key: 'subjects', label: t('academic.subjects') },
  ]

  const openAdd = () => {
    setEditing(null)
    setError('')
    if (section === 'grades') setForm({ name: '', level: '', is_active: true })
    if (section === 'subjects') setForm({ name: '', code: '', description: '' })
    setModalOpen(true)
  }

  const openEdit = (item: unknown) => {
    setEditing(item)
    setError('')
    if (section === 'grades') {
      const g = item as Grade
      setForm({ name: g.name, level: String(g.level), is_active: Boolean(g.is_active) })
    }
    if (section === 'subjects') {
      const s = item as Subject
      setForm({ name: s.name, code: s.code ?? '', description: s.description ?? '' })
    }
    setModalOpen(true)
  }

  const openTerm = (year: AcademicYear) => {
    setError('')
    setTermYear(year)
    setForm({ name: '', term_number: String((year.terms?.length ?? 0) + 1), start_date: '', end_date: '', is_current: false })
  }

  const setCurrentYear = async (year: AcademicYear) => {
    setError('')
    try {
      await api.post(`/academic-years/${year.id}/set-current`, {})
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (termYear) {
        const f = form as unknown as TermForm
        await api.post(`/academic-years/${termYear.id}/terms`, {
          name: f.name,
          term_number: Number(f.term_number),
          start_date: f.start_date,
          end_date: f.end_date,
          is_current: f.is_current,
        })
        setTermYear(null)
      } else if (section === 'grades') {
        const g = form as unknown as GradeForm
        const payload: Record<string, string | number | boolean> = { name: g.name, is_active: g.is_active }
        if (editing) {
          await api.put(`/grades/${(editing as Grade).id}`, payload)
        } else {
          await api.post('/grades', { ...payload, level: Number(g.level) })
        }
      } else {
        const s = form as unknown as SubjectForm
        const payload = { name: s.name, code: s.code || undefined, description: s.description || undefined }
        if (editing) await api.put(`/subjects/${(editing as Subject).id}`, payload)
        else await api.post('/subjects', payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('academic.title')}
        actions={section !== 'years' ? <Button onClick={openAdd}>{t('common.add')}</Button> : undefined}
        tabs={{
          value: section,
          onChange: (v) => setSection(v as Section),
          items: tabs,
        }}
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Spinner />
      ) : (
        <>
          {section === 'years' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {years.length === 0 && <EmptyState message={t('common.noData')} />}
              {years.map((year) => (
                <Card key={year.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{year.name}</h3>
                    {year.is_current && <Badge color="green">{t('academic.current')}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {year.start_date} → {year.end_date}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(year.terms ?? []).map((term: Term) => (
                      <span key={term.id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {term.name} {term.is_current ? `(${t('academic.current')})` : ''}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openTerm(year)}>
                      {t('academic.addTerm')}
                    </Button>
                    {!year.is_current && (
                      <Button variant="secondary" size="sm" onClick={() => void setCurrentYear(year)}>
                        {t('academic.setCurrent')}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {section === 'grades' && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {grades.length === 0 && <EmptyState message={t('common.noData')} />}
              {grades.map((grade) => (
                <Card key={grade.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{grade.name}</h3>
                    <Badge color={grade.is_active ? 'green' : 'gray'}>
                      {grade.is_active ? t('classes.active') : t('common.archived')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{t('academic.level')}: {grade.level}</p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(grade)}>
                      {t('common.edit')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {section === 'subjects' && (
            <Card className="p-5">
              {subjects.length === 0 ? (
                <EmptyState message={t('common.noData')} />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {subjects.map((subject) => (
                    <li key={subject.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-gray-800">{subject.name}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-mono">{subject.code}</span>
                          {subject.description ? ` · ${subject.description}` : ''}
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => openEdit(subject)}>
                        {t('common.edit')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}

      <Modal
        open={modalOpen || termYear !== null}
        onClose={() => {
          setModalOpen(false)
          setTermYear(null)
        }}
        title={
          termYear
            ? `${t('academic.addTerm')} — ${termYear.name}`
            : editing
              ? t('common.edit')
              : t('common.add')
        }
      >
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void submit(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {termYear && (
            <>
              <Field label={t('academic.termName')} required>
                <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label={t('academic.termNumber')} required>
                <Input type="number" min={1} value={String(form.term_number ?? '')} onChange={(e) => setForm({ ...form, term_number: e.target.value })} required />
              </Field>
              <Field label={t('academic.startDate')} required>
                <Input type="date" value={String(form.start_date ?? '')} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
              </Field>
              <Field label={t('academic.endDate')} required>
                <Input type="date" value={String(form.end_date ?? '')} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
              </Field>
              <label className="col-span-full flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_current)}
                  onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
                />
                {t('academic.current')}
              </label>
            </>
          )}

          {!termYear && section === 'grades' && (
            <>
              <Field label={t('academic.gradeName')} required>
                <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Grade 1" />
              </Field>
              {!editing && (
                <Field label={t('academic.level')} required>
                  <Input type="number" min={1} max={15} value={String(form.level ?? '')} onChange={(e) => setForm({ ...form, level: e.target.value })} required />
                </Field>
              )}
              <label className="col-span-full flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.is_active)}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                {t('classes.active')}
              </label>
            </>
          )}

          {!termYear && section === 'subjects' && (
            <>
              <Field label={t('academic.subjectName')} required>
                <Input value={String(form.name ?? '')} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label={t('academic.code')}>
                <Input value={String(form.code ?? '')} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
              <div className="col-span-full">
                <Field label={t('academic.description')}>
                  <Input value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          <div className="col-span-full mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setModalOpen(false)
                setTermYear(null)
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
