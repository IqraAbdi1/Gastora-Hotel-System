import type { Reservation } from '../types'

// Lost and found. Housekeeping logs what they pick up; the front desk matches it to the guest who asks for it
// and records who collected it. Rules, not AI: an item is matched by where and when it was found, never by guesswork.
export type LostStatus = 'held' | 'returned' | 'disposed'

export const LOST_CATEGORIES = [
  'Phone or tablet',
  'Laptop or charger',
  'Clothing',
  'Jewellery or watch',
  'Documents or ID',
  'Money or cards',
  'Bag',
  'Keys',
  'Toiletries',
  'Other',
]

/** Valuables are kept in the safe and need a manager to release them. */
export const VALUABLE_CATEGORIES = ['Phone or tablet', 'Laptop or charger', 'Jewellery or watch', 'Documents or ID', 'Money or cards']
export const isValuable = (category: string) => VALUABLE_CATEGORIES.includes(category)

/** Default hold. Each hotel sets its own in Hotel settings. */
export const KEEP_DAYS = 90

export interface LostItem {
  id: string
  /** What it is, in the finder's words. */
  description: string
  category: string
  /** Room number, or a place such as "Restaurant" or "Pool". */
  foundIn: string
  /** Extra detail about the spot: "under the bed", "in the bathroom". */
  foundWhere: string
  foundOn: string
  foundBy: string
  photo?: string
  /** Where it is being kept now, such as "Housekeeping store" or "Front desk safe". */
  storedAt: string
  status: LostStatus
  /** Set when the item is handed over. */
  release?: {
    at: string
    /** Who collected it. Proof the hotel gave it to the right person. */
    name: string
    idType: string
    idNumber: string
    phone: string
    /** Set when someone else collects for the guest. */
    onBehalfOf?: string
    signature?: string
    releasedBy: string
    approvedBy?: string
    /** The stay it was matched to, when the guest was found in the system. */
    reservationId?: string
  }
  /** Why it was thrown away or given to charity. */
  disposal?: { at: string; by: string; reason: string }
  notes?: string
}

export type NewLostItem = Omit<LostItem, 'id' | 'status' | 'release' | 'disposal'>

/** Stays that had this room around the day the item was found. This is how the desk checks a guest's claim. */
export function staysForItem(item: LostItem, reservations: Reservation[]): Reservation[] {
  return reservations
    .filter((r) => r.room === item.foundIn && r.arrival <= item.foundOn && r.departure >= item.foundOn)
    .sort((a, b) => b.departure.localeCompare(a.departure))
}

/** Items that could be what a guest is describing. Matched on the room, on words, and on the date they stayed. */
export function searchItems(
  items: LostItem[],
  opts: { room?: string; text?: string; from?: string; to?: string },
): LostItem[] {
  const text = (opts.text ?? '').trim().toLowerCase()
  return items.filter((i) => {
    if (opts.room && opts.room.trim() && i.foundIn.toLowerCase() !== opts.room.trim().toLowerCase()) return false
    if (opts.from && i.foundOn < opts.from) return false
    if (opts.to && i.foundOn > opts.to) return false
    if (!text) return true
    return `${i.description} ${i.category} ${i.foundIn} ${i.foundWhere} ${i.notes ?? ''}`.toLowerCase().includes(text)
  })
}

export function daysHeld(item: LostItem, today: string) {
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.foundOn}T00:00:00Z`)) / 86400000))
}
