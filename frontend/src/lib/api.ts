import axios, { AxiosError } from 'axios'

export const TOKEN_KEY = 'cove_token'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

export interface ApiError {
  message?: string
  errors?: Record<string, string[]>
}

interface ListMeta {
  last_page: number
  total: number
}

export function unwrapList<T>(payload: { data: unknown }): T[] {
  const inner = payload.data as { data?: unknown } | unknown[]
  if (Array.isArray(inner)) {
    return inner as T[]
  }
  if (inner && typeof inner === 'object' && Array.isArray((inner as { data?: unknown }).data)) {
    return (inner as { data: T[] }).data
  }
  return []
}

export function listMeta(payload: { data: unknown; meta?: { last_page: number; total: number } }): ListMeta {
  const inner = payload.data as { data?: unknown[]; last_page?: number; total?: number }
  if (inner && typeof inner === 'object' && !Array.isArray(inner) && Array.isArray(inner.data)) {
    return { last_page: inner.last_page ?? 1, total: inner.total ?? inner.data.length }
  }
  if (Array.isArray(inner)) {
    return { last_page: payload.meta?.last_page ?? 1, total: payload.meta?.total ?? inner.length }
  }
  return { last_page: 1, total: 0 }
}

export function errorMessage(err: unknown): string {
  if (err instanceof AxiosError && err.response) {
    const data = err.response.data as ApiError | undefined
    if (data?.errors) {
      return Object.values(data.errors)
        .flat()
        .join(' ')
    }
    if (data?.message) {
      return data.message
    }
  }
  return 'Something went wrong. Please try again.'
}

export const downloadPdf = (url: string) => {
  const token = localStorage.getItem(TOKEN_KEY)
  return api.get(url, {
    responseType: 'blob',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

export const saveBlob = (data: BlobPart, filename: string) => {
  const blobUrl = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}

export const downloadBlob = async (url: string, filename: string) => {
  const res = await api.get(url, { responseType: 'blob' })
  saveBlob(res.data, filename)
}
