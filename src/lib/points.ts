// Points and vouchers.
//
// Tiers say what a guest is. Points say what the hotel owes them, and that difference matters more
// than it sounds: a tier costs nothing until the guest turns up, while every unspent point is a
// liability sitting on the hotel's books. A programme nobody counts is a programme that surprises
// somebody at the end of the year.
//
// So four rules, and they are the ones hotels get wrong:
//
//   1. Points are earned on what the guest actually paid for the room, not on the whole bill. The
//      hotel does not want to pay itself points on a tax line or on the agent's commission.
//   2. They are earned when the stay finishes, not when it is booked. A cancelled booking earns
//      nothing, which stops the obvious trick.
//   3. They are only earned by a guest who agreed to be remembered. Without that there is no
//      programme and no record to keep.
//   4. A voucher is points already spent: taken off the balance the moment it is issued, so the
//      hotel's books never count the same point twice.
//
// Pure rules only: no React.

import type { Guest, Reservation } from '../types'

export interface PointsSettings {
  on: boolean
  /** Points earned for every 1,000 UGX of room money. */
  perThousand: number
  /** What one point is worth when it is spent, in UGX. */
  worth: number
  /** The fewest points that may be turned into a voucher. */
  leastToSpend: number
  /** Points expire after this many months with no stay. 0 means they never expire. */
  expireMonths: number
}

export const DEFAULT_POINTS: PointsSettings = {
  on: false,
  perThousand: 1,
  worth: 50,
  leastToSpend: 100,
  expireMonths: 24,
}

export type VoucherState = 'open' | 'spent' | 'expired'

export interface Voucher {
  id: string
  guestId: string
  guestName: string
  /** Points taken off the balance to make it. */
  points: number
  /** What it is worth at the desk. */
  amount: number
  issuedAt: string
  issuedBy: string
  expiresOn?: string
  state: VoucherState
  /** The stay it was spent on. */
  usedOn?: string
  usedAt?: string
}

/** Room money only: the part of a finished stay that was the room, not the extras or the tax. */
export function roomMoneyOf(r: Reservation): number {
  const extras = (r.charges ?? []).reduce((n, c) => n + c.amount, 0)
  return Math.max(0, r.total - extras)
}

/** What one finished stay earns. */
export function earnedOn(r: Reservation, s: PointsSettings): number {
  if (!s.on || r.status !== 'checked-out') return 0
  return Math.floor(roomMoneyOf(r) / 1000) * Math.max(0, s.perThousand)
}

export interface PointsAccount {
  earned: number
  spent: number
  balance: number
  /** What the balance is worth if it were all spent today. */
  worth: number
  /** Points that will fall away unless the guest comes back, and when. */
  expiring?: { points: number; on: string }
  lastEarned?: string
}

const addMonths = (date: string, months: number): string => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

/**
 * A guest's points, worked out from their finished stays and the vouchers already issued.
 *
 * Nothing is stored as a running total. A balance kept as a number drifts from the stays that made it,
 * and the first time a guest argues about it the hotel has no way to show its working.
 */
export function accountOf(
  guest: Guest,
  reservations: Reservation[],
  vouchers: Voucher[],
  s: PointsSettings,
): PointsAccount {
  if (!s.on || guest.loyaltyConsent !== true) return { earned: 0, spent: 0, balance: 0, worth: 0 }

  let earned = 0
  let lastEarned: string | undefined
  for (const r of reservations) {
    const mine = r.guestId ? r.guestId === guest.id : r.guest === guest.name
    if (!mine) continue
    const points = earnedOn(r, s)
    if (points === 0) continue
    earned += points
    if (!lastEarned || r.departure > lastEarned) lastEarned = r.departure
  }

  const spent = vouchers
    .filter((v) => v.guestId === guest.id && v.state !== 'expired')
    .reduce((n, v) => n + v.points, 0)

  const balance = Math.max(0, earned - spent)
  const expiring =
    s.expireMonths > 0 && lastEarned && balance > 0
      ? { points: balance, on: addMonths(lastEarned, s.expireMonths) }
      : undefined

  return { earned, spent, balance, worth: balance * s.worth, expiring, lastEarned }
}

/** Whether these points have already fallen away. */
export const expired = (account: PointsAccount, today: string): boolean =>
  !!account.expiring && account.expiring.on < today

/** Why a voucher cannot be made, or nothing when it can. */
export function voucherProblem(account: PointsAccount, points: number, s: PointsSettings, today: string): string | undefined {
  if (!s.on) return 'The programme does not use points.'
  if (expired(account, today)) return 'These points have expired. The guest earns again on their next stay.'
  if (points < s.leastToSpend) return `A voucher needs at least ${s.leastToSpend} points.`
  if (points > account.balance) return `The guest has ${account.balance} points.`
  return undefined
}

export const voucherWorth = (points: number, s: PointsSettings): number => points * s.worth

export function newVoucherId(list: Voucher[]): string {
  let n = list.length + 1
  while (list.some((v) => v.id === `V-${String(n).padStart(4, '0')}`)) n += 1
  return `V-${String(n).padStart(4, '0')}`
}

/** What the whole programme owes, which is the number a hotel's accountant asks for. */
export function owedBy(guests: Guest[], reservations: Reservation[], vouchers: Voucher[], s: PointsSettings) {
  let points = 0
  for (const g of guests) points += accountOf(g, reservations, vouchers, s).balance
  const open = vouchers.filter((v) => v.state === 'open')
  return {
    points,
    pointsWorth: points * s.worth,
    openVouchers: open.length,
    vouchersWorth: open.reduce((n, v) => n + v.amount, 0),
  }
}
