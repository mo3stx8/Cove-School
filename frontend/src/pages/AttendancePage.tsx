import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../lib/api'
import { localizedName } from '../lib/format'
import type { AttendanceRow, AttendanceStatus, SchoolClass } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { Field, Input, Modal, Select, Textarea } from '../components/form'

interface AttendanceCorrection {
  id: number
  status: string
  new_status: string
  reason: string
  created_at: string
  student_name?: string
  requester?: { id: number; name: string }
  record?: { id: number; student?: { id: number; full_name: string } }
}

interface CorrectionRequest {
  record_id: number
  student: string
  new_status: AttendanceStatus
  reason: string
}

export default function AttendancePage() {
  const { t } = useTranslation()
  const { hasRole } = useAuth()
  const [searchParams] = useSearchParams()
  const urlClass = searchParams.get('class_id')
  const urlDate = searchParams.get('date')
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(() => (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : new Date().toISOString().slice(0, 10)))
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const savedTimer = useRef<number | null>(null)

  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([])
  const [corrOpen, setCorrOpen] = useState(false)

  const [corrReq, setCorrReq] = useState<CorrectionRequest | null>(null)
  const [corrReqSaving, setCorrReqSaving] = useState(false)

  const isAdmin = hasRole('admin')
  const today = new Date().toISOString().slice(0, 10)
  const isPast = date < today
  const canEdit = isAdmin || !isPast

  const flashSaved = () => {
    setSaved(true)
    if (savedTimer.current) window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaved(false), 4000)
  }

  useEffect(() => {
    void (async () => {
      const res = await api.get<{ data: SchoolClass[] }>('/classes')
      const all = res.data.data
      setClasses(all)
      const target = urlClass ? all.find((c) => String(c.id) === urlClass) : undefined
      const active = target ?? all.find((c) => c.is_active)
      if (active) setClassId(String(active.id))
    })()
  }, [urlClass])

  const gridLoaded = useRef(false)

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

  useEffect(() => {
    if (classes.length > 0 && classId && date && !gridLoaded.current) {
      gridLoaded.current = true
      void loadGrid()
    }
  }, [classes, classId, date, loadGrid])

  const takeAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classId || !date || !canEdit) return
    setLoading(true)
    setError('')
    try {
      const records = Object.fromEntries(rows.map((r) => [r.student_id, r.status ?? 'present']))
      await api.post(`/classes/${classId}/attendance`, { date, records })
      await loadGrid()
      flashSaved()
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

  const openRequest = (row: AttendanceRow) => {
    if (!row.record_id) return
    setError('')
    setCorrReq({
      record_id: row.record_id,
      student: row.name,
      new_status: (row.status ?? 'present') as AttendanceStatus,
      reason: '',
    })
  }

  const submitRequest = async () => {
    if (!corrReq) return
    setCorrReqSaving(true)
    setError('')
    try {
      await api.post(`/attendance/records/${corrReq.record_id}/correction`, {
        new_status: corrReq.new_status,
        reason: corrReq.reason,
      })
      setCorrReq(null)
      flashSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCorrReqSaving(false)
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

      <div className="mb-4">
        <Alert type="info">
          <p className="font-medium">{t('attendance.rulesTitle')}</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
            <li>{t('attendance.rulesToday')}</li>
            <li>{t('attendance.rulesPast')}</li>
            <li>{t('attendance.rulesCorrection')}</li>
          </ul>
        </Alert>
      </div>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-64">
            <Field label={t('attendance.class')}>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">—</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localizedName(c)}
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
      {saved && <div className="mb-4"><Alert type="success">{t('attendance.saved')}</Alert></div>}

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <Card>
          {isPast && !isAdmin && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {t('attendance.pastReadonly')}
            </div>
          )}
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
                          <Badge color={statusColor(row.status)}>{t(`attendance.${row.status}`)}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <div className="flex gap-1.5">
                            {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => setRows(rows.map((r) => (r.student_id === row.student_id ? { ...r, status } : r)))}
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
                        ) : (
                          <Button variant="secondary" size="sm" disabled={!row.record_id} onClick={() => openRequest(row)}>
                            {t('attendance.requestCorrection')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="flex justify-end border-t border-gray-200 px-4 py-3">
                <Button type="submit" loading={loading}>
                  {t('attendance.saveAttendance')}
                </Button>
              </div>
            )}
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
                  <p className="text-sm font-medium text-gray-800">{c.student_name ?? c.record?.student?.full_name ?? `#${c.record?.id ?? ''}`}</p>
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

      <Modal
        open={corrReq !== null}
        onClose={() => setCorrReq(null)}
        title={`${t('attendance.requestCorrection')} — ${corrReq?.student ?? ''}`}
      >
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitRequest()
          }}
          className="space-y-4"
        >
          <Field label={t('attendance.newStatus')} required>
            <Select
              value={corrReq?.new_status ?? 'present'}
              onChange={(e) => setCorrReq((m) => (m ? { ...m, new_status: e.target.value as AttendanceStatus } : m))}
              required
            >
              {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(`attendance.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('attendance.reason')} required>
            <Textarea
              value={corrReq?.reason ?? ''}
              onChange={(e) => setCorrReq((m) => (m ? { ...m, reason: e.target.value } : m))}
              required
              placeholder={t('attendance.reasonPlaceholder')}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCorrReq(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={corrReqSaving}>
              {t('common.submit')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
