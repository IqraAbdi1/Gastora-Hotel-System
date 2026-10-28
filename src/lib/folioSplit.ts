import { folioOf } from './folio'
import { hasMaster, routeOf } from './groups'
import type { GroupBlock } from './groups'
import { isTaxCategory } from './tax'
import type { BillTo, FolioCharge, Reservation } from '../types'

/**
 * A company stay is one stay with two bills. The company settles what it agreed to carry, on account
 * and against its LPO; the guest settles everything they chose for themselves, at the desk, before they
 * leave. Without this the desk has to remember the agreement and do the arithmetic by hand at 7am.
 */

export type Payer = 'company' | 'guest'

/**
 * A stay can be divided by two different agreements. A company account divides it by what the company
 * agreed to carry for this one guest; a group block divides it by what the organiser agreed to carry
 * for everybody. When a stay is in a block, the block wins: the workshop's rule is the same for all
 * twenty-five rooms, and a guest-by-guest exception is how a hotel loses track of a master bill.
 */

export interface FolioLine {
  id: string
  label: string
  note?: string
  amount: number
  payer: Payer
  /** A cancelled line, kept on the bill rather than deleted. */
  cancelled?: boolean
}

export interface SplitSide {
  lines: FolioLine[]
  total: number
}

export interface SplitFolio {
  /** False for an ordinary stay: there is one bill and nothing to divide. */
  split: boolean
  billTo: BillTo | null
  accountName?: string
  company: SplitSide
  guest: SplitSide
  /** Paid at the desk. A deposit or a payment is always the guest's money. */
  paid: number
  /** What the guest must still settle before leaving. */
  guestBalance: number
  /** What will be invoiced to the company account. */
  companyBalance: number
}

/**
 * Who carries a charge. The room and the taxes on it follow the agreement; anything the guest chose
 * for themselves is theirs, which is what "room and breakfast to us, bar to them" means in practice.
 */
export function payerFor(category: string, billTo: BillTo): Payer {
  if (billTo === 'guest') return 'guest'
  if (billTo === 'company-all') return 'company'
  // company-room: the room, its taxes and the service charge sit with the company.
  if (isTaxCategory(category)) return 'company'
  // An upgrade the guest asked for, and hours past check-out they chose to take, are their own.
  return 'guest'
}

const ROOM_LINE = 'room'

/** The stay's bill, divided if it is on a company account. */
export function splitFolio(r: Reservation, accountName?: string, block?: GroupBlock): SplitFolio {
  const f = folioOf(r)
  const billTo = r.corporate?.billTo ?? null
  const byBlock = !!block && hasMaster(block.billing)
  const split = byBlock || (!!billTo && billTo !== 'guest')

  const asPayer = (side: 'master' | 'guest'): Payer => (side === 'master' ? 'company' : 'guest')
  const roomPayer: Payer = byBlock ? asPayer(routeOf(block, 'Room')) : split ? 'company' : 'guest'
  // A tax belongs with the thing it was charged on, so it follows the room.
  const payerOf = (category: string): Payer => {
    if (byBlock) return isTaxCategory(category) ? roomPayer : asPayer(routeOf(block, category))
    return split && billTo ? payerFor(category, billTo) : 'guest'
  }
  const lines: FolioLine[] = [
    {
      id: ROOM_LINE,
      label: 'Room charges for the stay',
      note: r.upgrade
        ? `${r.upgrade.to}, free upgrade from ${r.upgrade.from}. Charged at the ${r.upgrade.from} rate.`
        : undefined,
      amount: f.roomCharge,
      payer: roomPayer,
    },
    ...(r.charges ?? []).map((c: FolioCharge) => ({
      id: c.id,
      label: `${c.category}: ${c.description}`,
      note: c.at,
      amount: c.amount,
      payer: payerOf(c.category),
      cancelled: !!c.reversedBy,
    })),
  ]

  const sum = (side: Payer) => lines.filter((l) => l.payer === side).reduce((n, l) => n + l.amount, 0)
  const companyTotal = split ? sum('company') : 0
  const guestTotal = split ? sum('guest') : f.total

  return {
    split,
    billTo,
    accountName,
    company: { lines: lines.filter((l) => l.payer === 'company'), total: companyTotal },
    guest: { lines: lines.filter((l) => l.payer === 'guest'), total: guestTotal },
    paid: f.paid,
    // A payment at the desk always comes from the guest, so it only ever reduces their side.
    guestBalance: guestTotal - f.paid,
    companyBalance: companyTotal,
  }
}

export const BILL_TO_SUMMARY: Record<BillTo, string> = {
  'company-all': 'The company settles everything on this stay.',
  'company-room': 'The company settles the room and its taxes. The guest settles what they use.',
  guest: 'The guest settles the whole bill themselves.',
}
