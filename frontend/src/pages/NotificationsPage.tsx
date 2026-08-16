import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { api, errorMessage, listMeta, unwrapList } from '../lib/api'
import { formatDateTime } from '../lib/format'
import type { AppNotification } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner } from '../components/ui'

export default function NotificationsPage() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ data: unknown }>('/notifications', { params: { per_page: 20, page } })
      setNotifications(unwrapList<AppNotification>(res.data))
      const meta = listMeta(res.data)
      setLastPage(meta.last_page)
      setTotal(meta.total)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all', {})
      setNotifications(notifications.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const open = async (n: AppNotification) => {
    try {
      await api.post(`/notifications/${n.id}/read`, {})
    } catch {
      // ignore
    }
    setNotifications(notifications.map((x) => (x.id === n.id ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x)))
    if (n.action_url) window.location.href = n.action_url
  }

  return (
    <div>
      <PageHeader
        title={t('notifications.title')}
        actions={
          notifications.some((n) => !n.read_at) ? (
            <Button variant="secondary" onClick={() => void markAll()}>
              {t('notifications.markAllRead')}
            </Button>
          ) : undefined
        }
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Spinner />
      ) : notifications.length === 0 ? (
        <EmptyState message={t('notifications.empty')} />
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map((n) => (
              <Card key={n.id} className={`p-4 ${n.read_at ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800">{n.title}</p>
                    {n.body && <p className="mt-1 text-sm text-gray-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!n.read_at && <Badge color="blue">{t('notifications.unread')}</Badge>}
                    {n.action_url ? (
                      <Link to={n.action_url}>
                        <Button size="sm" onClick={() => void open(n)}>
                          {t('common.view')}
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void open(n)}>
                        {t('common.view')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
