import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, errorMessage } from '../lib/api'
import { Alert, Button } from '../components/ui'
import { Field, Input } from '../components/form'

export default function ActivatePage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const systemEmail = params.get('email') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const invalidLink = !token || !systemEmail

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/activate', {
        token,
        email: systemEmail,
        password,
        password_confirmation: confirm,
      })
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-lg">
            C
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('appName')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.activationTitle')}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-600">
                ✓
              </div>
              <p className="text-sm text-gray-700">{t('auth.activationSuccess')}</p>
              <Link
                to="/login"
                className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                {t('auth.goToLogin')}
              </Link>
            </div>
          ) : invalidLink ? (
            <div>
              <Alert type="error">{t('auth.activationInvalid')}</Alert>
              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  {t('auth.goToLogin')}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-gray-600">{t('auth.activationSubtitle', { email: systemEmail })}</p>
              {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
              <form onSubmit={(e) => void submit(e)} className="space-y-4">
                <Field label={t('auth.activationPassword')} required>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    placeholder={t('auth.activationPasswordHint')}
                    required
                  />
                </Field>
                <Field label={t('auth.confirmPassword')} required>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />
                </Field>
                <Button type="submit" className="w-full" loading={loading}>
                  {t('auth.activate')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
