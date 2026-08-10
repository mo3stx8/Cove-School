import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../lib/api'
import type { AcademicYear, Grade, SchoolClass, Subject, Teacher } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'

export default function ClassesPage() {
  const { t } = useTranslation()
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [years, setYears] = useState<AcademicYear[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SchoolClass | null>(null)
  const [form, setForm] = useState({
    grade_id: '',
    academic_year_id: '',
    section_name: '',
    room: '',
    class_teacher_id: '',
    capacity: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [subjectsModal, setSubjectsModal] = useState<SchoolClass | null>(null)
  const [subjectRows, setSubjectRows] = useState<{ subject_id: string; teacher_id: string; weekly_periods: string }[]>([])
  const [savingSubjects, setSavingSubjects] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: SchoolClass[] }>('/classes')
      setClasses(res.data.data)
    } catch {
      setClasses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const [g, y, tch, sub] = await Promise.all([
        api.get<{ data: Grade[] }>('/grades'),
        api.get<{ data: AcademicYear[] }>('/academic-years'),
        api.get<{ data: Teacher[] }>('/teachers', { params: { per_page: 100 } }).catch(() => ({ data: { data: [] as Teacher[] } })),
        api.get<{ data: Subject[] }>('/subjects'),
      ])
      setGrades(g.data.data.filter((gr) => gr.is_active))
      setYears(y.data.data)
      setTeachers(tch.data.data)
      setSubjects(sub.data.data)
    })()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ grade_id: '', academic_year_id: '', section_name: '', room: '', class_teacher_id: '', capacity: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (cls: SchoolClass) => {
    setEditing(cls)
    setForm({
      grade_id: cls.grade ? String(cls.grade.id) : '',
      academic_year_id: cls.academic_year ? String(cls.academic_year.id) : '',
      section_name: cls.section_name,
      room: cls.room ?? '',
      class_teacher_id: cls.class_teacher ? String(cls.class_teacher.id) : '',
      capacity: cls.capacity ? String(cls.capacity) : '',
    })
    setError('')
    setModalOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      grade_id: Number(form.grade_id),
      academic_year_id: Number(form.academic_year_id),
      section_name: form.section_name,
      room: form.room || undefined,
      class_teacher_id: form.class_teacher_id ? Number(form.class_teacher_id) : undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
    }
    try {
      if (editing) {
        await api.put(`/classes/${editing.id}`, payload)
      } else {
        await api.post('/classes', payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (cls: SchoolClass) => {
    if (!confirm(`${t('common.delete')} ${cls.name}?`)) return
    try {
      await api.delete(`/classes/${cls.id}`)
      await load()
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  const openAssignSubjects = (cls: SchoolClass) => {
    setSubjectsModal(cls)
    setSubjectRows(
      (cls.subjects ?? []).map((s) => ({
        subject_id: String(s.subject_id),
        teacher_id: s.teacher_id ? String(s.teacher_id) : '',
        weekly_periods: String(s.weekly_periods ?? 0),
      })),
    )
    setError('')
  }

  const saveSubjects = async () => {
    if (!subjectsModal) return
    setSavingSubjects(true)
    setError('')
    try {
      await api.post(`/classes/${subjectsModal.id}/subjects`, {
        subjects: subjectRows
          .filter((r) => r.subject_id)
          .map((r) => ({
            subject_id: Number(r.subject_id),
            teacher_id: r.teacher_id ? Number(r.teacher_id) : undefined,
            weekly_periods: r.weekly_periods ? Number(r.weekly_periods) : undefined,
          })),
      })
      setSubjectsModal(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingSubjects(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('classes.title')} actions={<Button onClick={openAdd}>{t('classes.addClass')}</Button>} />

      {loading ? (
        <Spinner />
      ) : classes.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id} className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{cls.name}</h3>
                <Badge color={cls.is_active ? 'green' : 'gray'}>
                  {cls.is_active ? t('classes.active') : t('common.archived')}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                {cls.grade?.name ?? t('classes.noGrade')} · {cls.room ?? '—'} · {t('classes.studentsCount')}: {cls.students_count}
              </p>
              {cls.subjects && cls.subjects.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cls.subjects.map((s) => (
                    <span key={s.subject_id} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {s.subject_name}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(cls)}>
                  {t('common.edit')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openAssignSubjects(cls)}>
                  {t('classes.assignSubjects')}
                </Button>
                <Button variant="danger" size="sm" onClick={() => void remove(cls)}>
                  {t('common.delete')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('classes.editClass') : t('classes.addClass')}>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void submit(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('classes.grade')} required>
            <Select value={form.grade_id} onChange={(e) => setForm({ ...form, grade_id: e.target.value })} required>
              <option value="">—</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('classes.academicYear')} required>
            <Select value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })} required>
              <option value="">—</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('classes.sectionName')} required>
            <Input value={form.section_name} onChange={(e) => setForm({ ...form, section_name: e.target.value })} required />
          </Field>
          <Field label={t('classes.room')}>
            <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </Field>
          <Field label={t('classes.classTeacher')}>
            <Select value={form.class_teacher_id} onChange={(e) => setForm({ ...form, class_teacher_id: e.target.value })}>
              <option value="">—</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.user?.id}>
                  {teacher.user?.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('classes.capacity')}>
            <Input type="number" min={1} max={500} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </Field>
          <div className="col-span-full mt-4 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={subjectsModal !== null} onClose={() => setSubjectsModal(null)} title={`${t('classes.assignSubjects')} — ${subjectsModal?.name ?? ''}`} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <div className="space-y-3">
          {subjectRows.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <Select
                value={row.subject_id}
                onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, subject_id: e.target.value } : r)))}
              >
                <option value="">{t('classes.subject')}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select
                value={row.teacher_id}
                onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, teacher_id: e.target.value } : r)))}
              >
                <option value="">{t('exams.teacher')} —</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.user?.id}>
                    {teacher.user?.name}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  max={40}
                  placeholder={t('classes.weeklyPeriods')}
                  value={row.weekly_periods}
                  onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, weekly_periods: e.target.value } : r)))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubjectRows(subjectRows.filter((_, j) => j !== i))}
                  aria-label="Remove"
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => setSubjectRows([...subjectRows, { subject_id: '', teacher_id: '', weekly_periods: '' }])}
          >
            + {t('common.add')}
          </Button>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" onClick={() => setSubjectsModal(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void saveSubjects()} loading={savingSubjects}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
