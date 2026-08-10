import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, unwrapList } from '../lib/api'
import type { Announcement, SchoolClass } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { Field, Input, Modal, Select, Textarea } from '../components/form'

export default function AnnouncementsPage() {
  const { t } = useTranslation()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', audience: 'everyone', class_id: '', expires_at: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/announcements', { params: { per_page: 25 } })
      setAnnouncements(unwrapList<Announcement>(res.data))
    } catch {
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ data: SchoolClass[] }>('/classes').catch(() => ({ data: { data: [] as SchoolClass[] } }))
      setClasses(res.data.data)
    })()
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/announcements', {
        title: form.title,
        body: form.body,
        audience: form.audience,
        class_id: form.audience === 'class' && form.class_id ? Number(form.class_id) : undefined,
        expires_at: form.expires_at || undefined,
      })
      setCreateOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const audienceColor = (a: string) => (a === 'everyone' ? 'green' : a === 'teachers' ? 'blue' : a === 'students' ? 'purple' : a === 'parents' ? 'amber' : 'indigo')

  return (
    <div>
      <PageHeader title={t('announcements.title')} actions={<Button onClick={() => setCreateOpen(true)}>{t('announcements.add')}</Button>} />

      {loading ? (
        <Spinner />
      ) : announcements.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{a.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {a.author?.name ?? '—'} · {a.created_at}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={audienceColor(a.audience)}>{a.audience === 'class' ? `${t('announcements.class')} ${a.class_id ?? ''}` : t(`announcements.${a.audience}`)}</Badge>
                  {a.status === 'draft' ? <Badge color="gray">{a.status}</Badge> : <Badge color="green">{t('common.active')}</Badge>}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{a.body}</p>
              {a.expires_at && <p className="mt-2 text-xs text-gray-400">{t('announcements.expiresAt')}: {a.expires_at}</p>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('announcements.add')} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void create(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-full">
            <Field label={t('announcements.announcementTitle')} required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </Field>
          </div>
          <div className="col-span-full">
            <Field label={t('announcements.body')} required>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </Field>
          </div>
          <Field label={t('announcements.audience')} required>
            <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="everyone">{t('announcements.everyone')}</option>
              <option value="teachers">{t('announcements.teachers')}</option>
              <option value="students">{t('announcements.students')}</option>
              <option value="parents">{t('announcements.parents')}</option>
              <option value="class">{t('announcements.class')}</option>
            </Select>
          </Field>
          {form.audience === 'class' ? (
            <Field label={t('announcements.class')} required>
              <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
                <option value="">—</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label={t('announcements.expires')}>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </Field>
          )}
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
    </div>
  )
}
