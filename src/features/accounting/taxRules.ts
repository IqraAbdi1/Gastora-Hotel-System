import type { TaxSettings } from '../../lib/tax'
import { LHT_BAND_LABEL, lhtPerNight } from '../../lib/tax'
import type { TaxRule } from '../../services/accounting/accountingTypes'

/** The hotel's tax settings as gst_core.tax_rules rows. The settings themselves stay on Taxes and EFRIS. */
export function taxRulesOf(propertyId: string, s: TaxSettings | null): TaxRule[] {
  if (!s) return []
  const rows: TaxRule[] = [
    { id: `${propertyId}-TX-VAT`, propertyId, code: 'VAT', name: `VAT ${Math.round(s.vatRate * 100)}%`, kind: 'percent', rate: s.vatRate * 100, inclusive: s.vatMode === 'included', active: s.vatOn },
    { id: `${propertyId}-TX-LHT`, propertyId, code: 'LHT', name: `Local Hotel Tax, ${LHT_BAND_LABEL[s.lhtBand]}`, kind: 'fixed', rate: lhtPerNight(s, 100000), inclusive: false, active: s.lhtOn },
  ]
  if (s.servicePercent > 0)
    rows.push({ id: `${propertyId}-TX-SVC`, propertyId, code: 'SVC', name: `Service charge ${s.servicePercent}%`, kind: 'percent', rate: s.servicePercent, inclusive: false, active: true })
  for (const c of s.custom)
    rows.push({ id: `${propertyId}-TX-${c.id}`, propertyId, code: 'TAX-OTHER', name: c.name, kind: c.kind === 'percent' ? 'percent' : 'fixed', rate: c.value, inclusive: false, active: c.on })
  return rows
}
