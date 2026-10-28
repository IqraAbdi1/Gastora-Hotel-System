import type { ApprovalRecord } from '../../lib/approvals'
import { ugx } from '../../lib/format'
import type { Reservation } from '../../types'
import type { ItemChange, LossReport, Movement, PurchaseOrder, SupplyRequest } from '../procurement/requestsModel'
import type { AuditInput } from '../../services/security/securityTypes'

// Turns the records the rest of the app already keeps into audit entries. Each entry carries a stable
// source reference, so sealing the same record twice never writes it twice.

/** Sample records mix "2025-10-20 14:30" and full ISO times; the log keeps ISO. */
export function toIso(at: string): string {
  // A bare date is the hotel's local day, not midnight UTC.
  const t = Date.parse(at.length <= 10 ? `${at}T00:00` : at.includes('T') ? at : at.replace(' ', 'T'))
  return Number.isNaN(t) ? new Date(0).toISOString() : new Date(t).toISOString()
}

export function fromReservations(list: Reservation[]): AuditInput[] {
  const out: AuditInput[] = []
  for (const r of list) {
    const key = `${r.id} ${r.guest}`
    if (r.bookedAt)
      out.push({
        sourceRef: `book:${r.id}`,
        at: toIso(r.bookedAt),
        actorName: r.source === 'online' ? 'Booking page' : r.source === 'ota' ? 'Channel import' : 'Front desk',
        category: 'reservations',
        tableName: 'gst_desk.reservations',
        op: 'I',
        rowKey: key,
        summary: `Booked ${r.roomType}, ${r.arrival} to ${r.departure}`,
        after: ugx(r.total),
        amount: r.total,
      })
    if (r.checkedOutAt)
      out.push({
        sourceRef: `checkout:${r.id}`,
        at: toIso(r.checkedOutAt),
        actorName: 'Front desk',
        category: 'folios',
        tableName: 'gst_desk.folios',
        op: 'U',
        rowKey: key,
        summary: r.unpaidAtCheckout ? 'Checked out with a balance' : 'Checked out, folio settled',
        before: 'Open',
        after: r.unpaidAtCheckout ? `Closed, ${ugx(r.unpaidAtCheckout)} owed` : `Closed, paid ${ugx(r.paid)}`,
        amount: r.paid,
      })
    for (const a of r.changes ?? []) {
      out.push({
        sourceRef: `amend:${r.id}:${a.at}`,
        at: toIso(a.at),
        actorName: 'Front desk',
        category: 'reservations',
        tableName: 'gst_desk.reservations',
        op: 'U',
        rowKey: key,
        summary: `Dates changed${a.reason ? `: ${a.reason}` : ''}`,
        before: `${a.fromArrival} to ${a.fromDeparture}`,
        after: `${a.toArrival} to ${a.toDeparture}${a.fee ? ` (fee ${a.waived ? 'waived' : ugx(a.fee)})` : ''}`,
        amount: a.waived ? undefined : a.fee || undefined,
      })
    }
    const c = r.cancellation
    if (c) {
      out.push({
        sourceRef: `cancel:${r.id}`,
        at: toIso(c.at),
        actorName: 'Front desk',
        category: 'reservations',
        tableName: 'gst_desk.reservations',
        op: 'U',
        rowKey: key,
        summary: `${c.kind === 'no-show' ? 'No-show' : 'Cancelled'}${c.reason ? `: ${c.reason}` : ''}`,
        before: 'Booked',
        after: c.kind === 'no-show' ? 'No-show' : 'Cancelled',
        amount: c.charge || undefined,
      })
      if (c.refund > 0)
        out.push({
          sourceRef: `refund:${r.id}`,
          at: toIso(c.at),
          actorName: 'Front desk',
          category: 'refunds',
          tableName: 'gst_billing.refunds',
          op: 'I',
          rowKey: key,
          summary: 'Deposit refunded on cancellation',
          before: `Paid ${ugx(r.paid + c.refund)}`,
          after: `Refunded ${ugx(c.refund)}`,
          amount: c.refund,
        })
    }
    for (const ch of r.charges ?? []) {
      if (ch.reverses) {
        const orig = r.charges?.find((x) => x.id === ch.reverses)
        out.push({
          sourceRef: `reverse:${r.id}:${ch.id}`,
          at: toIso(ch.at),
          actorName: ch.approvedBy ?? 'Front desk',
          category: 'voids',
          tableName: 'gst_desk.folio_lines',
          op: 'I',
          rowKey: key,
          summary: `Charge reversed: ${orig?.description ?? ch.description}${ch.reason ? ` (${ch.reason})` : ''}`,
          before: ugx(Math.abs(orig?.amount ?? ch.amount)),
          after: 'Reversed',
          amount: Math.abs(ch.amount),
        })
      } else {
        out.push({
          sourceRef: `charge:${r.id}:${ch.id}`,
          at: toIso(ch.at),
          actorName: 'Front desk',
          category: 'folios',
          tableName: 'gst_desk.folio_lines',
          op: 'I',
          rowKey: key,
          summary: `${ch.category}: ${ch.description}`,
          after: ugx(ch.amount),
          amount: ch.amount,
        })
      }
    }
    for (const p of r.payments ?? []) {
      out.push({
        sourceRef: `pay:${r.id}:${p.id}`,
        at: toIso(p.at),
        actorName: 'Front desk',
        category: 'folios',
        tableName: 'gst_billing.payments',
        op: 'I',
        rowKey: key,
        summary: `Payment by ${p.method}${p.reference ? ` (${p.reference})` : ''}`,
        after: ugx(p.amount),
        amount: p.amount,
      })
    }
    if (r.promo && r.promo.saved > 0)
      out.push({
        sourceRef: `promo:${r.id}`,
        at: toIso(r.bookedAt ?? r.arrival),
        actorName: r.source === 'online' ? 'Booking page' : 'Front desk',
        category: 'discounts',
        tableName: 'gst_desk.reservations',
        op: 'I',
        rowKey: key,
        summary: `Promo code ${r.promo.code}`,
        before: ugx(r.total + r.promo.saved),
        after: ugx(r.total),
        amount: r.promo.saved,
      })
    if (r.overrideReason)
      out.push({
        sourceRef: `override:${r.id}`,
        at: toIso(r.bookedAt ?? r.arrival),
        actorName: 'Front desk',
        category: 'rates',
        tableName: 'gst_desk.reservations',
        op: 'U',
        rowKey: key,
        summary: `Rate overridden: ${r.overrideReason}`,
        after: ugx(r.total),
      })
    if (r.upgrade)
      out.push({
        sourceRef: `upgrade:${r.id}`,
        at: toIso(r.upgrade.at),
        actorName: 'Front desk',
        category: 'reservations',
        tableName: 'gst_desk.reservations',
        op: 'U',
        rowKey: key,
        summary: `Free upgrade: ${r.upgrade.reason}`,
        before: r.upgrade.from,
        after: r.upgrade.to,
      })
    for (const m of r.moves ?? [])
      out.push({
        sourceRef: `move:${r.id}:${m.at}`,
        at: toIso(m.at),
        actorName: m.by,
        category: 'reservations',
        tableName: 'gst_desk.reservations',
        op: 'U',
        rowKey: key,
        summary: `Room move: ${m.reason}`,
        before: m.from,
        after: m.to,
      })
    if (r.invoice)
      out.push({
        sourceRef: `invoice:${r.invoice.number}`,
        at: toIso(r.invoice.issuedAt),
        actorName: 'Front desk',
        category: 'accounting',
        tableName: 'gst_billing.invoices',
        op: 'I',
        rowKey: r.invoice.number,
        summary: `Invoice issued to ${r.guest}`,
        after: ugx(r.invoice.amount),
        amount: r.invoice.amount,
      })
  }
  return out
}

export function fromApprovals(records: ApprovalRecord[]): AuditInput[] {
  return records.map((a) => ({
    sourceRef: `approval:${a.id}`,
    at: toIso(a.at),
    actorName: a.approvers.map((p) => p.name).join(' + ') || a.requestedBy,
    category: a.kind === 'charge-reversal' ? 'refunds' : 'folios',
    tableName: 'gst_desk.approvals',
    op: 'I',
    rowKey: a.reservationId ?? a.id,
    summary: `${a.kind === 'charge-reversal' ? 'Reversal approved' : 'Release approved'}: ${a.what}`,
    before: `Asked by ${a.requestedBy}`,
    after: a.reason,
    amount: a.amount,
  }))
}

export function fromStock(input: { requests: SupplyRequest[]; movements: Movement[]; itemLog: ItemChange[]; losses: LossReport[]; orders: PurchaseOrder[] }): AuditInput[] {
  const out: AuditInput[] = []
  for (const r of input.requests)
    r.history.forEach((h, i) =>
      out.push({
        sourceRef: `req:${r.id}:${i}`,
        at: toIso(h.at),
        actorName: h.by,
        category: 'stock',
        tableName: 'gst_stock.supply_requests',
        op: i === 0 ? 'I' : 'U',
        rowKey: `${r.id} ${r.department}`,
        summary: h.text,
      }),
    )
  for (const m of input.movements)
    out.push({
      sourceRef: `mov:${m.id}`,
      at: toIso(m.at),
      actorName: m.by,
      category: 'stock',
      tableName: 'gst_stock.movements',
      op: 'I',
      rowKey: m.item,
      summary: `${m.kind}${m.reason ? `: ${m.reason}` : ''}`,
      after: `${m.qty > 0 && m.kind === 'Adjusted' ? '+' : ''}${m.qty}`,
      amount: m.cost ? Math.abs(m.qty) * m.cost : undefined,
    })
  for (const c of input.itemLog)
    out.push({
      sourceRef: `item:${c.id}`,
      at: toIso(c.at),
      actorName: c.by,
      category: 'stock',
      tableName: 'gst_stock.items',
      op: 'U',
      rowKey: c.item,
      summary: `Item ${c.field} changed`,
      before: c.from,
      after: c.to,
    })
  for (const l of input.losses)
    out.push({
      sourceRef: `loss:${l.id}`,
      at: toIso(l.at),
      actorName: l.by,
      category: 'stock',
      tableName: 'gst_stock.losses',
      op: 'I',
      rowKey: l.item,
      summary: `Write-off (${l.reason})${l.note ? `: ${l.note}` : ''}`,
      after: `${l.qty} ${l.unit}, ${l.status}`,
      amount: l.qty * l.unitCost,
    })
  for (const o of input.orders)
    out.push({
      sourceRef: `po:${o.id}`,
      at: toIso(o.createdAt),
      actorName: o.by,
      category: 'accounting',
      tableName: 'gst_stock.purchase_orders',
      op: 'I',
      rowKey: o.id,
      summary: `Purchase order to ${o.supplier}`,
      after: ugx(o.total),
      amount: o.total,
    })
  return out
}
