import { folioOf } from './folio'
import { daysHeld } from './lostFound'
import type { CorporateAccount } from '../services/corporate/corporateTypes'
import type { LostItem } from './lostFound'
import type { Reservation, Room } from '../types'

/**
 * Everything waiting for one person to act on, gathered from every module.
 * A manager should not have to remember five places. Rules, not AI: each line is a record
 * that is genuinely sitting unfinished, with the page that can finish it.
 */
export type WaitKind = 'approve' | 'review'

export interface WaitItem {
  id: string
  kind: WaitKind
  /** Where it came from, for grouping. */
  area: 'Supplies' | 'Stock' | 'Companies' | 'Front desk' | 'Rooms'
  title: string
  detail: string
  amount?: number
  /** How long it has been sitting, in days. */
  age?: number
  severity: 'bad' | 'warn' | 'info'
  to: string
  action: string
}

const rank = { bad: 0, warn: 1, info: 2 }

export function sortWaiting(items: WaitItem[]) {
  return [...items].sort((a, b) => rank[a.severity] - rank[b.severity] || (b.age ?? 0) - (a.age ?? 0))
}

/** Guests and companies that need a decision from management. */
export function frontDeskWaiting(
  reservations: Reservation[],
  rooms: Room[],
  accounts: CorporateAccount[],
  today: string,
): WaitItem[] {
  const out: WaitItem[] = []

  for (const r of reservations) {
    // A guest who left owing money is the hotel's loss until someone chases it.
    if (r.status === 'checked-out' && r.unpaidAtCheckout) {
      const left = r.checkedOutAt?.slice(0, 10)
      const age = left ? Math.max(0, Math.round((Date.parse(today) - Date.parse(left)) / 86400000)) : 0
      out.push({
        id: `unpaid-${r.id}`,
        kind: 'review',
        area: 'Front desk',
        title: `${r.guest} left owing money`,
        detail: r.checkoutNote ? `Reason given: ${r.checkoutNote}` : 'No reason was recorded.',
        amount: r.unpaidAtCheckout,
        age,
        severity: age > 7 ? 'bad' : 'warn',
        to: `/desk/documents?q=${r.id}`,
        action: 'Open the invoice',
      })
    }

    // A stay over the company's credit cannot be billed until someone approves it.
    const c = r.corporate
    if (c && c.billTo !== 'guest' && (r.status === 'booked' || r.status === 'in-house')) {
      const account = accounts.find((a) => a.id === c.accountId)
      if (account && account.creditLimit > 0) {
        const over = folioOf(r).total + account.outstandingBalance - account.creditLimit
        if (over > 0 && !c.billing.overCreditApprovedBy) {
          out.push({
            id: `credit-${r.id}`,
            kind: 'approve',
            area: 'Companies',
            title: `${c.accountName} is over its credit limit`,
            detail: `${r.guest} arrives ${r.arrival}. The stay cannot be billed to the company until this is approved.`,
            amount: over,
            severity: r.arrival <= today ? 'bad' : 'warn',
            to: '/desk/companies',
            action: 'Open the company',
          })
        }
      }
    }

    // A company price that needs a manager to allow it.
    if (c?.pricing?.status === 'pending') {
      out.push({
        id: `price-${r.id}`,
        kind: 'approve',
        area: 'Companies',
        title: `Company price to approve for ${r.guest}`,
        detail: `${c.accountName}: ${c.pricing.labels.join(', ')}. The normal price is charged until it is approved.`,
        amount: c.pricing.originalTotal - c.pricing.finalTotal,
        severity: 'warn',
        to: `/desk/reservations?r=${r.id}`,
        action: 'Open the booking',
      })
    }
  }

  // A company account waiting to be opened at all.
  for (const a of accounts) {
    if (a.status === 'pending')
      out.push({
        id: `account-${a.id}`,
        kind: 'approve',
        area: 'Companies',
        title: `${a.name} is waiting to be approved`,
        detail: (a.requestedCreditLimit ?? 0) > 0 ? `Asked for ${(a.requestedCreditLimit ?? 0).toLocaleString('en-US')} UGX of credit.` : 'No credit asked for.',
        severity: 'warn',
        to: '/desk/companies',
        action: 'Open the account',
      })
  }

  // Rooms out of sale cost money every night they stay out.
  const blocked = rooms.filter((x) => x.status === 'blocked')
  if (blocked.length > 0)
    out.push({
      id: 'blocked-rooms',
      kind: 'review',
      area: 'Rooms',
      title: `${blocked.length} room${blocked.length === 1 ? '' : 's'} out of service`,
      detail: `Room${blocked.length === 1 ? '' : 's'} ${blocked.map((x) => x.number).join(', ')} cannot be sold.`,
      severity: 'warn',
      to: '/desk/rooms?quick=blocked',
      action: 'Open rooms',
    })

  return out
}

/** Lost property held past the hotel's limit, which someone has to decide about. */
export function lostFoundWaiting(items: LostItem[], keepDays: number, today: string): WaitItem[] {
  const over = items.filter((i) => i.status === 'held' && daysHeld(i, today) > keepDays)
  if (over.length === 0) return []
  return [
    {
      id: 'lost-overdue',
      kind: 'review',
      area: 'Front desk',
      title: `${over.length} lost item${over.length === 1 ? '' : 's'} held too long`,
      detail: `Over the ${keepDays}-day limit. Give them back or record them as disposed of.`,
      severity: 'info',
      to: '/desk/lost-found?view=overdue',
      action: 'Open lost and found',
    },
  ]
}
