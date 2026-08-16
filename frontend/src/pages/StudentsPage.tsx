import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, listMeta, unwrapList } from '../lib/api'
import { localizedName } from '../lib/format'
import type { SchoolClass, Student } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner, Table } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'
import ParentSection, { emptyParentForm, type ParentForm } from '../components/ParentSection'
import { useEmailCheck } from '../lib/emailCheck'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'

interface StudentForm {
  first_name: string
  middle_name: string
  last_name: string
  email: string
  system_email: string
  date_of_birth: string
  gender: string
  nationality: string
  address: string
  enrollment_date: string
  class_id: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
}

const emptyForm: StudentForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  system_email: '',
  date_of_birth: '',
  gender: '',
  nationality: '',
  address: '',
  enrollment_date: '',
  class_id: '',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_phone: '',
}

const buildParentPayload = (p: ParentForm): Record<string, unknown> | undefined => {
  if (p.linked_guardian_id) {
    return { linked_guardian_id: p.linked_guardian_id }
  }
  const hasData = p.name.trim() || p.phone.trim() || p.email.trim() || p.system_email.trim()
  if (!hasData) return undefined
  return {
    name: p.name.trim() || undefined,
    phone: p.phone.trim() || undefined,
    email: p.email.trim() || undefined,
    system_email: p.system_email.trim() || undefined,
  }
}

export default function StudentsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { hasRole } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentForm>(emptyForm)
  const [father, setFather] = useState<ParentForm>(emptyParentForm())
  const [mother, setMother] = useState<ParentForm>(emptyParentForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const [assignModal, setAssignModal] = useState<{ student: Student; class_id: string } | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  const { state: studentEmailState, owners: studentEmailOwners } = useEmailCheck(editing ? '' : form.email)
  const studentEmailConflict = studentEmailState === 'used' && studentEmailOwners[0]
    ? t('students.emailUsedBy', {
        name: studentEmailOwners[0].name,
        context: studentEmailOwners[0].context,
      })
    : undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/students', { params: { per_page: 25, page, search: search || undefined, status: status || undefined } })
      setStudents(unwrapList<Student>(res.data))
      const meta = listMeta(res.data)
      setLastPage(meta.last_page)
      setTotal(meta.total)
    } catch {
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!hasRole('admin')) return
    void (async () => {
      const res = await api.get<{ data: SchoolClass[] }>('/classes')
      setClasses(res.data.data.filter((c) => c.is_active))
    })()
  }, [hasRole])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setFather(emptyParentForm())
    setMother(emptyParentForm())
    setError('')
    setModalOpen(true)
  }

  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({
      first_name: s.first_name,
      middle_name: s.middle_name ?? '',
      last_name: s.last_name,
      email: s.user?.email ?? '',
      system_email: s.user?.system_email ?? '',
      date_of_birth: s.date_of_birth ?? '',
      gender: s.gender ?? '',
      nationality: s.nationality ?? '',
      address: '',
      enrollment_date: s.enrollment_date ?? '',
      class_id: s.class_id ? String(s.class_id) : '',
      emergency_contact_name: s.emergency_contact_name ?? '',
      emergency_contact_relationship: s.emergency_contact_relationship ?? '',
      emergency_contact_phone: s.emergency_contact_phone ?? '',
    })
    setFather(emptyParentForm())
    setMother(emptyParentForm())
    setError('')
    setModalOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      first_name: form.first_name,
      middle_name: form.middle_name || undefined,
      last_name: form.last_name,
      email: form.email || undefined,
      system_email: form.system_email || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      nationality: form.nationality || undefined,
      enrollment_date: form.enrollment_date || undefined,
      class_id: form.class_id ? Number(form.class_id) : undefined,
      emergency_contact_name: form.emergency_contact_name || undefined,
      emergency_contact_relationship: form.emergency_contact_relationship || undefined,
      emergency_contact_phone: form.emergency_contact_phone || undefined,
      father: buildParentPayload(father),
      mother: buildParentPayload(mother),
    }
    try {
      if (editing) {
        await api.put(`/students/${editing.id}`, payload)
      } else {
        await api.post('/students', payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const archive = async (s: Student) => {
    try {
      await api.post(`/students/${s.id}/archive`)
      await load()
      toast.success(t('students.archived', { name: s.full_name }), {
        label: t('common.undo'),
        onClick: () => void restore(s),
      })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const restore = async (s: Student) => {
    try {
      await api.post(`/students/${s.id}/restore`)
      await load()
      toast.success(t('students.restored', { name: s.full_name }))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const openAssign = (s: Student) => {
    setAssignModal({ student: s, class_id: s.class_id ? String(s.class_id) : '' })
    setAssignError('')
  }

  const submitAssign = async () => {
    if (!assignModal || !assignModal.class_id) return
    setAssigning(true)
    setAssignError('')
    try {
      await api.post(`/students/${assignModal.student.id}/assign-class`, { class_id: Number(assignModal.class_id) })
      setAssignModal(null)
      await load()
    } catch (err) {
      setAssignError(errorMessage(err))
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('students.title')}
        actions={
          hasRole('admin') ? (
            <Button onClick={openAdd}>{t('students.addStudent')}</Button>
          ) : undefined
        }
      />
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="max-w-sm"
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="w-44"
          >
            <option value="">{t('students.statusAll')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="archived">{t('common.archived')}</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : students.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <Card>
          <Table
            headers={[t('students.studentNumber'), t('students.fullName'), t('students.class'), t('students.gender'), t('students.status'), t('common.actions')]}
          >
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.student_number}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{s.class ? localizedName(s.class) : t('students.noClass')}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{s.gender ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge color={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {hasRole('admin') && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(s)}>
                          {t('common.edit')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => openAssign(s)}>
                          {t('students.assignClass')}
                        </Button>
                        {s.status === 'active' ? (
                          <Button variant="danger" size="sm" onClick={() => void archive(s)}>
                            {t('common.archive')}
                          </Button>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => void restore(s)}>
                            {t('students.restoreStudent')}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('students.editStudent') : t('students.addStudent')} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void submit(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('students.firstName')} required>
            <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          </Field>
          <Field label={t('students.lastName')} required>
            <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          </Field>
          <Field label={t('students.middleName')}>
            <Input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
          </Field>
          <Field label={t('students.systemEmail')}>
            <Input type="text" value={form.system_email} onChange={(e) => setForm({ ...form, system_email: e.target.value })} placeholder={t('students.systemEmailHint')} />
          </Field>
          <Field label={t('students.realEmail')} error={studentEmailConflict}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('students.realEmailHint')} />
          </Field>
          <Field label={t('students.dob')}>
            <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </Field>
          <Field label={t('students.gender')}>
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              <option value="male">{t('students.male')}</option>
              <option value="female">{t('students.female')}</option>
            </Select>
          </Field>
          <Field label={t('students.class')}>
            <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
              <option value="">{t('students.noClass')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {localizedName(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('students.enrollmentDate')}>
            <Input type="date" value={form.enrollment_date} onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })} />
          </Field>
          <Field label={t('students.nationality')}>
            <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          </Field>
          <Field label={t('students.emergencyContactName')}>
            <Input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} />
          </Field>
          <Field label={t('students.emergencyContactRelationship')}>
            <Input value={form.emergency_contact_relationship} onChange={(e) => setForm({ ...form, emergency_contact_relationship: e.target.value })} />
          </Field>
          <Field label={t('students.emergencyContactPhone')}>
            <Input value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
          </Field>
          {!editing && (
            <>
              <div className="col-span-full border-t border-gray-100 pt-4">
                <h4 className="mb-3 text-sm font-semibold text-gray-600">{t('students.fatherInfo')}</h4>
              </div>
              <ParentSection role="father" title={t('students.fatherInfo')} value={father} onChange={setFather} />
              <div className="col-span-full border-t border-gray-100 pt-4">
                <h4 className="mb-3 text-sm font-semibold text-gray-600">{t('students.motherInfo')}</h4>
              </div>
              <ParentSection role="mother" title={t('students.motherInfo')} value={mother} onChange={setMother} />
            </>
          )}
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

      <Modal open={assignModal !== null} onClose={() => setAssignModal(null)} title={`${t('students.assignClass')} — ${assignModal?.student.full_name ?? ''}`}>
        {assignError && <div className="mb-4"><Alert type="error">{assignError}</Alert></div>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitAssign()
          }}
        >
          <Field label={t('students.class')} required>
            <Select
              value={assignModal?.class_id ?? ''}
              onChange={(e) => setAssignModal((m) => (m ? { ...m, class_id: e.target.value } : m))}
              required
            >
              <option value="">{t('students.noClass')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {localizedName(c)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setAssignModal(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={assigning}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
