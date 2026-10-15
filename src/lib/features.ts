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

export type PlanId = 'starter' | 'standard' | 'large'
export type TenantStatus = 'active' | 'overdue' | 'suspended'
export type FeatureMap = Record<FeatureKey, boolean>
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
    ],
  },
]

export function planHas(plan: PlanId, key: FeatureKey): boolean {
  const p = PLANS.find((x) => x.id === plan)
  return p ? p.features.includes(key) : false
}

/** Hotel size for company accounts. Set by the platform admin. */
export type CompanySize = 'small' | 'medium' | 'large'

export interface Tenant {
  id: string
  name: string
  rooms: number
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

export interface HotelOptions {
  inspectionMode: 'spot' | 'every'
  spotPercent: number
  /** Spot-check only: a room with a guest arriving today is always inspected. */
  alwaysInspectArrivals: boolean
  /** A room the front desk rushed goes straight to ready. */
  skipRushed: boolean
}

export const DEFAULT_OPTIONS: HotelOptions = {
  inspectionMode: 'spot',
  spotPercent: 20,
  alwaysInspectArrivals: true,
  skipRushed: true,
}

export const SAMPLE_TENANTS: Tenant[] = [
  { id: 't1', name: 'Lakeview Grand Hotel', rooms: 120, plan: 'large', status: 'active', overrides: {}, companySize: 'large' },
  { id: 't2', name: 'Mbale Town Inn', rooms: 18, plan: 'starter', status: 'active', overrides: {}, companySize: 'small' },
  { id: 't3', name: 'Savannah Lodge', rooms: 45, plan: 'standard', status: 'overdue', overrides: {}, companySize: 'medium' },
]