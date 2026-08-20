import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, listMeta, unwrapList } from '../lib/api'
import type { User } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner, Table } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'

type Form = {
  name: string
  system_email: string
  email: string
  phone: string
  role: string
}

const emptyForm: Form = { name: '', system_email: '', email: '', phone: '', role: 'admin' }

export default function UsersPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [archiveConfirm, setArchiveConfirm] = useState<User | null>(null)
  const [resendConfirm, setResendConfirm] = useState<User | null>(null)

  const load = useCallback(async () => {
    if (items.length === 0) setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/users', {
        params: {
          per_page: 25,
          page,
          search: search || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        },
      })
      setItems(unwrapList<User>(res.data))
      const meta = listMeta(res.data)
      setLastPage(meta.last_page)
      setTotal(meta.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (user: User) => {
    setEditing(user)
    setForm({
      name: user.name,
      system_email: user.system_email ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.roles?.[0]?.name ?? 'admin',
    })
    setError('')
    setModalOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    if (!form.system_email.endsWith('@cove.school')) {
      setError(t('users.systemEmailDomain'))
      setSaving(false)
      return
    }
    const realDomain = form.email.split('@')[1]?.toLowerCase() ?? ''
    const knownDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'live.com', 'msn.com', 'aol.com', 'protonmail.com', 'proton.me', 'zoho.com', 'mail.com']
    if (!knownDomains.includes(realDomain)) {
      setError(t('users.invalidEmailDomain'))
      setSaving(false)
      return
    }
    try {
      const payload = {
        name: form.name,
        system_email: form.system_email,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
      }
      if (editing) {
        await api.put(`/users/${editing.id}`, payload)
      } else {
        await api.post('/users', payload)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const archiveUser = async () => {
    if (!archiveConfirm) return
    setError('')
    try {
      await api.post(`/users/${archiveConfirm.id}/archive`)
      setArchiveConfirm(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const restoreUser = async (user: User) => {
    setError('')
    try {
      await api.post(`/users/${user.id}/restore`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const resendActivation = async () => {
    if (!resendConfirm) return
    setError('')
    try {
      await api.post(`/users/${resendConfirm.id}/resend-activation`)
      setResendConfirm(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const userStatus = (s: string) => (s === 'active' ? 'green' : s === 'invited' ? 'amber' : 'red')
  const roleBadge = (r: string) => (r === 'super_admin' ? 'purple' : r === 'admin' ? 'indigo' : r === 'teacher' ? 'blue' : 'gray')

  const canEdit = (user: User) => !user.roles?.some((r) => r.name === 'super_admin')

  return (
    <div>
      <PageHeader title={t('users.title')} actions={<Button onClick={openAdd}>{t('users.addUser')}</Button>} />

      {error && (
        <div className="mb-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <Input
          placeholder={t('users.search')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-md"
        />
        <Select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="w-44"
        >
          <option value="">{t('common.all')}</option>
          <option value="admin">{t('users.admin')}</option>
          <option value="teacher">{t('users.teacher')}</option>
          <option value="accountant">{t('users.accountant')}</option>
          <option value="student">{t('users.student')}</option>
          <option value="parent">{t('users.parent')}</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="w-44"
        >
          <option value="">{t('users.statusAll')}</option>
          <option value="active">{t('common.active')}</option>
          <option value="invited">{t('users.invited')}</option>
          <option value="suspended">{t('common.archived')}</option>
        </Select>
      </Card>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <>
          <Card>
            <Table
              headers={[t('users.userId'), t('users.systemEmail'), t('users.role'), t('users.status'), t('users.created'), t('common.actions')]}
            >
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">#{u.id}</td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{u.system_email}</td>
                  <td className="px-4 py-3">
                    <Badge color={roleBadge(u.roles?.[0]?.name ?? '')}>
                      {t(`users.${u.roles?.[0]?.name ?? 'admin'}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={userStatus(u.status)}>{t(`users.${u.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {canEdit(u) && (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>
                          {t('common.edit')}
                        </Button>
                        {u.status === 'active' && (
                          <Button variant="danger" size="sm" onClick={() => setArchiveConfirm(u)}>
                            {t('common.archive')}
                          </Button>
                        )}
                        {u.status === 'suspended' && (
                          <Button variant="success" size="sm" onClick={() => void restoreUser(u)}>
                            {t('common.restore')}
                          </Button>
                        )}
                        {(u.status === 'invited' || !u.activated_at) && (
                          <Button variant="secondary" size="sm" onClick={() => setResendConfirm(u)}>
                            {t('users.resendActivation')}
                          </Button>
                        )}
                      </div>
                    )}
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

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('users.editUser') : t('users.addUser')}>
        {error && (
          <div className="mb-4">
            <Alert type="error">{error}</Alert>
          </div>
        )}
        <form onSubmit={(e) => void submit(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-full">
            <Field label={t('users.name')} required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
          </div>
          <Field label={t('users.systemEmail')} required>
            <Input type="email" value={form.system_email} onChange={(e) => setForm({ ...form, system_email: e.target.value })} required />
          </Field>
          <Field label={t('users.email')} required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label={t('users.phone')}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '') })} />
          </Field>
          <Field label={t('users.role')} required>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">{t('users.admin')}</option>
              <option value="teacher">{t('users.teacher')}</option>
              <option value="accountant">{t('users.accountant')}</option>
            </Select>
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

      {/* Archive Confirmation */}
      <Modal open={archiveConfirm !== null} onClose={() => setArchiveConfirm(null)} title={t('common.archive')} centered>
        <p className="text-sm text-gray-600">
          {t('common.confirm')} <strong>{archiveConfirm?.name}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setArchiveConfirm(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={() => void archiveUser()}>
            {t('common.archive')}
          </Button>
        </div>
      </Modal>

      {/* Resend Activation Confirmation */}
      <Modal open={resendConfirm !== null} onClose={() => setResendConfirm(null)} title={t('users.resendActivation')} centered>
        <p className="text-sm text-gray-600">
          {t('users.resendActivation')} <strong>{resendConfirm?.system_email}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResendConfirm(null)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void resendActivation()}>
            {t('users.resendActivation')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
