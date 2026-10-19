// What a repair actually consumed: a fan motor, a tap washer, two litres of oil.
//
// Until a repair draws parts, every machine looks equally cheap to keep, and "what has this generator
// cost us" can only ever answer with what it cost to buy. The parts come out of the real store, not a
// number typed into a box, so the stock that leaves the shelf and the cost on the work order are the
// same event seen from two sides.
//
// Who may do what is the store's rule, not maintenance's: a technician fits the part, the storekeeper
// issues it. So a part recorded by somebody who cannot issue stock is a request, and nothing moves
// until the store confirms it at the counter.
// Pure rules only: no React, no state.

export type UsedPart = {
  id: string
  name: string
  qty: number
  /** Worth of one when it left the store. Only known once it is issued. */
  unitCost?: number
  issued: boolean
  issuedOn?: string
  /** The store issue note this part left on. */
  receiptId?: string
  /** Who put it on the work order. */
  by: string
  /** Who issued it, when that is somebody else. */
  issuedBy?: string
}

export const newPartId = () => `U-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

/**
 * What the repair has cost in parts so far. A part still waiting for the store has cost nothing yet and
 * is not counted: a requisition is not a payment, and a figure that counts it would overstate every
 * open job.
 */
export function partsTotal(parts: UsedPart[] | undefined): number {
  if (!parts) return 0
  return parts.filter((p) => p.issued).reduce((sum, p) => sum + p.qty * (p.unitCost ?? 0), 0)
}

export const issuedParts = (parts: UsedPart[] | undefined) => (parts ?? []).filter((p) => p.issued)
export const waitingParts = (parts: UsedPart[] | undefined) => (parts ?? []).filter((p) => !p.issued)

export type PartProblem = 'no item' | 'unknown item' | 'no quantity' | 'not enough' | null

export const PART_PROBLEM_TEXT: Record<Exclude<PartProblem, null>, string> = {
  'no item': 'Choose the part.',
  'unknown item': 'That is not an item in the store. Ask the store to add it first.',
  'no quantity': 'How many?',
  'not enough': 'The store does not have that many.',
}

/**
 * Why a part cannot go on the work order.
 *
 * Quantity is checked against the shelf only when the part is being issued now. Asking the store for
 * something it has run out of is a reasonable thing to do - that is how it gets ordered - so a request
 * is not refused for being short.
 */
export function partProblem(name: string, qty: number, onHand: number, known: boolean, issuingNow: boolean): PartProblem {
  if (!name.trim()) return 'no item'
  if (!known) return 'unknown item'
  if (!Number.isFinite(qty) || qty <= 0) return 'no quantity'
  if (issuingNow && qty > onHand) return 'not enough'
  return null
}

/** The same part asked for twice is one line, so a work order does not grow a list of ones. */
export function mergeParts(parts: UsedPart[], addition: UsedPart): UsedPart[] {
  const match = parts.find(
    (p) => p.issued === addition.issued && p.name.trim().toLowerCase() === addition.name.trim().toLowerCase(),
  )
  if (!match) return [...parts, addition]
  return parts.map((p) => (p.id === match.id ? { ...p, qty: p.qty + addition.qty } : p))
}

export function partWords(parts: UsedPart[] | undefined): string {
  const issued = issuedParts(parts).length
  const waiting = waitingParts(parts).length
  if (issued === 0 && waiting === 0) return 'None'
  const bits: string[] = []
  if (issued > 0) bits.push(`${issued} used`)
  if (waiting > 0) bits.push(`${waiting} waiting`)
  return bits.join(', ')
}
