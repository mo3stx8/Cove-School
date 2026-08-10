import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../lib/api'
import { setLanguage } from '../i18n'
import { Alert, Button } from '../components/ui'
import { Field, Input } from '../components/form'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/dashboard')
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
          <p className="mt-1 text-sm text-gray-500">{t('auth.welcome')}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">{t('auth.login')}</h2>
          {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            <Field label={t('auth.email')} required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label={t('auth.password')} required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <Button type="submit" className="w-full" loading={loading}>
              {t('auth.login')}
            </Button>
          </form>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/setup" className="text-indigo-600 hover:text-indigo-500">
            {t('setup.title')}
          </Link>
          <button
            onClick={() => {
              const next = document.documentElement.lang === 'en' ? 'ar' : 'en'
              setLanguage(next)
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            {document.documentElement.lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
      </div>
    </div>
  )
}
