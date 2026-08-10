import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Spinner } from '../components/ui'
import { Field, Input } from '../components/form'

const steps = ['school', 'year', 'structure', 'grading', 'fees'] as const

export default function SetupWizard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, refresh, login } = useAuth()

  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState<Record<string, boolean> | null>(null)
  const [schoolLoaded, setSchoolLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    school_name: '',
    slug: '',
    country: '',
    currency: 'USD',
    timezone: 'UTC',
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    year_name: '',
    start_date: '',
    end_date: '',
    term1: 'Term 1',
    term2: 'Term 2',
    term3: 'Term 3',
    grade_name: '',
    level: 1,
    subject_name: '',
    scaleA: { name: 'A', min: 90, max: 100 },
    scaleB: { name: 'B', min: 80, max: 89 },
    scaleC: { name: 'C', min: 70, max: 79 },
    scaleD: { name: 'D', min: 60, max: 69 },
    scaleF: { name: 'F', min: 0, max: 59 },
    fee_name: '',
    fee_amount: '',
  })

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    void (async () => {
      const emptyProgress = {
        school_information: false,
        academic_year: false,
        structure: false,
        users: false,
        grading: false,
        fees: false,
      }
      try {
        if (!localStorage.getItem('cove_token')) {
          setProgress(emptyProgress)
          return
        }
        const res = await api.get<{ steps: Record<string, boolean>; all_complete: boolean; school: { name: string } }>(
          '/setup/progress',
        )
        setProgress(res.data.steps)
        setSchoolLoaded(true)
        if (!res.data.all_complete) {
          setStep(Object.values(res.data.steps).every(Boolean) ? 2 : 1)
        }
      } catch {
        setProgress(emptyProgress)
      }
    })()
  }, [])

  if (!progress) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const registerSchool = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/setup/register', {
        school_name: form.school_name,
        slug: form.slug,
        name: form.name,
        email: form.email,
        password: form.password,
        password_confirmation: form.password_confirmation,
        country: form.country || undefined,
        currency: form.currency,
        timezone: form.timezone,
      })
      await login(form.email, form.password)
      await refresh()
      setStep(1)
      setProgress({
        school_information: true,
        academic_year: false,
        structure: false,
        users: true,
        grading: false,
        fees: false,
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const createYear = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/setup/academic-year', {
        name: form.year_name,
        start_date: form.start_date,
        end_date: form.end_date,
        terms: [
          { name: form.term1, term_number: 1, start_date: form.start_date, end_date: form.end_date },
          { name: form.term2, term_number: 2, start_date: form.start_date, end_date: form.end_date },
          { name: form.term3, term_number: 3, start_date: form.start_date, end_date: form.end_date },
        ],
      })
      setStep(2)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const createStructure = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/grades', { name: form.grade_name, level: Number(form.level) })
      await api.post('/subjects', { name: form.subject_name })
      setStep(3)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const createScales = async () => {
    setLoading(true)
    setError('')
    try {
      for (const scale of [form.scaleA, form.scaleB, form.scaleC, form.scaleD, form.scaleF]) {
        await api.post('/grade-scales', {
          name: scale.name,
          min_percentage: scale.min,
          max_percentage: scale.max,
        })
      }
      setStep(4)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const createFee = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/fee-types', {
        name: form.fee_name,
        amount: Number(form.fee_amount),
        frequency: 'term',
      })
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const actions: Record<string, { label: string; handler: () => Promise<void> }> = {
    school: { label: t('setup.register'), handler: registerSchool },
    year: { label: t('common.next'), handler: createYear },
    structure: { label: t('common.next'), handler: createStructure },
    grading: { label: t('common.next'), handler: createScales },
    fees: { label: t('setup.goToDashboard'), handler: createFee },
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">C</div>
          <div>
            <p className="text-sm font-semibold">{t('appName')}</p>
            <p className="text-xs text-gray-500">{t('setup.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">{t('setup.title')}</h1>
        {schoolLoaded && <p className="mt-1 text-sm text-amber-600">{t('setup.progressSaved')}</p>}

        <div className="mt-6 mb-8 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={
                  i <= step
                    ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white'
                    : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-500'
                }
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className={i < step ? 'h-1 flex-1 bg-indigo-600' : 'h-1 flex-1 bg-gray-200'} />}
            </div>
          ))}
        </div>

        {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
        {notice && <div className="mb-4"><Alert type="info">{notice}</Alert></div>}

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('setup.stepSchool')}</h2>
              <Field label={t('setup.schoolName')} required>
                <Input value={form.school_name} onChange={(e) => set('school_name', e.target.value)} />
              </Field>
              <Field label={t('setup.slug')} required>
                <Input value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('setup.country')}>
                  <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
                </Field>
                <Field label={t('setup.currency')}>
                  <Input value={form.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} />
                </Field>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-600">{t('setup.createAccount')}</h3>
                <Field label={t('auth.name')} required>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                </Field>
                <div className="mt-4">
                  <Field label={t('auth.email')} required>
                    <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
                  </Field>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Field label={t('auth.password')} required>
                    <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
                  </Field>
                  <Field label={t('auth.confirmPassword')} required>
                    <Input type="password" value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('setup.stepYear')}</h2>
              <Field label={t('setup.yearName')} required>
                <Input value={form.year_name} onChange={(e) => set('year_name', e.target.value)} placeholder="2026-2027" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('setup.startDate')} required>
                  <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
                </Field>
                <Field label={t('setup.endDate')} required>
                  <Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label={t('setup.term1')}>
                  <Input value={form.term1} onChange={(e) => set('term1', e.target.value)} />
                </Field>
                <Field label={t('setup.term2')}>
                  <Input value={form.term2} onChange={(e) => set('term2', e.target.value)} />
                </Field>
                <Field label={t('setup.term3')}>
                  <Input value={form.term3} onChange={(e) => set('term3', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('setup.stepStructure')}</h2>
              <p className="text-sm text-gray-500">Create a first grade and subject — you can add more later.</p>
              <Field label={t('academic.gradeName')} required>
                <Input value={form.grade_name} onChange={(e) => set('grade_name', e.target.value)} placeholder="Grade 1" />
              </Field>
              <Field label={t('academic.level')}>
                <Input type="number" min={1} value={form.level} onChange={(e) => set('level', Number(e.target.value))} />
              </Field>
              <Field label={t('academic.subjectName')} required>
                <Input value={form.subject_name} onChange={(e) => set('subject_name', e.target.value)} placeholder="Mathematics" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('setup.stepGrading')}</h2>
              <p className="text-sm text-gray-500">The standard A–F scale will be created for you.</p>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {[form.scaleA, form.scaleB, form.scaleC, form.scaleD, form.scaleF].map((scale, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-gray-100 px-4 py-2 text-sm last:border-0">
                    <span className="w-16 font-semibold">{scale.name}</span>
                    <span className="text-gray-500">
                      {scale.min}% – {scale.max}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('setup.stepFees')}</h2>
              <p className="text-sm text-gray-500">Create a first fee type — you can add more later.</p>
              <Field label={t('fees.name')} required>
                <Input value={form.fee_name} onChange={(e) => set('fee_name', e.target.value)} placeholder="Tuition" />
              </Field>
              <Field label={t('fees.amount')} required>
                <Input type="number" min={0} value={form.fee_amount} onChange={(e) => set('fee_amount', e.target.value)} />
              </Field>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                {t('common.back')}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => void actions[steps[step]].handler()} loading={loading}>
              {actions[steps[step]].label}
            </Button>
          </div>
        </div>

        {user && (
          <button onClick={() => navigate('/dashboard')} className="mt-6 text-sm text-indigo-600 hover:text-indigo-500">
            {t('setup.goToDashboard')} →
          </button>
        )}
      </div>
    </div>
  )
}
