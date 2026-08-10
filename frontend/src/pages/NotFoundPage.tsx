import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '../components/ui'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md p-10 text-center">
        <p className="text-6xl font-bold text-indigo-600">404</p>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">{t('notFound')}</h1>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button>{t('backToDashboard')}</Button>
        </Link>
      </Card>
    </div>
  )
}
