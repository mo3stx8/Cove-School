import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../lib/api'
import type { AttendanceRow, SchoolClass } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'

interface AttendanceCorrection {
  id: number
  status: string
  new_status: string
  reason: string
  created_at: string
  requester?: { id: number; name: string }
  record?: { id: number; student?: { id: number; full_name: string } }
}

export default function AttendancePage() {
  const { t } = useTranslation()
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([])
  const [corrOpen, setCorrOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ data: SchoolClass[] }>('/classes')
      setClasses(res.data.data)
      const active = res.data.data.find((c) => c.is_active)
      if (active) setClassId(String(active.id))
    })()
  }, [])

  const loadGrid = useCallback(async () => {
    if (!classId || !date) return
    setLoading(true)
    setSaved(false)
    setError('')
    try {
      const res = await api.get<{ data: AttendanceRow[] }>(`/classes/${classId}/attendance`, { params: { date } })
      setRows(res.data.data.map((r) => ({ ...r, status: r.status ?? 'present' })))
    } catch (err) {
      setError(errorMessage(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [classId, date])

  const takeAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classId || !date) return
    setLoading(true)
    setError('')
    try {
      const records = Object.fromEntries(rows.map((r) => [r.student_id, r.status ?? 'present']))
      await api.post(`/classes/${classId}/attendance`, { date, records })
      await loadGrid()
      setSaved(true)
      await loadGrid()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const openCorrections = async () => {
    setError('')
    setCorrOpen(true)
    try {
      const res = await api.get<{ data: unknown }>('/attendance/corrections', { params: { per_page: 100 } })
      const inner = res.data.data as { data?: AttendanceCorrection[] } | AttendanceCorrection[]
      setCorrections(Array.isArray(inner) ? inner : (inner as { data: AttendanceCorrection[] }).data)
    } catch (err) {
      setError(errorMessage(err))
      setCorrections([])
    }
  }

  const reviewCorrection = async (correction: AttendanceCorrection, approve: boolean) => {
    setError('')
    try {
      await api.post(`/attendance/corrections/${correction.id}/review`, { approve })
      setCorrections(corrections.filter((c) => c.id !== correction.id))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const statusColor = (s: string | null) => (s === 'present' ? 'green' : s === 'absent' ? 'red' : s === 'late' ? 'amber' : s === 'excused' ? 'blue' : 'gray')

  return (
    <div>
      <PageHeader
        title={t('attendance.title')}
        actions={
          <Button variant="secondary" onClick={() => void openCorrections()}>
            {t('attendance.corrections')}
          </Button>
        }
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Field label={t('attendance.class')}>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">—</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-56">
            <Field label={t('attendance.date')}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Button onClick={() => void loadGrid()}>{t('common.refresh')}</Button>
        </div>
      </Card>

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
      {saved && <div className="mb-4"><Alert type="success">{t('common.save')} ✓</Alert></div>}

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <Card>
          <form onSubmit={(e) => void takeAttendance(e)}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[t('students.studentNumber'), t('students.fullName'), t('attendance.status'), t('common.actions')].map((h) => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((row) => (
                    <tr key={row.student_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.student_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3">
                        {row.status ? (
                          <Badge color={statusColor(row.status)}>{row.status}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          {['present', 'absent', 'late', 'excused'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setRows(rows.map((r) => (r.student_id === row.student_id ? { ...r, status: status as AttendanceRow['status'] } : r)))}
                              className={
                                'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                                (row.status === status
                                  ? status === 'present'
                                    ? 'bg-emerald-600 text-white'
                                    : status === 'absent'
                                      ? 'bg-red-600 text-white'
                                      : status === 'late'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                              }
                            >
                              {t(`attendance.${status}`)}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-gray-200 px-4 py-3">
              <Button type="submit" loading={loading}>
                {t('attendance.saveAttendance')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Modal open={corrOpen} onClose={() => setCorrOpen(false)} title={t('attendance.corrections')} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        {corrections.length === 0 ? (
          <EmptyState message={t('common.noData')} />
        ) : (
          <ul className="space-y-2">
            {corrections.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.record?.student?.full_name ?? `#${c.record?.id ?? ''}`}</p>
                  <p className="text-xs text-gray-500">
                    {t('attendance.newStatus')}: <Badge color={statusColor(c.new_status)}>{c.new_status}</Badge> · {c.reason}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="success" size="sm" onClick={() => void reviewCorrection(c, true)}>
                    {t('attendance.approve')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void reviewCorrection(c, false)}>
                    {t('attendance.reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
