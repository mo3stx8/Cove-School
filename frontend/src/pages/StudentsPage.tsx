import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, listMeta, unwrapList } from '../lib/api'
import type { SchoolClass, Student } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner, Table } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'

interface StudentForm {
  first_name: string
  middle_name: string
  last_name: string
  email: string
  date_of_birth: string
  gender: string
  nationality: string
  address: string
  enrollment_date: string
  class_id: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
  guardian_name: string
  guardian_phone: string
  guardian_email: string
  guardian_relationship: string
}

const emptyForm: StudentForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  email: '',
  date_of_birth: '',
  gender: '',
  nationality: '',
  address: '',
  enrollment_date: '',
  class_id: '',
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_phone: '',
  guardian_name: '',
  guardian_phone: '',
  guardian_email: '',
  guardian_relationship: '',
}

export default function StudentsPage() {
  const { t } = useTranslation()
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/students', { params: { per_page: 25, page, search: search || undefined } })
      setStudents(unwrapList<Student>(res.data))
      const meta = listMeta(res.data)
      setLastPage(meta.last_page)
      setTotal(meta.total)
    } catch {
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

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
      date_of_birth: s.date_of_birth ?? '',
      gender: s.gender ?? '',
      nationality: s.nationality ?? '',
      address: '',
      enrollment_date: s.enrollment_date ?? '',
      class_id: s.class_id ? String(s.class_id) : '',
      emergency_contact_name: s.emergency_contact_name ?? '',
      emergency_contact_relationship: s.emergency_contact_relationship ?? '',
      emergency_contact_phone: s.emergency_contact_phone ?? '',
      guardian_name: s.guardians?.[0]?.name ?? '',
      guardian_phone: s.guardians?.[0]?.phone ?? '',
      guardian_email: s.guardians?.[0]?.email ?? '',
      guardian_relationship: s.guardians?.[0]?.relationship ?? '',
    })
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
      date_of_birth: form.date_of_birth || undefined,
      gender: form.gender || undefined,
      nationality: form.nationality || undefined,
      enrollment_date: form.enrollment_date || undefined,
      class_id: form.class_id ? Number(form.class_id) : undefined,
      emergency_contact_name: form.emergency_contact_name || undefined,
      emergency_contact_relationship: form.emergency_contact_relationship || undefined,
      emergency_contact_phone: form.emergency_contact_phone || undefined,
      guardian: {
        guardian_name: form.guardian_name || undefined,
        phone: form.guardian_phone || undefined,
        email: form.guardian_email || undefined,
        relationship: form.guardian_relationship || undefined,
      },
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
    if (!confirm(`Archive ${s.full_name}?`)) return
    try {
      await api.post(`/students/${s.id}/archive`)
      await load()
    } catch {
      // ignore
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
        <Input
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
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
                <td className="px-4 py-3 text-gray-600">{s.class?.name ?? t('students.noClass')}</td>
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
                        {s.status === 'active' && (
                          <Button variant="danger" size="sm" onClick={() => void archive(s)}>
                            {t('common.archive')}
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
          <Field label={t('students.email')}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
                  {c.name}
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
          <Field label={t('students.emergencyContact')}>
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
                <h4 className="mb-3 text-sm font-semibold text-gray-600">{t('students.guardian')}</h4>
              </div>
              <Field label={t('students.guardianName')}>
                <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
              </Field>
              <Field label={t('students.guardianRelationship')}>
                <Input value={form.guardian_relationship} onChange={(e) => setForm({ ...form, guardian_relationship: e.target.value })} />
              </Field>
              <Field label={t('students.guardianPhone')}>
                <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} />
              </Field>
              <Field label={t('students.guardianEmail')}>
                <Input type="email" value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} />
              </Field>
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
    </div>
  )
}
