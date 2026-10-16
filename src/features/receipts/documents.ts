import { nightsOf } from '../../lib/booking'
import { folioOf } from '../../lib/folio'
import type { Reservation } from '../../types'
import { receiptTitle } from '../procurement/requestsModel'
import type { PurchaseOrder, Receipt, ReceiptLine } from '../procurement/requestsModel'

export interface DocLine {
  name: string
  unit: string
  qty: number
  unitCost: number
}

/** Everything a printable page needs. Receipts and purchase orders are both turned into this. */
export interface DocView {
  title: string
  number: string
  at: string
  by: string
  hotel: string
  parties: { label: string; value: string }[]
  lines: DocLine[]
  note?: string
  signatures: string[]
}

const SIGNATURES: Record<Receipt['kind'], string[]> = {
  GRN: ['Received by (Storekeeper)', 'Delivered by (Supplier)', 'Checked by'],
  DIRECT: ['Bought by', 'Received into store by'],
  ISSUE: ['Issued by (Storekeeper)', 'Received by (Department)'],
  RETURN: ['Returned by (Department)', 'Received back by (Storekeeper)'],
}

/** On a return note, say when the count differed from what was declared or went above what was issued. */
function lineLabel(l: ReceiptLine, store: boolean): string {
  const bits: string[] = []
  if (store && l.store) bits.push(l.store)
  if (l.declared !== undefined) bits.push(`declared ${l.declared}`)
  if (l.above) bits.push(`+${l.above} above issued`)
  return bits.length ? `${l.name} (${bits.join(', ')})` : l.name
}

export function receiptDoc(r: Receipt, hotel: string): DocView {
  const parties: DocView['parties'] = []
  if (r.supplier) parties.push({ label: 'Supplier', value: r.supplier })
  if (r.department) parties.push({ label: r.kind === 'RETURN' ? 'Returned from' : 'Department', value: r.department })
  if (r.raisedBy) parties.push({ label: 'Raised by (department head)', value: r.raisedBy })
  if (r.handedInBy) parties.push({ label: 'Handed in by', value: r.handedInBy })
  if (r.returnId) parties.push({ label: 'Return request', value: r.returnId })
  if (r.poId) parties.push({ label: 'Purchase order', value: r.poId })
  if (r.requestId) parties.push({ label: 'Request ID', value: r.requestId })
  if (r.reference) parties.push({ label: r.kind === 'GRN' ? 'Delivery note' : 'Supplier receipt', value: r.reference })

  // One store: print it once. Several stores: print the store beside each item.
  const stores = [...new Set(r.lines.map((l) => l.store).filter((s): s is string => !!s))]
  if (stores.length === 1) parties.push({ label: 'Store', value: stores[0] })
  const lines: DocLine[] = r.lines.map((l) => ({ ...l, name: lineLabel(l, stores.length > 1) }))

  const note = [r.note, r.aboveReason ? `Above what was issued: ${r.aboveReason}` : ''].filter(Boolean).join('\n') || undefined

  return {
    title: receiptTitle[r.kind],
    number: r.id,
    at: r.at,
    by: r.by,
    hotel,
    parties,
    lines,
    note,
    signatures: SIGNATURES[r.kind],
  }
}

export function poDoc(
  o: PurchaseOrder,
  hotel: string,
  unitOf: (name: string) => string,
  department?: string,
): DocView {
  const parties: DocView['parties'] = [
    { label: 'Supplier', value: o.supplier },
    { label: 'Request ID', value: o.requestId },
  ]
  if (department) parties.push({ label: 'For department', value: department })
  return {
    title: 'Purchase order',
    number: o.id,
    at: o.createdAt,
    by: o.by,
    hotel,
    parties,
    lines: o.items.map((i) => ({ name: i.name, unit: unitOf(i.name), qty: i.qty, unitCost: i.unitCost })),
    signatures: ['Prepared by (Procurement)', 'Approved by'],
  }
}

// ---- Guest documents ----
// A guest receipt or invoice, built from the folio so the printed copy and the screen always agree.
// Taxes already posted as charges are printed as their own lines, so the guest sees what URA requires.
export function folioDoc(
  r: Reservation,
  hotel: string,
  by: string,
  opts: { vatInside?: number; vatRate?: number } = {},
): DocView {
  const f = folioOf(r)
  const nights = Math.max(1, nightsOf(r.arrival, r.departure))
  const paid = r.status === 'checked-out' || f.balance <= 0

  const lastMove = (r.moves ?? []).filter((m) => m.typeChange).slice(-1)[0]
  const movedNote = lastMove
    ? ` (moved to ${lastMove.typeChange!.to} room ${lastMove.to}${lastMove.free ? ', no extra charge' : ''})`
    : ''

  const lines: DocLine[] = [
    {
      name: r.upgrade
        ? `${r.upgrade.to} room, free upgrade from ${r.upgrade.from} (charged at the ${r.upgrade.from} rate)`
        : `${r.roomType} room${movedNote}`,
      unit: 'night',
      qty: nights,
      unitCost: Math.round(f.roomCharge / nights),
    },
    ...(r.charges ?? []).map((c) => ({
      name: `${c.category}: ${c.description}`,
      unit: 'item',
      qty: 1,
      unitCost: c.amount,
    })),
  ]

  const parties: DocView['parties'] = [
    { label: 'Guest', value: r.guest },
    { label: 'Booking', value: r.id },
    { label: 'Room', value: r.room ? `Room ${r.room}` : r.roomType },
    { label: 'Stay', value: `${r.arrival} to ${r.departure}` },
  ]
  if (r.corporate) parties.push({ label: 'Billed to', value: r.corporate.accountName })
  if (r.invoice?.tin) parties.push({ label: 'Seller TIN', value: r.invoice.tin })
  if (r.invoice?.fiscal === 'efris') {
    parties.push({ label: 'Fiscal document no.', value: r.invoice.fiscalCode })
    if (r.invoice.verification) parties.push({ label: 'Verification code', value: r.invoice.verification })
  }
  if (r.invoice?.fiscal === 'exempt') parties.push({ label: 'EFRIS', value: `Exempt${r.invoice.exemptReason ? `: ${r.invoice.exemptReason}` : ''}` })

  const note = [
    `Paid: UGX ${f.paid.toLocaleString('en-US')}.`,
    f.balance > 0 ? `Balance due: UGX ${f.balance.toLocaleString('en-US')}.` : 'Settled in full. Thank you.',
    opts.vatInside && opts.vatInside > 0
      ? `Includes VAT ${Math.round((opts.vatRate ?? 0.18) * 100)}%: UGX ${opts.vatInside.toLocaleString('en-US')}.`
      : '',
    (r.moves ?? []).length
      ? `Room moves: ${(r.moves ?? []).map((m) => `${m.from} to ${m.to}`).join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    title: r.invoice ? 'Tax invoice' : paid ? 'Guest receipt' : 'Guest folio',
    number: r.invoice?.number ?? r.id,
    at: r.invoice?.issuedAt ? r.invoice.issuedAt.replace(' ', 'T') : new Date().toISOString(),
    by,
    hotel,
    parties,
    lines,
    note,
    signatures: ['Guest', 'Front desk'],
  }
}
