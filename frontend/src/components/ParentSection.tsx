import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isLinkableGuardian, useEmailCheck, type EmailOwner } from '../lib/emailCheck'
import { Button } from './ui'
import { Field, Input } from './form'

export type ParentCheckState = 'idle' | 'checking' | 'found' | 'not-found' | 'conflict'

export interface ParentForm {
  name: string
  phone: string
  email: string
  system_email: string
  linked_guardian_id: number | null
  linked_name: string
  linked_system_email: string
  checkState: ParentCheckState
  candidates: EmailOwner[]
  blockers: EmailOwner[]
}

export const emptyParentForm = (): ParentForm => ({
  name: '',
  phone: '',
  email: '',
  system_email: '',
  linked_guardian_id: null,
  linked_name: '',
  linked_system_email: '',
  checkState: 'idle',
  candidates: [],
  blockers: [],
})

interface Props {
  role: 'father' | 'mother'
  title: string
  value: ParentForm
  onChange: (next: ParentForm) => void
  required?: boolean
}

export default function ParentSection({ role, title, value, onChange, required }: Props) {
  const { t } = useTranslation()
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const { state, owners } = useEmailCheck(value.email)

  useEffect(() => {
    if (value.linked_guardian_id) return

    const linkable = owners.filter((o) => isLinkableGuardian(o, role))
    const blockers = owners.filter((o) => !isLinkableGuardian(o, role))
    const next = { ...valueRef.current }

    if (state === 'checking') {
      next.checkState = 'checking'
      next.candidates = []
      next.blockers = []
    } else if (state === 'used') {
      if (linkable.length > 0) {
        next.checkState = 'found'
        next.candidates = linkable
        next.blockers = []
      } else {
        next.checkState = 'conflict'
        next.candidates = []
        next.blockers = blockers
      }
    } else if (state === 'available') {
      next.checkState = 'not-found'
      next.candidates = []
      next.blockers = []
    } else {
      next.checkState = 'idle'
      next.candidates = []
      next.blockers = []
    }

    onChangeRef.current(next)
  }, [state, owners, role, value.email, value.linked_guardian_id])

  const link = (candidate: EmailOwner) => {
    onChangeRef.current({
      ...valueRef.current,
      linked_guardian_id: candidate.guardian_id,
      linked_name: candidate.name,
      linked_system_email: candidate.system_email ?? candidate.email ?? '',
      checkState: 'found',
    })
  }

  const unlink = () => {
    onChangeRef.current({
      ...valueRef.current,
      linked_guardian_id: null,
      linked_name: '',
      linked_system_email: '',
      checkState: 'idle',
    })
  }

  return (
    <div className="col-span-full rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-700">{title}</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('students.parentName')} required={required}>
          <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} required={required} />
        </Field>
        <Field label={t('students.parentPhone')} required={required}>
          <Input inputMode="numeric" value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/[^0-9]/g, '') })} required={required} />
        </Field>
        <Field label={t('students.parentEmail')}>
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </Field>
        <Field label={t('students.parentSystemEmail')}>
          <Input
            type="text"
            value={value.system_email}
            onChange={(e) => onChange({ ...value, system_email: e.target.value })}
            placeholder={t('students.parentSystemEmailHint')}
          />
        </Field>
      </div>

      {value.linked_guardian_id ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-indigo-50 px-3 py-2 text-sm">
          <span className="text-indigo-900">
            {t('students.linkedTo', {
              name: value.linked_name,
              system: value.linked_system_email,
            })}
          </span>
          <Button variant="secondary" size="sm" type="button" onClick={unlink}>
            {t('students.unlink')}
          </Button>
        </div>
      ) : value.checkState === 'checking' ? (
        <p className="mt-3 text-xs text-gray-500">{t('students.checkingGuardian')}</p>
      ) : value.checkState === 'not-found' ? (
        <p className="mt-3 text-xs text-green-700">{t('students.guardianNotFound')}</p>
      ) : value.checkState === 'found' ? (
        <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50/50 px-3 py-2">
          <p className="text-xs font-medium text-indigo-900">{t('students.guardianFound')}</p>
          {value.candidates.map((c) => (
            <div key={c.guardian_id ?? c.user_id ?? c.name} className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-700">
                {c.name} · {c.system_email ?? c.email ?? ''} · {c.linked_students_count ?? 0}{' '}
                {c.linked_students_count === 1 ? t('students.linkedChild') : t('students.linkedChildren')}
              </span>
              <Button variant="secondary" size="sm" type="button" onClick={() => link(c)}>
                {t('students.linkButton', { name: c.name })}
              </Button>
            </div>
          ))}
        </div>
      ) : value.checkState === 'conflict' ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          {value.blockers.map((b) => (
            <p key={b.user_id ?? b.guardian_id ?? b.name} className="text-xs font-medium text-red-700">
              {t('students.emailUsedBy', { name: b.name, context: b.context })}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">{t('students.parentCheckHint')}</p>
      )}
    </div>
  )
}
