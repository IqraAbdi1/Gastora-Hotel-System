import { DEFAULT_AUDIT_AT } from './dayRun'
import { DEFAULT_EXPRESS_MAX } from './expressCheckout'
import { DEFAULT_MESSAGING } from './messages'
import type { MessagingSettings } from './messages'
import { DEFAULT_EFRIS, DEFAULT_TAX } from './tax'
import { DEFAULT_ADD_ONS } from './addOns'
import { DEFAULT_SLA } from './sla'
import type { SlaSettings } from './sla'
import type { AddOn } from './addOns'
import type { TaxSettings } from './tax'
import { LAKEVIEW_SERVICES } from './services'
import type { BookableService } from './services'

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
  | 'waitlist'
  | 'expressCheckout'
  | 'groups'
  | 'roomKeys'
  | 'revenue'
  | 'bookingEngine'
  | 'channels'
  | 'guestValue'
  | 'loyaltyPoints'
  | 'guestPortal'
  | 'serviceBookings'
  | 'assetRegister'
  | 'assetCosts'
  | 'preventiveMaintenance'
  | 'maintenanceParts'
  | 'slaEscalation'
  | 'roomDowntime'
  | 'engineeringDashboard'
  | 'roomCheck'
  | 'hkZones'
  | 'crossProperty'
  | 'roomAutoAssign'
  | 'multiRoom'
  | 'travelAgents'
  // J. Workforce and service management
  | 'staffRoster'
  | 'attendance'
  | 'taskSla'
  | 'payrollHandoff'
  // Area K: management reports
  | 'reportsBasic'
  | 'departmentDashboards'
  | 'scheduledReports'
  | 'portfolio'
  | 'analyticsAssistant'
  // Area M: compliance, security and controls
  | 'securityBasic'
  | 'fieldPermissions'
  | 'sodRules'
  | 'ssoMfa'
  | 'fiscalConnectors'
  // Area I: procurement, inventory and cost control
  | 'rfq'
  | 'invoiceMatching'
  | 'supplierContracts'
  | 'storeTransfers'
  | 'costAnalytics'
  // Area G: events, banqueting and sales
  | 'eventsBasic'
  | 'eventsSales'
  // Area H: Finance and hotel accounting
  | 'accountingLink'
  | 'multiCurrency'
  | 'budgetsCentres'
  | 'groupConsolidation'
  // Area L: AI and automation layer.
  | 'aiConcierge'
  | 'anomalyDetection'
  | 'guestSegments'
  | 'opsPrioritization'
  | 'workflowAutomation'
  // Area F: POS, F&B and kitchen
  | 'posMultiOutlet'
  | 'posFloorPlan'
  | 'posSplitBills'
  | 'kdsCourses'
  | 'foodCost'

export type PlanId = 'starter' | 'standard' | 'large'
export type TenantStatus = 'active' | 'overdue' | 'suspended'
export type FeatureMap = Record<FeatureKey, boolean>
export type NewTenant = Pick<Tenant, 'name' | 'rooms' | 'plan' | 'companySize'> & { registry: TenantRegistry; group?: string }
export type InspectionMode = 'off' | 'spot' | 'every'

export const FEATURES: { key: FeatureKey; label: string; blurb: string }[] = [
  // Area F: POS, F&B and kitchen
  { key: 'posMultiOutlet', label: 'Several outlets', blurb: 'Bar, room service, minibar, pool and shop, each with its own menu and hours.' },
  { key: 'posFloorPlan', label: 'Floor plan', blurb: 'Tables on a plan with live status, table bookings, moving and joining tables.' },
  { key: 'posSplitBills', label: 'Split bills', blurb: 'Split a bill by item, by seat or equally, each part paid its own way.' },
  { key: 'kdsCourses', label: 'Kitchen courses', blurb: 'Hold and fire courses, kitchen stations, prep timers and all-day counts.' },
  { key: 'foodCost', label: 'Food cost', blurb: 'Recipe costing, usage against sales, wastage, transfers and cost % by outlet.' },
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
    key: 'assetRegister',
    label: 'Asset register',
    blurb: 'What the hotel owns: where each machine is, its warranty, and everything that has gone wrong with it.',
  },
  {
    key: 'assetCosts',
    label: 'Equipment cost',
    blurb: 'What each machine cost, what it is worth now, and what it has cost to keep running.',
  },
  {
    key: 'preventiveMaintenance',
    label: 'Planned servicing',
    blurb: 'Service plans per machine, by the calendar or by running hours, raising their own jobs when they come round.',
  },
  {
    key: 'maintenanceParts',
    label: 'Parts on a repair',
    blurb: 'A repair draws its parts from the store, so what a machine costs to keep is real rather than guessed.',
  },
  {
    key: 'slaEscalation',
    label: 'Repair targets',
    blurb: 'How long a repair may take before the supervisor, and then the manager, is told it has not been done.',
  },
  {
    key: 'roomDowntime',
    label: 'Room downtime',
    blurb: 'How long each room has been off sale, and what those nights were worth.',
  },
  {
    key: 'engineeringDashboard',
    label: 'Engineering dashboard',
    blurb: 'What keeps breaking, what each machine costs to keep, and the whole maintenance history.',
  },
  {
    key: 'roomCheck',
    label: 'Room check',
    blurb: 'Walk the floor and compare what is really in each room with what the system believes: sleepers, skips and wrong statuses.',
  },
  {
    key: 'hkZones',
    label: 'Cleaning by zone',
    blurb: 'Each attendant works a floor or part of the hotel, and the day is shared out by minutes of work, not number of rooms, with arriving guests first.',
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
    label: 'Damage and loss',
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
    label: 'Online pre-registration',
    blurb:
      'The guest is sent a link the day before and fills in their own details from their phone. The desk checks what they sent against the ID instead of typing it. Needs guest messages.',
  },
  {
    key: 'waitlist',
    label: 'Waitlist',
    blurb:
      'Guests the hotel had to turn away are kept on a list. When a cancellation frees the room they asked for, the system says whose it is and the desk tells them. A room is offered, never held.',
  },
  {
    key: 'expressCheckout',
    label: 'Express checkout',
    blurb:
      'A guest whose stay is secured by a card or a company account can leave without stopping at the desk. The bill settles itself against that, and a copy is sent to the guest. A guest with only a deposit, or nothing, still settles at the desk.',
  },
  {
    key: 'groups',
    label: 'Groups and blocks',
    blurb:
      'Rooms held under one name for a workshop, a wedding or a tour operator, with a rooming list that can be filled in now or at the desk. Each block says who pays for what, so the bar bill follows the guest even when the room is paid for.',
  },
  {
    key: 'roomKeys',
    label: 'Room keys',
    blurb:
      "The hotel's record of which key opens which room and until when, who cut it and whether it came back. The card itself is written by the door-lock vendor; this is the part that answers who could open a room on a given night.",
  },
  {
    key: 'crossProperty',
    label: 'Sister properties',
    blurb:
      'For an owner with more than one hotel. A property that is full can send the booking to a sister property instead of losing the guest. They see each other\u2019s free rooms and nothing else: not guests, not folios, not takings.',
  },
  {
    key: 'guestPortal',
    label: 'Guest portal',
    blurb:
      "One page a guest opens from the link the hotel sent: their stay, their bill, the form before arrival, anything they want to ask for, and what the hotel can offer them - a better room when one is genuinely free, an early arrival, a later departure, the extras. Nothing is charged until somebody at the desk agrees to it.",
  },
  {
    key: 'serviceBookings',
    label: 'Dining, spa and activities',
    blurb:
      "The hotel lists what a guest can book besides the room - a table at the restaurant, a massage, a boat trip, a city tour - with when it runs and how many it takes. The guest books a time with room left from their own page, the desk confirms it, and a priced one can go on the room bill. Needs the guest portal.",
  },
  {
    key: 'guestValue',
    label: 'Guest value',
    blurb:
      "What a guest has actually paid, over how long, and what they have cost in bookings that fell through and complaints raised. Counted, never projected, and kept to whoever answers for the hotel: a small hotel knows its regulars by face, and a larger one needs the figure.",
  },
  {
    key: 'loyaltyPoints',
    label: 'Points and vouchers',
    blurb:
      "Points earned on what a guest spends, and vouchers they can spend back. Tiers work without this on every plan; points are the part that needs watching, because unspent points are money the hotel owes.",
  },
  {
    key: 'channels',
    label: 'Channel manager',
    blurb:
      "The places a hotel sells other than its own desk and its own site: online travel agents, the global distribution systems, wholesalers. Keeps what each channel may sell and at what price, maps this hotel's room types to the names each channel uses, and takes their bookings back into the desk. The wire itself is a commercial agreement with a channel manager; this is everything on the hotel's side of it.",
  },
  {
    key: 'bookingEngine',
    label: 'Booking page',
    blurb:
      "The hotel's own booking page, which guests open from the hotel's website. It sells under the hotel's own rules - the rate calendar, the closed dates, the real count of free rooms - and never oversells, because overbooking is a decision a person takes. Bookings land at the front desk marked as coming from the hotel's own site, which costs no commission.",
  },
  {
    key: 'revenue',
    label: 'Revenue management',
    blurb:
      "How fast each night ahead is filling, measured against the way this hotel's own past nights filled by the same point. Shows what is on the books, what came in this week, and where a night is likely to finish. It needs the hotel's own history, so a new hotel sees it fill up over its first months.",
  },
  {
    key: 'idScan',
    label: 'ID scanning',
    blurb:
      "The front desk shows a national ID or passport to the camera and the check-in form fills itself from the strip on the card. Every field is checked against the card's own check digits and the receptionist confirms it. A driving permit has no strip and is still typed.",
  },
  {
    key: 'roomAutoAssign',
    label: 'Automatic room assignment',
    blurb:
      "The system proposes a room for every arrival without one: the right type, clean, free every night, the guest's own preferences and last room, the better rooms for VIPs and regulars. The desk sees the plan before anything is assigned, and a room somebody chose by hand is never changed. The hotel can let it run by itself each morning.",
  },
  {
    key: 'multiRoom',
    label: 'Several rooms in one booking',
    blurb:
      'One booker takes several rooms in one go - a family in two rooms, three colleagues - each with its own guest and room type. The rooms share a party reference, can be checked in together or one by one, and can be paid for on one bill.',
  },
  {
    key: 'travelAgents',
    label: 'Travel agents',
    blurb:
      'The tour operators and agents who book through the desk: who they are, their commission, and whether they collect from the guest. Each booking records its agent, and the hotel sees what it owes each one, earned on the room only and only once the stay is completed.',
  },
  // J. Workforce and service management
  { key: 'staffRoster', label: 'Staff, rosters and guest cases', blurb: 'Staff list linked to Trademate HR, weekly rosters and guest service cases.' },
  { key: 'attendance', label: 'Attendance', blurb: 'Clock in and out, late and absent, corrections and timesheets.' },
  { key: 'taskSla', label: 'Tasks with SLA', blurb: 'Tasks across departments with due times, escalation and workload.' },
  { key: 'payrollHandoff', label: 'Payroll handoff', blurb: 'Send each pay period\'s hours and overtime to Trademate payroll.' },
  // Area G: events, banqueting and sales
  { key: 'eventsBasic', label: 'Events and banqueting', blurb: 'Function diary, event bookings, BEOs, equipment and a master bill per event.' },
  { key: 'eventsSales', label: 'Events sales', blurb: 'Lead pipeline, quotes with amendments, contracts, deposits and event profitability.' },
  // Area H: Finance and hotel accounting
  { key: 'accountingLink', label: 'Trademate accounting', blurb: 'Posting rules, daily journals sent to Trademate, and the city ledger.' },
  { key: 'multiCurrency', label: 'Currencies', blurb: 'Foreign currencies, daily exchange rates and tax-inclusive pricing.' },
  { key: 'budgetsCentres', label: 'Budgets and centres', blurb: 'Profit and cost centres with monthly budgets against actuals.' },
  { key: 'groupConsolidation', label: 'Group reporting', blurb: 'One consolidated view across the properties of a group.' },
  // Area L: AI and automation layer.
  { key: 'aiConcierge', label: 'AI concierge', blurb: 'Answers guest questions on their stay page and hands the rest to staff.' },
  { key: 'anomalyDetection', label: 'Forecast and anomalies', blurb: 'Demand forecast, rate suggestions and odd discounts, refunds and voids.' },
  { key: 'guestSegments', label: 'Guest segments', blurb: 'Automatic guest segments and next-best-action suggestions for the desk.' },
  { key: 'opsPrioritization', label: 'Operations priorities', blurb: 'Cleaning order, repair priority and a staffing forecast per department.' },
  { key: 'workflowAutomation', label: 'Workflow automation', blurb: 'Trigger, conditions, approvals, actions and notifications, with a run log.' },
  {
    key: 'taxLines',
    label: 'Tax lines',
    blurb: 'VAT, Local Hotel Tax, service charge and the hotel\'s own taxes are itemised at check-in and on the folio. The hotel admin or owner sets the rates and the EFRIS choice.',
  },
  // Area K: management reports
  { key: 'reportsBasic', label: 'Reports', blurb: 'Executive KPIs with drill-down, the report library and Excel or PDF export.' },
  { key: 'departmentDashboards', label: 'Department dashboards', blurb: 'Front office, F&B, housekeeping, maintenance, sales, purchasing and finance KPIs.' },
  { key: 'scheduledReports', label: 'Scheduled reports', blurb: 'Reports sent by email every day, week or month.' },
  { key: 'portfolio', label: 'Portfolio reporting', blurb: 'Consolidated figures, benchmarks and budget vs actual across sister hotels.' },
  { key: 'analyticsAssistant', label: 'Analytics assistant', blurb: 'Ask questions in plain words and see the records behind each answer.' },
  // Area M: compliance, security and controls
  { key: 'securityBasic', label: 'Security basics', blurb: 'Roles, sessions, devices, audit trail, card tokens, privacy requests and EFRIS.' },
  { key: 'fieldPermissions', label: 'Field and property permissions', blurb: 'Edit rights per role, mask sensitive fields and limit people to some properties.' },
  { key: 'sodRules', label: 'Segregation of duties', blurb: 'Rules for duties one person must not hold together, with a live conflict check.' },
  { key: 'ssoMfa', label: 'SSO and MFA', blurb: 'Two-step sign-in per role and single sign-on through SAML or OIDC.' },
  { key: 'fiscalConnectors', label: 'Fiscal connectors', blurb: 'E-invoicing connectors beyond EFRIS, branch mapping and the submission log.' },
]

// Area I: procurement, inventory and cost control
FEATURES.push(
  { key: 'rfq', label: 'Quotations (RFQ)', blurb: 'Ask approved suppliers to quote, compare side by side and award the order.' },
  { key: 'invoiceMatching', label: 'Invoice matching', blurb: 'Match each supplier invoice to its order and delivery before it is paid.' },
  { key: 'supplierContracts', label: 'Supplier contracts', blurb: 'Contracts, price lists, price history, approved suppliers and scorecards.' },
  { key: 'storeTransfers', label: 'Store transfers', blurb: 'Central, property and outlet stores, transfers between them and pack sizes.' },
  { key: 'costAnalytics', label: 'Cost control', blurb: 'Reorder, slow-moving, expiry, wastage, spend and consumption at a glance.' },
)

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
    features: [
      'requests',
      'stockControl',
      'lossReports',
      'guestMessages',
      'multiRoom',
      'staffRoster',
      'reportsBasic',
      'securityBasic',
      'accountingLink',
    ],
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
      'waitlist',
      'expressCheckout',
      'groups',
      'roomKeys',
      'revenue',
      'bookingEngine',
      'channels',
      'guestValue',
      'loyaltyPoints',
      'guestPortal',
      'serviceBookings',
      'assetRegister',
      'roomDowntime',
      'roomCheck',
      'hkZones',
      'roomAutoAssign',
      'multiRoom',
      'travelAgents',
      // J. Workforce and service management
      'staffRoster',
      'attendance',
      'taskSla',
      'payrollHandoff',
      // Area K: management reports
      'reportsBasic',
      'departmentDashboards',
      'scheduledReports',
      'analyticsAssistant',
      // Area M
      'securityBasic',
      'fieldPermissions',
      'sodRules',
      'fiscalConnectors',
      // Area I
      'invoiceMatching',
      'supplierContracts',
      'storeTransfers',
      'costAnalytics',
      // Area G
      'eventsBasic',
      // Area H
      'accountingLink',
      'multiCurrency',
      'budgetsCentres',
      // Area L
      'aiConcierge',
      'anomalyDetection',
      'guestSegments',
      // Area F: POS, F&B and kitchen
      'posMultiOutlet',
      'posFloorPlan',
      'posSplitBills',
      'kdsCourses',
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
      'waitlist',
      'expressCheckout',
      'groups',
      'roomKeys',
      'revenue',
      'bookingEngine',
      'channels',
      'guestValue',
      'loyaltyPoints',
      'guestPortal',
      'serviceBookings',
      'assetRegister',
      'assetCosts',
      'preventiveMaintenance',
      'maintenanceParts',
      'slaEscalation',
      'roomDowntime',
      'engineeringDashboard',
      'roomCheck',
      'hkZones',
      'crossProperty',
      'roomAutoAssign',
      'multiRoom',
      'travelAgents',
      // J. Workforce and service management
      'staffRoster',
      'attendance',
      'taskSla',
      'payrollHandoff',
      // Area K: management reports
      'reportsBasic',
      'departmentDashboards',
      'scheduledReports',
      'portfolio',
      'analyticsAssistant',
      // Area M
      'securityBasic',
      'fieldPermissions',
      'sodRules',
      'ssoMfa',
      'fiscalConnectors',
      // Area I
      'rfq',
      'invoiceMatching',
      'supplierContracts',
      'storeTransfers',
      'costAnalytics',
      // Area G
      'eventsBasic',
      'eventsSales',
      // Area H
      'accountingLink',
      'multiCurrency',
      'budgetsCentres',
      'groupConsolidation',
      // Area L
      'aiConcierge',
      'anomalyDetection',
      'guestSegments',
      'opsPrioritization',
      'workflowAutomation',
      // Area F: POS, F&B and kitchen
      'posMultiOutlet',
      'posFloorPlan',
      'posSplitBills',
      'kdsCourses',
      'foodCost',
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
  /**
   * The owner this hotel belongs to, when it is one of several. Properties sharing a group can see
   * each other's free rooms and send each other bookings; they share nothing else.
   */
  group?: string
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
  // Area I: quotations, invoices and contracts sit on the supply chain; transfers need stores.
  if (!out.supplyChain) {
    out.rfq = false
    out.invoiceMatching = false
    out.supplierContracts = false
  }
  if (!out.stores) out.storeTransfers = false
  if (!out.stockControl) out.costAnalytics = false
  // Services are booked from the guest's own page, so without the page there is nowhere to book them.
  if (!out.guestPortal) out.serviceBookings = false
  // Area K: every reports feature sits on top of the basic reports.
  if (!out.reportsBasic) {
    out.departmentDashboards = false
    out.scheduledReports = false
    out.portfolio = false
    out.analyticsAssistant = false
  }
  // Area G: selling events needs the diary and BEOs underneath.
  if (!out.eventsBasic) out.eventsSales = false
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
import { DEFAULT_POINTS } from './points'
import { DEFAULT_UPSELL } from './upsell'
import type { UpsellSettings } from './upsell'
import type { PointsSettings } from './points'
import { DEFAULT_LOYALTY } from './loyalty'
import { DEFAULT_AREAS, DEFAULT_SERVICE } from './cleaning'
import type { CleaningArea, ServiceRules } from './cleaning'
import { DEFAULT_AUTO_ASSIGN } from './roomAssign'
import type { AutoAssignSettings } from './roomAssign'
import { SAMPLE_AGENTS } from './agents'
import type { TravelAgent } from './agents'

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
  /** Points earned on room money, and what they are worth when spent. */
  points: PointsSettings
  /** What the hotel offers a guest who is already booked, and at what price. */
  upsell: UpsellSettings
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
  /** The most that may be settled by express checkout with nobody looking at it. 0 means no ceiling. */
  expressMax: number
  /**
   * A guest checking out from their own page on the day is checked out at once, when express checkout
   * allows it. Off, every online checkout waits for one click at the desk.
   */
  guestFinishesCheckout: boolean
  /** Dining, spa and activities a guest can book from their own page. */
  services: BookableService[]
  /** The hour the day closes itself, when the night audit is on. */
  nightAuditAt: string
  /** Extras the hotel sells beside the room, offered on its own booking page. */
  addOns: AddOn[]
  /** How long a repair may take before it goes up to somebody more senior. */
  sla: SlaSettings
  /** Cleaning by zone: new work goes straight to someone, by the same rule as the plan. Off unless chosen. */
  hkAutoAssign: boolean
  /** Whether today's arrivals are given rooms by themselves each morning. Off unless the hotel turns it on. */
  autoAssign: AutoAssignSettings
  /** The travel agents this hotel deals with, and their commission. */
  agents: TravelAgent[]
}

export const DEFAULT_OPTIONS: HotelOptions = {
  limits: DEFAULT_LIMITS,
  keepFoundDays: 90,
  keepGuestMonths: 24,
  nightAudit: true,
  loyalty: DEFAULT_LOYALTY,
  points: DEFAULT_POINTS,
  upsell: DEFAULT_UPSELL,
  rates: DEFAULT_RATES,
  addOns: DEFAULT_ADD_ONS,
  inspectionMode: 'spot',
  spotPercent: 20,
  alwaysInspectArrivals: true,
  skipRushed: true,
  areas: DEFAULT_AREAS,
  service: DEFAULT_SERVICE,
  extraChecks: [],
  messaging: DEFAULT_MESSAGING,
  expressMax: DEFAULT_EXPRESS_MAX,
  guestFinishesCheckout: true,
  services: [],
  nightAuditAt: DEFAULT_AUDIT_AT,
  sla: DEFAULT_SLA,
  hkAutoAssign: false,
  autoAssign: DEFAULT_AUTO_ASSIGN,
  agents: SAMPLE_AGENTS,
}

export const SAMPLE_TENANTS: Tenant[] = [
  { id: 't1', name: 'Lakeview Grand Hotel', rooms: 120, plan: 'large', status: 'active', overrides: {}, companySize: 'large', group: 'Lakeview Hotels' },
  { id: 't2', name: 'Mbale Town Inn', rooms: 18, plan: 'starter', status: 'active', overrides: {}, companySize: 'small' },
  { id: 't3', name: 'Savannah Lodge', rooms: 45, plan: 'standard', status: 'overdue', overrides: {}, companySize: 'medium', group: 'Lakeview Hotels' },
]

/** Starting lists of bookable dining, spa and activities for the sample hotels. Others start with none. */
export const SAMPLE_SERVICES: Record<string, BookableService[]> = { t1: LAKEVIEW_SERVICES }

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
