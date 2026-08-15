import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import type { GuardianCheckResult } from '../lib/types'
import { Button } from './ui'
import { Field, Input } from './form'

export type ParentCheckState = 'idle' | 'checking' | 'found' | 'not-found'

export interface ParentForm {
  name: string
  phone: string
  email: string
  system_email: string
  linked_guardian_id: number | null
  linked_name: string
  linked_system_email: string
  checkState: ParentCheckState
  candidates: GuardianCheckResult['guardians']
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
})

interface Props {
  title: string
  value: ParentForm
  onChange: (next: ParentForm) => void
}

export default function ParentSection({ title, value, onChange }: Props) {
  const { t } = useTranslation()
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (value.linked_guardian_id) return
    const email = value.email.trim()
    if (!email) return

    onChangeRef.current({ ...valueRef.current, checkState: 'checking' })

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.get<GuardianCheckResult>('/guardians/check', { params: { email } })
          const current = valueRef.current
          if (current.email.trim() !== email || current.linked_guardian_id) return
          onChangeRef.current({
            ...current,
            checkState: res.data.guardians.length ? 'found' : 'not-found',
            candidates: res.data.guardians,
          })
        } catch {
          const current = valueRef.current
          if (current.email.trim() !== email || current.linked_guardian_id) return
          onChangeRef.current({ ...current, checkState: 'idle' })
        }
      })()
    }, 600)

    return () => clearTimeout(timer)
  }, [value.email, value.linked_guardian_id])

  const link = (candidate: GuardianCheckResult['guardians'][number]) => {
    onChangeRef.current({
      ...valueRef.current,
      linked_guardian_id: candidate.id,
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
        <Field label={t('students.parentName')}>
          <Input value={value.name} onChange={(e) => onChangeRef.current({ ...valueRef.current, name: e.target.value })} />
        </Field>
        <Field label={t('students.parentPhone')}>
          <Input value={value.phone} onChange={(e) => onChangeRef.current({ ...valueRef.current, phone: e.target.value })} />
        </Field>
        <Field label={t('students.parentEmail')}>
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChangeRef.current({ ...valueRef.current, email: e.target.value })}
          />
        </Field>
        <Field label={t('students.parentSystemEmail')}>
          <Input
            type="text"
            value={value.system_email}
            onChange={(e) => onChangeRef.current({ ...valueRef.current, system_email: e.target.value })}
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
            <div key={c.id} className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-700">
                {c.name} · {c.system_email ?? c.email ?? ''} · {c.linked_students_count}{' '}
                {c.linked_students_count === 1 ? t('students.linkedChild') : t('students.linkedChildren')}
              </span>
              <Button variant="secondary" size="sm" type="button" onClick={() => link(c)}>
                {t('students.linkButton', { name: c.name })}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">{t('students.parentCheckHint')}</p>
      )}
    </div>
  )
}
