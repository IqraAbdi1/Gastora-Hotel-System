import { DEFAULT_MESSAGING } from './messages'
import type { MessagingSettings } from './messages'
import { DEFAULT_EFRIS, DEFAULT_TAX } from './tax'
import type { TaxSettings } from './tax'

export type FeatureKey =
  | 'inspections'
  | 'maintenanceFull'
  | 'repairSignoff'
  | 'requests'
  | 'stockControl'
  | 'lossReports'
  | 'stores'
  | 'deptReturns'
  | 'batchExpiry'
  | 'lossReversal'
  | 'supplyChain'
  | 'budgetApproval'
  | 'taxLines'
  | 'idScan'
  | 'guestMessages'
  | 'preRegistration'

export type PlanId = 'starter' | 'standard' | 'large'
export type TenantStatus = 'active' | 'overdue' | 'suspended'
export type FeatureMap = Record<FeatureKey, boolean>
export type NewTenant = Pick<Tenant, 'name' | 'rooms' | 'plan' | 'companySize'> & { registry: TenantRegistry }
export type InspectionMode = 'off' | 'spot' | 'every'

export const FEATURES: { key: FeatureKey; label: string; blurb: string }[] = [
  {
    key: 'inspections',
    label: 'Room inspections',
    blurb: 'A supervisor checks cleaned rooms before they are ready.',
  },
  {
    key: 'maintenanceFull',
    label: 'Full maintenance',
    blurb: 'Priorities, due times, technicians, out of order vs out of service.',
  },
  {
    key: 'repairSignoff',
    label: 'Repair sign-off',
    blurb: 'A finished repair is verified before the room returns to sale.',
  },
  {
    key: 'requests',
    label: 'Supply requests',
    blurb: 'Staff ask for supplies; management replies Bought or Not now.',
  },
  {
    key: 'stockControl',
    label: 'Stock control',
    blurb: 'Items, receipts, issues, returns, reorder alerts and stock counts, with printable receipts.',
  },
  {
    key: 'lossReports',
    label: 'Damaged and lost',
    blurb: 'Staff report broken, damaged, expired or lost stock. The manager reviews it.',
  },
  {
    key: 'stores',
    label: 'Several stores',
    blurb: 'Split stock into named stores such as Main, Housekeeping and Engineering. Each item lives in one store.',
  },
  {
    key: 'deptReturns',
    label: 'Department returns',
    blurb: 'A department head sends unused stock back. The storekeeper counts it in and both names go on the return note.',
  },
  {
    key: 'batchExpiry',
    label: 'Batches and expiry',
    blurb: 'Items such as food and chemicals are received with an expiry date. The earliest date is issued first and expired stock is blocked.',
  },
  {
    key: 'lossReversal',
    label: 'Reverse write-offs',
    blurb: 'The general manager can dispute a write-off and put the stock back. The owner sees a reversal watch.',
  },
  {
    key: 'supplyChain',
    label: 'Store and purchasing',
    blurb: 'Head endorses, the store is checked, then requisition, purchase order, goods received and issue.',
  },
  {
    key: 'budgetApproval',
    label: 'Budget check and approval',
    blurb: 'Department budgets, costed requisitions and Finance approval when over budget.',
  },
  {
    key: 'guestMessages',
    label: 'Guest messages',
    blurb:
      'The system writes the messages a stay needs \u2014 booking confirmed, deposit reminder, room ready, before checkout \u2014 in the hotel\u2019s own wording, and the desk sends them. The hotel can let them go by themselves.',
  },
  {
    key: 'preRegistration',
    label: 'Fill in before arrival',
    blurb:
      'The guest is sent a link the day before and fills in their own details from their phone. The desk checks what they sent against the ID instead of typing it. Needs guest messages.',
  },
  {
    key: 'idScan',
    label: 'Read the ID',
    blurb:
      "The front desk shows a national ID or passport to the camera and the check-in form fills itself from the strip on the card. Every field is checked against the card's own check digits and the receptionist confirms it. A driving permit has no strip and is still typed.",
  },
  {
    key: 'taxLines',
    label: 'Tax lines',
    blurb: 'VAT, Local Hotel Tax, service charge and the hotel\'s own taxes are itemised at check-in and on the folio. The hotel admin or owner sets the rates and the EFRIS choice.',
  },
]

export const PLANS: {
  id: PlanId
  label: string
  blurb: string
  features: FeatureKey[]
}[] = [
  {
    id: 'starter',
    label: 'Starter',
    blurb: 'Small hotels. Core, simple supply requests and basic stock control.',
    features: ['requests', 'stockControl', 'lossReports'],
  },
  {
    id: 'standard',
    label: 'Standard',
    blurb: 'Inspections, the supply chain, several stores, department returns, expiry dates and write-off reversal.',
    features: [
      'inspections',
      'requests',
      'stockControl',
      'lossReports',
      'stores',
      'deptReturns',
      'batchExpiry',
      'lossReversal',
      'supplyChain',
      'taxLines',
      'idScan',
      'guestMessages',
      'preRegistration',
    ],
  },
  {
    id: 'large',
    label: 'Large',
    blurb: 'Everything.',
    features: [
      'inspections',
      'maintenanceFull',
      'repairSignoff',
      'requests',
      'stockControl',
      'lossReports',
      'stores',
      'deptReturns',
      'batchExpiry',
      'lossReversal',
      'supplyChain',
      'budgetApproval',
      'taxLines',
      'idScan',
      'guestMessages',
      'preRegistration',
    ],
  },
]

export function planHas(plan: PlanId, key: FeatureKey): boolean {
  const p = PLANS.find((x) => x.id === plan)
  return p ? p.features.includes(key) : false
}

/** Hotel size for company accounts. Set by the platform admin. */
export type CompanySize = 'small' | 'medium' | 'large'

/** What Gastora records about a hotel when it signs up. */
export interface TenantRegistry {
  /** Trading name if it differs from the one on the certificate. */
  legalName?: string
  tin?: string
  /** Tourism board or trading licence number. */
  licenceNumber?: string
  stars?: number
  town?: string
  address?: string
  phone?: string
  email?: string
  /** Who Gastora talks to at the hotel. */
  contactName?: string
  contactRole?: string
  contactPhone?: string
  contactEmail?: string
  /** When they signed up, and when billing starts. */
  joinedOn?: string
  billingStartsOn?: string
  notes?: string
}

export interface Tenant {
  id: string
  name: string
  rooms: number
  registry?: TenantRegistry
  plan: PlanId
  status: TenantStatus
  /** The company rules for this hotel, chosen from its size. The hotel cannot change it. */
  companySize: CompanySize
  /** Platform admin overrides on top of the plan. */
  overrides: Partial<Record<FeatureKey, boolean>>
}

/** What this hotel can actually use right now. */
export function featuresOf(t: Tenant): FeatureMap {
  const out = {} as FeatureMap
  for (const f of FEATURES) {
    out[f.key] = t.overrides[f.key] ?? planHas(t.plan, f.key)
  }
  if (!out.requests || !out.stockControl) out.supplyChain = false
  if (!out.supplyChain) out.budgetApproval = false
  // Stores, damaged and lost, department returns and expiry dates are part of stock control. Reversal is part of damaged and lost.
  if (!out.stockControl) {
    out.stores = false
    out.lossReports = false
    out.deptReturns = false
    out.batchExpiry = false
  }
  if (!out.lossReports) out.lossReversal = false
  if (t.status === 'suspended') {
    for (const f of FEATURES) out[f.key] = false
  }
  return out
}

import type { ApprovalLimits } from './approvals'
import { DEFAULT_LIMITS } from './approvals'
import type { RatesPolicy } from './rates'
import { DEFAULT_RATES } from './rates'
import type { LoyaltySettings } from './loyalty'
import { DEFAULT_LOYALTY } from './loyalty'
import { DEFAULT_AREAS, DEFAULT_SERVICE } from './cleaning'
import type { CleaningArea, ServiceRules } from './cleaning'

export interface HotelOptions {
  inspectionMode: 'spot' | 'every'
  spotPercent: number
  /** Spot-check only: a room with a guest arriving today is always inspected. */
  alwaysInspectArrivals: boolean
  /** A room the front desk rushed goes straight to ready. */
  skipRushed: boolean
  /** Who may approve money coming off a folio, and up to how much. */
  limits: ApprovalLimits
  /** How long lost property is kept before it may be disposed of. */
  keepFoundDays: number
  /**
   * How long a guest's profile is kept after their last stay. The stays, the ID record and the
   * invoices are kept far longer because the law requires it; this is only the profile.
   */
  keepGuestMonths: number
  /** The hotel can switch the night audit off if it does not close the day that way. */
  nightAudit: boolean
  /** Tiers and rewards for guests who come back. Every hotel sets its own. */
  loyalty: LoyaltySettings
  /** The hotel's own prices and booking rules. Company prices are separate, on each company account. */
  rates: RatesPolicy
  /** Corridors, the lobby, the pool: everything cleaned that is not a room. */
  areas: CleaningArea[]
  /** How a room with a guest still in it is serviced. */
  service: ServiceRules
  /** Checklist items the hotel has added itself, offered to the attendant from then on. */
  extraChecks: string[]
  /** The hotel's own wording for the messages a stay needs, and how they go out. */
  messaging: MessagingSettings
}

export const DEFAULT_OPTIONS: HotelOptions = {
  limits: DEFAULT_LIMITS,
  keepFoundDays: 90,
  keepGuestMonths: 24,
  nightAudit: true,
  loyalty: DEFAULT_LOYALTY,
  rates: DEFAULT_RATES,
  inspectionMode: 'spot',
  spotPercent: 20,
  alwaysInspectArrivals: true,
  skipRushed: true,
  areas: DEFAULT_AREAS,
  service: DEFAULT_SERVICE,
  extraChecks: [],
  messaging: DEFAULT_MESSAGING,
}

export const SAMPLE_TENANTS: Tenant[] = [
  { id: 't1', name: 'Lakeview Grand Hotel', rooms: 120, plan: 'large', status: 'active', overrides: {}, companySize: 'large' },
  { id: 't2', name: 'Mbale Town Inn', rooms: 18, plan: 'starter', status: 'active', overrides: {}, companySize: 'small' },
  { id: 't3', name: 'Savannah Lodge', rooms: 45, plan: 'standard', status: 'overdue', overrides: {}, companySize: 'medium' },
]

/** Starting tax rules for the sample hotels. After this the hotel admin or owner changes them. */
export const SAMPLE_TAX: Record<string, TaxSettings> = {
  t1: {
    ...DEFAULT_TAX,
    vatMode: 'included',
    lhtBand: 'star45',
    efris: { ...DEFAULT_EFRIS, status: 'registered', tin: '1000123456', legalName: 'Lakeview Grand Hotel Ltd', deviceNo: 'TCS-0042' },
  },
  t3: {
    ...DEFAULT_TAX,
    vatMode: 'added',
    lhtBand: 'star23',
    servicePercent: 5,
    efris: { ...DEFAULT_EFRIS, status: 'exempt', exemptReason: 'Not VAT registered. Below the registration threshold.' },
  },
}
