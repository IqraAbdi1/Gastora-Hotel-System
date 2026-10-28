import type { Tone } from '../../components/ui'
import type { AuditCategory, CheckStatus } from '../../services/security/securityTypes'

export const CHECK_TONE: Record<CheckStatus, Tone> = { ok: 'good', warn: 'warn', fail: 'bad' }
export const CHECK_LABEL: Record<CheckStatus, string> = { ok: 'OK', warn: 'Attention', fail: 'Failing' }

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  rates: 'Rates',
  reservations: 'Reservations',
  folios: 'Folios',
  refunds: 'Refunds',
  voids: 'Voids',
  discounts: 'Discounts',
  stock: 'Stock',
  accounting: 'Accounting',
  security: 'Security',
  privacy: 'Privacy',
  fiscal: 'Fiscal',
}

export const CATEGORY_TONE: Record<AuditCategory, Tone> = {
  rates: 'brand',
  reservations: 'info',
  folios: 'neutral',
  refunds: 'warn',
  voids: 'bad',
  discounts: 'accent',
  stock: 'good',
  accounting: 'brand',
  security: 'neutral',
  privacy: 'info',
  fiscal: 'neutral',
}

export const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
