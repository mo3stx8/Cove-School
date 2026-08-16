import i18n from '../i18n'

export interface LocalizedName {
  name?: string | null
  name_ar?: string | null
}

export function localizedName<T extends LocalizedName>(item: T | null | undefined): string {
  if (!item) return ''
  if (i18n.language?.startsWith('ar') && item.name_ar) return item.name_ar
  return item.name ?? ''
}

export function isArabic(): boolean {
  return i18n.language?.startsWith('ar') ?? false
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}
