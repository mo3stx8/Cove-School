import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  variant: ToastVariant
  message: string
  action?: ToastAction
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void
  error: (message: string) => void
  info: (message: string, action?: ToastAction) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const icons: Record<ToastVariant, { color: string; path: string }> = {
  success: {
    color: 'bg-emerald-100 text-emerald-700',
    path: 'M5 13l4 4L19 7',
  },
  error: {
    color: 'bg-red-100 text-red-700',
    path: 'M6 18L18 6M6 6l12 12',
  },
  info: {
    color: 'bg-blue-100 text-blue-700',
    path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
}

const AUTO_DISMISS_MS = 4500
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string, action?: ToastAction) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, variant, message, action }])
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, action) => push('success', message, action),
      error: (message) => push('error', message),
      info: (message, action) => push('info', message, action),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-slide-in pointer-events-auto flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
            role="status"
          >
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', icons[toast.variant].color)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icons[toast.variant].path} />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{toast.message}</p>
              {toast.action && (
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  onClick={() => {
                    toast.action?.onClick()
                    dismiss(toast.id)
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              onClick={() => dismiss(toast.id)}
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
