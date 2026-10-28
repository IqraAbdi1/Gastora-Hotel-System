import type { Tone } from '../../components/ui'
import type { AccountStatus, CorporateContact, PaymentTerms } from '../../services/corporate/corporateTypes'
import { ugx } from '../../lib/format'
import type { BillTo } from '../../types'

/** Credit left, or how far over the limit the company already is. */
export const creditText = (available: number) => (available < 0 ? `Over limit by ${ugx(-available)}` : ugx(available))

export const statusTone: Record<AccountStatus, Tone> = {
  pending: 'warn',
  active: 'good',
  'on-hold': 'bad',
  suspended: 'bad',
  closed: 'neutral',
  declined: 'neutral',
}

export const TERMS: PaymentTerms[] = ['prepaid', 'on-departure', 'net-15', 'net-30', 'net-60']
export const BILL_TOS: BillTo[] = ['company-room', 'company-all', 'guest']

/** "1,500,000" from what was typed, ignoring commas and spaces. Empty or invalid gives 0. */
export const parseAmount = (text: string) => Math.max(0, Math.round(Number(text.replace(/[,\s]/g, '')) || 0))

export type ContactDraft = Omit<CorporateContact, 'id'> & { id?: string }
export const emptyContact: ContactDraft = { name: '', jobTitle: '', phone: '', email: '', canBook: true, canApproveCharges: false, active: true }
