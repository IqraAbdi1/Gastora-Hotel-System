import type { CorporateAccount } from '../../services/corporate/corporateTypes'
import type { DirectBillAccount, DirectBillTransfer } from '../../services/accounting/accountingTypes'

// City ledger arithmetic. Pure functions.

export const owing = (t: DirectBillTransfer) => t.amount - t.paidAmount

export function balanceOf(transfers: DirectBillTransfer[], accountId: string): number {
  return transfers.filter((t) => t.accountId === accountId).reduce((n, t) => n + owing(t), 0)
}

/** A company's credit limit is decided on the corporate account; an agent's is kept here. */
export function limitOf(acc: DirectBillAccount, byId: (id: string) => CorporateAccount | undefined): number {
  if (acc.kind === 'corporate') return byId(acc.sourceId)?.creditLimit ?? acc.creditLimit
  return acc.creditLimit
}

export const BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const
export type Bucket = (typeof BUCKETS)[number]

const ageDays = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)

export function bucketOf(invoiceDate: string, today: string): Bucket {
  const d = ageDays(invoiceDate, today)
  if (d <= 30) return '0-30'
  if (d <= 60) return '31-60'
  if (d <= 90) return '61-90'
  return '90+'
}

export function ageing(transfers: DirectBillTransfer[], today: string): Record<Bucket, number> {
  const out: Record<Bucket, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  for (const t of transfers) if (owing(t) > 0) out[bucketOf(t.businessDate, today)] += owing(t)
  return out
}

export function overdueOf(transfers: DirectBillTransfer[], today: string): number {
  return transfers.filter((t) => owing(t) > 0 && t.dueDate < today).reduce((n, t) => n + owing(t), 0)
}
