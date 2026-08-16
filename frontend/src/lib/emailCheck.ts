import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export type EmailCheckState = 'idle' | 'checking' | 'available' | 'used'

export interface EmailOwner {
  type: 'student' | 'teacher' | 'guardian' | 'admin'
  relationship: string | null
  name: string
  system_email: string | null
  email?: string | null
  context: string
  guardian_id: number | null
  user_id: number | null
  linked_students_count: number | null
}

export interface EmailCheckResult {
  email: string
  used: boolean
  owners: EmailOwner[]
}

export function useEmailCheck(email: string, debounceMs = 600) {
  const [state, setState] = useState<EmailCheckState>('idle')
  const [owners, setOwners] = useState<EmailOwner[]>([])
  const emailRef = useRef(email)
  emailRef.current = email

  useEffect(() => {
    const value = email.trim()
    if (!value) {
      setState('idle')
      setOwners([])
      return
    }
    setState('checking')
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.get<EmailCheckResult>('/emails/check', { params: { email: value } })
          if (emailRef.current.trim().toLowerCase() !== value.toLowerCase()) return
          setOwners(res.data.owners)
          setState(res.data.used ? 'used' : 'available')
        } catch {
          if (emailRef.current.trim().toLowerCase() !== value.toLowerCase()) return
          setState('idle')
          setOwners([])
        }
      })()
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [email, debounceMs])

  return { state, owners }
}

/**
 * A parent field may reuse an existing guardian of the same role (link flow).
 * Any other owner (student / teacher / another role) is a conflict.
 */
export function isLinkableGuardian(owner: EmailOwner, role: 'father' | 'mother'): boolean {
  if (owner.type !== 'guardian') return false
  const rel = (owner.relationship ?? '').toLowerCase()
  if (role === 'father') return rel === 'father' || rel === 'guardian' || rel === 'parent' || rel === ''
  return rel === 'mother' || rel === 'guardian' || rel === 'parent' || rel === ''
}
