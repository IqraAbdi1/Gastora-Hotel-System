// Uganda hotel taxes. Pure rules, no screens. Switched on per hotel by the platform admin (feature "taxLines").
// Rule: VAT 18% on accommodation. Rule: Local Hotel Tax (LHT) is separate from the room rate and is collected from the guest.
// Estimate: the LHT bands below follow the KCCA Local Hotel Tax FAQ. Each hotel must confirm its band with its own council.

/** Do the room rates already contain VAT, or is VAT added on top? */
export type VatMode = 'included' | 'added'

/** Which Local Hotel Tax band the hotel is in. "byRate" is for hotels without a star rating: the nightly rate decides. */
export type LhtBand = 'star45' | 'star23' | 'byRate'

/** A tax the hotel adds itself, for example a tourism levy or a city fee. Always added on top of the room charge. */
export type CustomTaxKind = 'percent' | 'perNight' | 'perStay'

export interface CustomTax {
  id: string
  name: string
  kind: CustomTaxKind
  /** A percentage of the room charge, or an amount in UGX. */
  value: number
  on: boolean
}

export const CUSTOM_KIND_LABEL: Record<CustomTaxKind, string> = {
  percent: '% of the room charge',
  perNight: 'UGX per night',
  perStay: 'UGX per stay',
}

/** Is the hotel sending its invoices to URA EFRIS? Chosen by the hotel admin or owner. */
export type EfrisStatus = 'registered' | 'exempt' | 'notSet'

export interface EfrisSettings {
  status: EfrisStatus
  tin: string
  legalName: string
  /** The EFRIS device number URA gave the hotel. */
  deviceNo: string
  /** Why the hotel is exempt. Printed on its invoices. */
  exemptReason: string
}

export const DEFAULT_EFRIS: EfrisSettings = { status: 'notSet', tin: '', legalName: '', deviceNo: '', exemptReason: '' }

export interface TaxSettings {
  vatOn: boolean
  lhtOn: boolean
  custom: CustomTax[]
  efris: EfrisSettings
  vatRate: number
  vatMode: VatMode
  lhtBand: LhtBand
  /** UGX for 1 US dollar. Used only for the 4 and 5 star band, which is charged in dollars. */
  usdRate: number
  /** Service charge as a percentage of the room charge. 0 means the hotel does not charge one. */
  servicePercent: number
}

export const DEFAULT_TAX: TaxSettings = {
  vatOn: true,
  lhtOn: true,
  custom: [],
  efris: DEFAULT_EFRIS,
  vatRate: 0.18,
  vatMode: 'included',
  lhtBand: 'byRate',
  usdRate: 3700,
  servicePercent: 0,
}

export const LHT_BAND_LABEL: Record<LhtBand, string> = {
  star45: '4 and 5 star',
  star23: '2 and 3 star',
  byRate: 'No star rating (by nightly rate)',
}

export const LHT_BAND_NOTE: Record<LhtBand, string> = {
  star45: 'US$ 2 per room per night, charged in shillings at the rate set below.',
  star23: 'UGX 2,000 per room per night.',
  byRate: 'Over UGX 50,000: 2,000. UGX 10,000 to 50,000: 1,000. Under UGX 10,000: 500. Per room per night.',
}

/** Category names used on the folio, so tax lines can be told apart from guest extras. */
export const TAX_CATEGORY = 'Tax'
export const SERVICE_CATEGORY = 'Service charge'
export const isTaxCategory = (c: string) => c === TAX_CATEGORY || c === SERVICE_CATEGORY

/** Local Hotel Tax for one room for one night. */
export function lhtPerNight(s: TaxSettings, nightlyRate: number): number {
  if (s.lhtBand === 'star45') return Math.round(2 * s.usdRate)
  if (s.lhtBand === 'star23') return 2000
  if (nightlyRate > 50000) return 2000
  if (nightlyRate >= 10000) return 1000
  return 500
}

export interface TaxLine {
  key: 'lht' | 'service' | 'vat' | 'custom'
  label: string
  amount: number
  /** Folio category the line is posted under. */
  category: string
}

export interface StayTaxes {
  /** Lines added on top of the room charge and posted to the folio at check-in. */
  onTop: TaxLine[]
  onTopTotal: number
  /** VAT that is already inside the room charge. Shown, never added again. Zero when VAT is added on top. */
  vatInside: number
}

const NONE: StayTaxes = { onTop: [], onTopTotal: 0, vatInside: 0 }

/** The taxes for one room for the whole stay. `roomCharge` is what the booking says the room costs. */
export function stayTaxes(s: TaxSettings | null, roomCharge: number, nights: number): StayTaxes {
  if (!s || nights < 1 || roomCharge <= 0) return NONE
  const onTop: TaxLine[] = []

  const lht = s.lhtOn ? lhtPerNight(s, roomCharge / nights) * nights : 0
  if (lht > 0) onTop.push({ key: 'lht', label: `Local Hotel Tax (${nights} night${nights === 1 ? '' : 's'})`, amount: lht, category: TAX_CATEGORY })

  const service = s.servicePercent > 0 ? Math.round((roomCharge * s.servicePercent) / 100) : 0
  if (service > 0) onTop.push({ key: 'service', label: `Service charge ${s.servicePercent}%`, amount: service, category: SERVICE_CATEGORY })

  for (const c of s.custom) {
    if (!c.on || !c.name.trim() || c.value <= 0) continue
    const amount =
      c.kind === 'percent' ? Math.round((roomCharge * c.value) / 100) : c.kind === 'perNight' ? Math.round(c.value * nights) : Math.round(c.value)
    if (amount > 0) onTop.push({ key: 'custom', label: c.name.trim(), amount, category: TAX_CATEGORY })
  }

  let vatInside = 0
  if (!s.vatOn) {
    vatInside = 0
  } else if (s.vatMode === 'added') {
    const vat = Math.round((roomCharge + service) * s.vatRate)
    if (vat > 0) onTop.push({ key: 'vat', label: `VAT ${Math.round(s.vatRate * 100)}%`, amount: vat, category: TAX_CATEGORY })
  } else {
    vatInside = vatInsideOf(roomCharge, s.vatRate)
  }

  return { onTop, onTopTotal: onTop.reduce((n, l) => n + l.amount, 0), vatInside }
}

/** The VAT part of an amount that already contains VAT. */
export function vatInsideOf(gross: number, rate: number) {
  return Math.round((gross * rate) / (1 + rate))
}
