import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, listMeta, unwrapList } from '../lib/api'
import type { Teacher } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner, Table } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'
import { useToast } from '../components/Toast'

interface TeacherForm {
  name: string
  email: string
  phone: string
  qualification: string
  joining_date: string
  address: string
}

const emptyForm: TeacherForm = { name: '', email: '', phone: '', qualification: '', joining_date: '', address: '' }

export default function TeachersPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState<TeacherForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/teachers', { params: { per_page: 25, page, status: status || undefined } })
      setTeachers(unwrapList<Teacher>(res.data))
      const meta = listMeta(res.data)
      setLastPage(meta.last_page)
      setTotal(meta.total)
    } catch {
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    void load()
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher)
    setForm({
      name: teacher.user?.name ?? '',
      email: teacher.user?.system_email ?? teacher.user?.email ?? '',
      phone: teacher.user?.phone ?? '',
      qualification: teacher.qualification ?? '',
      joining_date: teacher.joining_date ?? '',
      address: '',
    })
    setError('')
    setModalOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || undefined,
      qualification: form.qualification || undefined,
      joining_date: form.joining_date || undefined,
      address: form.address || undefined,
    }
    try {
      if (editing) {
        await api.put(`/teachers/${editing.id}`, payload)
      } else {
        await api.post('/teachers', payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const archive = async (teacher: Teacher) => {
    try {
      await api.post(`/teachers/${teacher.id}/archive`)
      await load()
      toast.success(t('teachers.archived', { name: teacher.user?.name }), {
        label: t('common.undo'),
        onClick: () => void restore(teacher),
      })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const restore = async (teacher: Teacher) => {
    try {
      await api.post(`/teachers/${teacher.id}/restore`)
      await load()
      toast.success(t('teachers.restored', { name: teacher.user?.name }))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('teachers.title')}
        actions={<Button onClick={openAdd}>{t('teachers.addTeacher')}</Button>}
      />

      <Card className="mb-4 p-3">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="w-44"
        >
          <option value="">{t('teachers.statusAll')}</option>
          <option value="active">{t('common.active')}</option>
          <option value="archived">{t('common.archived')}</option>
        </Select>
      </Card>

      {loading ? (
        <Spinner />
      ) : teachers.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <Card>
          <Table
            headers={[t('teachers.name'), t('teachers.email'), t('teachers.phone'), t('teachers.employeeId'), t('teachers.qualification'), t('common.status'), t('common.actions')]}
          >
            {teachers.map((teacher) => (
              <tr key={teacher.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{teacher.user?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{teacher.user?.system_email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{teacher.user?.phone ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{teacher.employee_id ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{teacher.qualification ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge color={teacher.status === 'active' ? 'green' : 'gray'}>{teacher.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(teacher)}>
                      {t('common.edit')}
                    </Button>
                    {teacher.status === 'active' ? (
                      <Button variant="danger" size="sm" onClick={() => void archive(teacher)}>
                        {t('common.archive')}
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => void restore(teacher)}>
                        {t('teachers.restoreTeacher')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('teachers.editTeacher') : t('teachers.addTeacher')}>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void submit(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('teachers.name')} required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label={t('teachers.email')} required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label={t('teachers.phone')}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={t('teachers.qualification')}>
            <Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} />
          </Field>
          <Field label={t('teachers.joiningDate')}>
            <Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
          </Field>
          <div className="col-span-full">
            <Field label={t('teachers.address')}>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
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
