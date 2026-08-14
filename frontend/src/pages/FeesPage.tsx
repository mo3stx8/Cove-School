import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, errorMessage, listMeta, saveBlob, unwrapList } from '../lib/api'
import type { AcademicYear, FeePayment, FeeType, Invoice, Student, Term } from '../lib/types'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Pagination, Spinner, Table } from '../components/ui'
import { Field, Input, Modal, Select } from '../components/form'

type Section = 'invoices' | 'payments' | 'feeTypes'

export default function FeesPage() {
  const { t } = useTranslation()
  const [section, setSection] = useState<Section>('invoices')

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invPage, setInvPage] = useState(1)
  const [invLastPage, setInvLastPage] = useState(1)
  const [invTotal, setInvTotal] = useState(0)

  const [payments, setPayments] = useState<FeePayment[]>([])
  const [payPage, setPayPage] = useState(1)
  const [payLastPage, setPayLastPage] = useState(1)
  const [paySearch, setPaySearch] = useState('')

  const [feeTypes, setFeeTypes] = useState<FeeType[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [years, setYears] = useState<AcademicYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)

  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState({ student_id: '', fee_type_id: '', academic_year_id: '', term_id: '', title: '', amount: '', discount_amount: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [feeTypeOpen, setFeeTypeOpen] = useState(false)
  const [feeTypeEditing, setFeeTypeEditing] = useState<FeeType | null>(null)
  const [feeTypeForm, setFeeTypeForm] = useState({ name: '', code: '', amount: '', frequency: 'term', description: '', is_active: true })

  const [payFor, setPayFor] = useState<Invoice | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'cash', reference: '', notes: '' })
  const [paySaving, setPaySaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inv, ft] = await Promise.all([
        api.get<{ data: unknown }>('/invoices', { params: { per_page: 25, page: invPage } }),
        api.get<{ data: FeeType[] }>('/fee-types'),
      ])
      setInvoices(unwrapList<Invoice>(inv.data))
      const meta = listMeta(inv.data)
      setInvLastPage(meta.last_page)
      setInvTotal(meta.total)
      setFeeTypes(ft.data.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [invPage])

  useEffect(() => {
    void load()
  }, [load])

  const loadPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: unknown }>('/payments', { params: { per_page: 25, page: payPage, search: paySearch || undefined } })
      setPayments(unwrapList<FeePayment>(res.data))
      const meta = listMeta(res.data)
      setPayLastPage(meta.last_page)
    } catch {
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [payPage, paySearch])

  useEffect(() => {
    if (section === 'payments') void loadPayments()
  }, [section, loadPayments])

  useEffect(() => {
    void (async () => {
      const [st, y] = await Promise.all([
        api.get<{ data: unknown }>('/students', { params: { per_page: 500 } }).catch(() => ({ data: { data: [] as unknown } })),
        api.get<{ data: AcademicYear[] }>('/academic-years'),
      ])
      setStudents(unwrapList<Student>(st.data as { data: unknown }))
      setYears(y.data.data)
    })()
  }, [])

  const loadTerms = async (yearId: string) => {
    if (!yearId) {
      setTerms([])
      return
    }
    try {
      const res = await api.get<{ data: Term[] }>(`/academic-years/${yearId}/terms`)
      setTerms(res.data.data)
    } catch {
      setTerms([])
    }
  }

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.post('/invoices', {
        student_id: Number(invoiceForm.student_id),
        fee_type_id: invoiceForm.fee_type_id ? Number(invoiceForm.fee_type_id) : undefined,
        academic_year_id: invoiceForm.academic_year_id ? Number(invoiceForm.academic_year_id) : undefined,
        term_id: invoiceForm.term_id ? Number(invoiceForm.term_id) : undefined,
        title: invoiceForm.title,
        amount: Number(invoiceForm.amount),
        discount_amount: invoiceForm.discount_amount ? Number(invoiceForm.discount_amount) : 0,
        due_date: invoiceForm.due_date || undefined,
      })
      setInvoiceOpen(false)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openFeeType = (ft?: FeeType) => {
    setFeeTypeEditing(ft ?? null)
    setFeeTypeForm(
      ft
        ? { name: ft.name, code: ft.code ?? '', amount: String(ft.amount), frequency: ft.frequency, description: ft.description ?? '', is_active: Boolean(ft.is_active) }
        : { name: '', code: '', amount: '', frequency: 'term', description: '', is_active: true },
    )
    setError('')
    setFeeTypeOpen(true)
  }

  const saveFeeType = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: feeTypeForm.name,
        code: feeTypeForm.code || undefined,
        amount: Number(feeTypeForm.amount),
        frequency: feeTypeForm.frequency,
        description: feeTypeForm.description || undefined,
        is_active: feeTypeForm.is_active,
      }
      if (feeTypeEditing) {
        await api.put(`/fee-types/${feeTypeEditing.id}`, payload)
      } else {
        await api.post('/fee-types', payload)
      }
      setFeeTypeOpen(false)
      setFeeTypeEditing(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openPay = (invoice: Invoice) => {
    setError('')
    setPayFor(invoice)
    setPayForm({ amount: String(invoice.amount - (invoice.discount_amount ?? 0)), payment_method: 'cash', reference: '', notes: '' })
  }

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payFor) return
    setPaySaving(true)
    setError('')
    try {
      await api.post(`/invoices/${payFor.id}/pay`, {
        amount: Number(payForm.amount),
        payment_method: payForm.payment_method,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined,
      })
      setPayFor(null)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPaySaving(false)
    }
  }

  const receiptPdf = async (payment: FeePayment) => {
    try {
      const res = await api.get(`/payments/${payment.id}/receipt.pdf`, { responseType: 'blob' })
      saveBlob(res.data, `receipt-${payment.receipt_number}.pdf`)
    } catch (err) {
      alert(errorMessage(err))
    }
  }

  const invoiceStatus = (s: string) => (s === 'paid' ? 'green' : s === 'partial' ? 'blue' : s === 'overdue' ? 'red' : s === 'cancelled' ? 'gray' : 'amber')

  return (
    <div>
      <PageHeader
        title={t('fees.title')}
        actions={
          section === 'invoices' ? (
            <Button onClick={() => setInvoiceOpen(true)}>{t('fees.addInvoice')}</Button>
          ) : section === 'feeTypes' ? (
            <Button onClick={() => openFeeType()}>{t('fees.addFeeType')}</Button>
          ) : undefined
        }
        tabs={{
          value: section,
          onChange: (v) => setSection(v as Section),
          items: [
            { key: 'invoices', label: t('fees.invoices') },
            { key: 'payments', label: t('fees.payments') },
            { key: 'feeTypes', label: t('fees.feeTypes') },
          ],
        }}
      />

      {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Spinner />
      ) : section === 'invoices' ? (
        invoices.length === 0 ? (
          <EmptyState message={t('common.noData')} />
        ) : (
          <>
            <Card>
              <Table
                headers={[t('fees.invoiceNumber'), t('fees.student'), t('fees.invoiceTitle'), t('fees.amount'), t('fees.status'), t('common.actions')]}
              >
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{inv.invoice_number}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">
                      {inv.student?.student_number ?? inv.student?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.title}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {inv.amount.toFixed(2)}
                      {inv.discount_amount > 0 && <span className="ml-1 text-xs text-red-500">−{inv.discount_amount.toFixed(2)}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={invoiceStatus(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                        <Button size="sm" onClick={() => openPay(inv)}>
                          {t('fees.addPayment')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
            <div className="mt-4">
              <Pagination page={invPage} lastPage={invLastPage} total={invTotal} onChange={setInvPage} />
            </div>
          </>
        )
      ) : section === 'payments' ? (
        payments.length === 0 ? (
          <EmptyState message={t('common.noData')} />
        ) : (
          <>
            <Card className="mb-4 p-3">
              <Input
                placeholder={t('fees.searchPayments')}
                value={paySearch}
                onChange={(e) => {
                  setPaySearch(e.target.value)
                  setPayPage(1)
                }}
                className="max-w-md"
              />
            </Card>
            <Card>
              <Table
                headers={[t('fees.receiptNumber'), t('fees.student'), t('fees.invoiceNumber'), t('fees.amount'), t('fees.method'), t('fees.paidAt'), t('common.actions')]}
              >
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">{p.receipt_number}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">
                      {p.student?.student_number ?? p.student?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.studentFee?.invoice_number ?? `#${p.student_fee_id}`}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{p.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge color="indigo">{p.payment_method}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(p.paid_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Button variant="secondary" size="sm" onClick={() => void receiptPdf(p)}>
                        {t('fees.receipt')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
            <div className="mt-4">
              <Pagination page={payPage} lastPage={payLastPage} total={0} onChange={setPayPage} />
            </div>
          </>
        )
      ) : feeTypes.length === 0 ? (
        <EmptyState message={t('common.noData')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {feeTypes.map((ft) => (
            <Card key={ft.id} className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{ft.name}</h3>
                <Badge color={ft.is_active ? 'green' : 'gray'}>{ft.is_active ? t('classes.active') : t('common.archived')}</Badge>
              </div>
              <p className="mt-1 font-mono text-sm text-gray-500">{ft.code}</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{Number(ft.amount).toFixed(2)}</p>
              <Badge color="indigo">{ft.frequency}</Badge>
              {ft.description && <p className="mt-2 text-xs text-gray-500">{ft.description}</p>}
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={() => openFeeType(ft)}>
                  {t('common.edit')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} title={t('fees.addInvoice')} wide>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void createInvoice(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('fees.student')} required>
            <Select value={invoiceForm.student_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, student_id: e.target.value })} required>
              <option value="">—</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('fees.feeType')}>
            <Select value={invoiceForm.fee_type_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, fee_type_id: e.target.value })}>
              <option value="">—</option>
              {feeTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('fees.academicYear')}>
            <Select
              value={invoiceForm.academic_year_id}
              onChange={(e) => {
                setInvoiceForm({ ...invoiceForm, academic_year_id: e.target.value })
                void loadTerms(e.target.value)
              }}
            >
              <option value="">—</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('fees.term')}>
            <Select value={invoiceForm.term_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, term_id: e.target.value })}>
              <option value="">—</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="col-span-full">
            <Field label={t('fees.invoiceTitle')} required>
              <Input value={invoiceForm.title} onChange={(e) => setInvoiceForm({ ...invoiceForm, title: e.target.value })} required />
            </Field>
          </div>
          <Field label={t('fees.amount')} required>
            <Input type="number" min={0} step="0.01" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} required />
          </Field>
          <Field label={t('fees.discount')}>
            <Input type="number" min={0} step="0.01" value={invoiceForm.discount_amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, discount_amount: e.target.value })} />
          </Field>
          <Field label={t('fees.dueDate')}>
            <Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
          </Field>
          <div className="col-span-full mt-4 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setInvoiceOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={feeTypeOpen}
        onClose={() => {
          setFeeTypeOpen(false)
          setFeeTypeEditing(null)
        }}
        title={feeTypeEditing ? t('fees.editFeeType') : t('fees.addFeeType')}
      >
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        <form onSubmit={(e) => void saveFeeType(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('fees.name')} required>
            <Input value={feeTypeForm.name} onChange={(e) => setFeeTypeForm({ ...feeTypeForm, name: e.target.value })} required />
          </Field>
          <Field label={t('fees.code')}>
            <Input value={feeTypeForm.code} onChange={(e) => setFeeTypeForm({ ...feeTypeForm, code: e.target.value })} />
          </Field>
          <Field label={t('fees.amount')} required>
            <Input type="number" min={0} step="0.01" value={feeTypeForm.amount} onChange={(e) => setFeeTypeForm({ ...feeTypeForm, amount: e.target.value })} required />
          </Field>
          <Field label={t('fees.frequency')} required>
            <Select value={feeTypeForm.frequency} onChange={(e) => setFeeTypeForm({ ...feeTypeForm, frequency: e.target.value })}>
              <option value="term">{t('fees.term')}</option>
              <option value="year">{t('fees.year')}</option>
              <option value="one-time">{t('fees.oneTime')}</option>
            </Select>
          </Field>
          <div className="col-span-full">
            <Field label={t('fees.description')}>
              <Input value={feeTypeForm.description} onChange={(e) => setFeeTypeForm({ ...feeTypeForm, description: e.target.value })} />
            </Field>
          </div>
          <label className="col-span-full flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={feeTypeForm.is_active}
              onChange={(e) => setFeeTypeForm({ ...feeTypeForm, is_active: e.target.checked })}
            />
            {t('classes.active')}
          </label>
          <div className="col-span-full mt-4 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setFeeTypeOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={payFor !== null} onClose={() => setPayFor(null)} title={`${t('fees.addPayment')} — ${payFor?.invoice_number ?? ''}`}>
        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        {payFor && (
          <form onSubmit={(e) => void submitPayment(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-full">
              <p className="text-sm text-gray-600">
                {payFor.student?.full_name} · {payFor.title} · {t('fees.amount')}: <strong>{payFor.amount.toFixed(2)}</strong>
              </p>
            </div>
            <Field label={t('fees.amount')} required>
              <Input type="number" min={0.01} step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required />
            </Field>
            <Field label={t('fees.method')} required>
              <Select value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}>
                <option value="cash">cash</option>
                <option value="card">card</option>
                <option value="bank">bank</option>
                <option value="online">online</option>
              </Select>
            </Field>
            <Field label={t('fees.reference')}>
              <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
            </Field>
            <Field label={t('fees.notes')}>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </Field>
            <div className="col-span-full mt-4 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setPayFor(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={paySaving}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
