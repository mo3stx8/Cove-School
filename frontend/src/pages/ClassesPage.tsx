import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, unwrapList } from '../lib/api'
import { isArabic, localizedName } from '../lib/format'
import type { AcademicYear, Grade, SchoolClass, Student, Subject, Teacher } from '../lib/types'
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

  const [assignModal, setAssignModal] = useState<SchoolClass | null>(null)
  const [studentRows, setStudentRows] = useState<Student[]>([])
  const [assigningStudents, setAssigningStudents] = useState(false)
  const [assignStudentsError, setAssignStudentsError] = useState('')

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
    if (!confirm(`${t('common.delete')} ${localizedName(cls)}?`)) return
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

  const openAssignStudents = async (cls: SchoolClass) => {
    setAssignStudentsError('')
    setAssignModal(cls)
    setStudentRows([])
    try {
      const res = await api.get<{ data: unknown }>('/students', { params: { per_page: 500, status: 'active' } })
      setStudentRows(unwrapList<Student>(res.data))
    } catch {
      setAssignStudentsError(errorMessage(new Error('Failed to load students.')))
    }
  }

  const saveAssignStudents = async () => {
    if (!assignModal) return
    setAssigningStudents(true)
    setAssignStudentsError('')
    try {
      const student_ids = studentRows.filter((s) => s.class_id === assignModal.id).map((s) => s.id)
      await api.post(`/classes/${assignModal.id}/assign-students`, { student_ids })
      setAssignModal(null)
      await load()
    } catch (err) {
      setAssignStudentsError(errorMessage(err))
    } finally {
      setAssigningStudents(false)
    }
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
                <h3 className="font-semibold text-gray-800">{localizedName(cls)}</h3>
                <Badge color={cls.is_active ? 'green' : 'gray'}>
                  {cls.is_active ? t('classes.active') : t('common.archived')}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                {localizedName(cls.grade) ?? t('classes.noGrade')} · {cls.room ?? '—'} · {t('classes.studentsCount')}: {cls.students_count}
              </p>
              {cls.subjects && cls.subjects.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cls.subjects.map((s) => (
                    <span key={s.subject_id} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {isArabic() && s.subject_name_ar ? s.subject_name_ar : s.subject_name}
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
                <Button variant="secondary" size="sm" onClick={() => void openAssignStudents(cls)}>
                  {t('classes.assignStudents')}
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
                  {localizedName(g)}
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

      <Modal open={subjectsModal !== null} onClose={() => setSubjectsModal(null)} title={`${t('classes.assignSubjects')} — ${subjectsModal ? localizedName(subjectsModal) : ''}`} wide>
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
                    {localizedName(s)}
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

      <Modal open={assignModal !== null} onClose={() => setAssignModal(null)} title={`${t('classes.assignStudents')} — ${assignModal ? localizedName(assignModal) : ''}`} wide>
        {assignStudentsError && <div className="mb-4"><Alert type="error">{assignStudentsError}</Alert></div>}
        <p className="mb-3 text-sm text-gray-500">{t('classes.assignStudentsHint')}</p>
        {studentRows.length === 0 ? (
          <EmptyState message={t('classes.noStudentsToAssign')} />
        ) : (
          <>
            <div className="mb-2 flex justify-end">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={studentRows.length > 0 && studentRows.every((s) => s.class_id === assignModal?.id)}
                  onChange={(e) => setStudentRows(studentRows.map((s) => ({ ...s, class_id: e.target.checked ? (assignModal?.id as number) : 0 })))}
                />
                {t('common.selectAll')}
              </label>
            </div>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
              {studentRows.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2">
                  <span className="truncate text-sm text-gray-700">{s.full_name}</span>
                  <span className="text-xs text-gray-400">{s.class ? localizedName(s.class) : t('classes.noClass')}</span>
                  <input
                    type="checkbox"
                    className="ml-3 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={s.class_id === assignModal?.id}
                    onChange={(e) => setStudentRows(studentRows.map((r) => (r.id === s.id ? { ...r, class_id: e.target.checked ? (assignModal?.id as number) : 0 } : r)))}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={() => setAssignModal(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void saveAssignStudents()} loading={assigningStudents}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
