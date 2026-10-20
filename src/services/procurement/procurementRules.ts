import type { ContractStatus, InvoiceMatch, MatchResult, PoContext, SupplierContract, SupplierInvoiceLine } from './procurementTypes'

// Rules shared by the mock and the screens. The backend applies the same ones.

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Three-way match: each invoice line against the order line and what was accepted into the store.
 * Price: an invoice price above the order price by more than the tolerance is a variance.
 * Quantity: billing for more than was accepted (beyond the tolerance) is a variance.
 */
export function matchLines(
  invoiceId: string,
  lines: SupplierInvoiceLine[],
  po: PoContext,
  priceTolerancePct: number,
  qtyTolerancePct: number,
  at: string,
): InvoiceMatch[] {
  return lines.map((l, i) => {
    const p = po.lines.find((x) => same(x.itemName, l.itemName))
    const poQty = p?.qty ?? 0
    const poUnitPrice = p?.unitPrice ?? 0
    const receivedQty = p?.receivedQty ?? 0
    const priceVariancePct = poUnitPrice > 0 ? round1(((l.unitPrice - poUnitPrice) / poUnitPrice) * 100) : 100
    const qtyVariance = l.qty - receivedQty
    const priceBad = !p || priceVariancePct > priceTolerancePct
    const qtyBad = !p || l.qty > receivedQty * (1 + qtyTolerancePct / 100)
    const result: MatchResult = priceBad && qtyBad ? 'both' : priceBad ? 'price' : qtyBad ? 'qty' : 'ok'
    return {
      id: `${invoiceId}-M${i + 1}`,
      invoiceId,
      lineNo: i + 1,
      itemName: l.itemName,
      poQty,
      poUnitPrice,
      receivedQty,
      invoicedQty: l.qty,
      invoicedUnitPrice: l.unitPrice,
      priceVariancePct,
      qtyVariance,
      result,
      at,
    }
  })
}

/** Money the variance is worth: billed above order price, plus billed for goods not accepted. */
export function varianceValue(m: InvoiceMatch): number {
  const price = Math.max(0, m.invoicedUnitPrice - m.poUnitPrice) * Math.min(m.invoicedQty, m.receivedQty)
  const qty = Math.max(0, m.qtyVariance) * m.invoicedUnitPrice
  return Math.round(price + qty)
}

const today = () => new Date().toISOString().slice(0, 10)

export function contractStatus(c: SupplierContract, on = today()): ContractStatus {
  if (c.endedAt) return 'ended'
  if (c.startsOn > on) return 'upcoming'
  if (c.endsOn < on) return 'expired'
  return 'active'
}

/** Whole days until the contract ends. Negative once it has ended. */
export function daysToEnd(c: SupplierContract, now = Date.now()) {
  return Math.ceil((new Date(`${c.endsOn}T23:59:59`).getTime() - now) / 86_400_000)
}
