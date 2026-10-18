import { planFor } from './booking'
import { addDays } from './availability'
import { roleCan } from './roles'
import type { RoleId } from './roles'
import { roomRate } from '../data/rates'
import { roomTotalFor } from './rateCalendar'
import type { RatesPolicy } from './rates'
import type {
  AccountStatus,
  ApprovalStep,
  CorporateAccount,
  CorporateContact,
  CompanySize,
  CorporatePolicy,
  PaymentTerms,
  PricingRule,
} from '../services/corporate/corporateTypes'
import type { BillTo, CorporateBooking, Reservation, Room } from '../types'

// Company account rules in one place, with no React and no sample data, so the same checks can be
// read by staff, reused by the API version, and compared with what the backend enforces.

// ---------- Company rules by hotel size ----------
// Set by the platform admin per hotel. Every hotel uses the same account system; the size only changes how strict it is.
// A small hotel keeps the front desk in charge. A medium hotel adds finance for credit and an LPO. A large hotel also
// requires listed bookers and a call-back to the company before any stay is billed to it.

export const POLICY_PRESETS: Record<CompanySize, CorporatePolicy> = {
  small: { size: 'small', creditApprover: 'manager', bookerMustBeListed: false, callbackRequired: false, lpoForCreditTerms: false },
  medium: { size: 'medium', creditApprover: 'finance', bookerMustBeListed: false, callbackRequired: false, lpoForCreditTerms: true },
  large: { size: 'large', creditApprover: 'finance', bookerMustBeListed: true, callbackRequired: true, lpoForCreditTerms: true },
}

export const SIZE_LABEL: Record<CompanySize, string> = {
  small: 'Small hotel',
  medium: 'Medium hotel',
  large: 'Large hotel',
}

/** Account approval is always one manager sign-off. Finance is only involved when credit is given. */
export const ACCOUNT_APPROVAL: ApprovalStep[] = ['manager']

export const STEP_LABEL: Record<ApprovalStep, string> = { manager: 'Manager', finance: 'Finance' }

/** Who can sign off each step. Owners can do either, but never both steps on the same account. */
export function canSignStep(role: RoleId, step: ApprovalStep) {
  return roleCan(role, step === 'manager' ? 'approveCorporateManager' : 'approveCorporateFinance')
}

export const canSetCredit = (role: RoleId, policy: CorporatePolicy) => canSignStep(role, policy.creditApprover)

/** Does this company need an LPO for this stay? The company can ask for one, and the hotel's rules can require one for invoice terms. */
export function needsLpo(a: CorporateAccount, policy: CorporatePolicy) {
  return a.billing.poRequired || (policy.lpoForCreditTerms && offersCredit(a.paymentTerms))
}
/** Changing agreements and approving price exceptions is a manager's call. */
export const canChangePricing = (role: RoleId) => roleCan(role, 'approveCorporateManager')

// ---------- Separation of duties at the company ----------
// The person who books a stay must not be the person who approves the company paying for it.
// So one contact is either a booker or a charge approver, never both, and on each booking the
// approver must be a different person from the booker.

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Why a contact's rights are not allowed, or null if they are. */
export function contactRightsProblem(c: Pick<CorporateContact, 'canBook' | 'canApproveCharges'>): string | null {
  if (c.canBook && c.canApproveCharges) {
    return 'One person cannot both book and approve charges. Add the approver as a separate contact.'
  }
  return null
}

/** Why this contact may not approve billing for a stay they booked, or null if they may. */
export function approverProblem(approver: CorporateContact, booker: { contactId?: string; name: string }): string | null {
  if ((booker.contactId && approver.id === booker.contactId) || sameName(approver.name, booker.name)) {
    return `${approver.name} made this booking, so they cannot also approve the charges. Another company approver must confirm it.`
  }
  return null
}

export function missingSteps(a: CorporateAccount): ApprovalStep[] {
  return a.requiredSteps.filter((s) => !a.approvals.some((x) => x.step === s))
}

// ---------- Labels ----------

export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Awaiting approval',
  active: 'Active',
  'on-hold': 'On hold',
  suspended: 'Suspended',
  closed: 'Closed',
  declined: 'Declined',
}

export const TERMS_LABEL: Record<PaymentTerms, string> = {
  prepaid: 'Pay before arrival',
  'on-departure': 'Pay at departure',
  'net-15': 'Invoice, 15 days',
  'net-30': 'Invoice, 30 days',
  'net-60': 'Invoice, 60 days',
}

export const BILL_TO_LABEL: Record<BillTo, string> = {
  'company-all': 'Company pays everything',
  'company-room': 'Company pays room and meals, guest pays extras',
  guest: 'Guest pays',
}

export const offersCredit = (t: PaymentTerms) => t.startsWith('net-')

// ---------- Credit ----------

/** Company-billed stays that still hold credit: approved for billing and not finished or cancelled. */
function openCompanyStays(accountId: string, reservations: Reservation[], ignoreId?: string) {
  return reservations.filter(
    (r) =>
      r.id !== ignoreId &&
      r.corporate?.accountId === accountId &&
      r.corporate.billTo !== 'guest' &&
      r.corporate.billing.status === 'approved' &&
      (r.status === 'booked' || r.status === 'in-house'),
  )
}

export type CreditPosition = { limit: number; outstanding: number; committed: number; available: number }

export function creditPosition(a: CorporateAccount, reservations: Reservation[], ignoreId?: string): CreditPosition {
  const committed = openCompanyStays(a.id, reservations, ignoreId).reduce((s, r) => s + r.total, 0)
  return {
    limit: a.creditLimit,
    outstanding: a.outstandingBalance,
    committed,
    available: a.creditLimit - a.outstandingBalance - committed,
  }
}

// ---------- Pricing ----------

/** The last night of a stay is the day before departure. */
const lastNight = (departure: string) => addDays(departure, -1)

export type RuleCheck = { rule: PricingRule; ok: boolean; reason?: string }

export function checkRules(
  a: CorporateAccount,
  roomType: Room['type'],
  arrival: string,
  departure: string,
  nights: number,
): RuleCheck[] {
  const ag = a.agreement
  if (!ag) return []
  return ag.rules.map((rule) => {
    const no = (reason: string) => ({ rule, ok: false, reason })
    if (a.status !== 'active') return no(`Account is ${STATUS_LABEL[a.status].toLowerCase()}.`)
    if (arrival < ag.validFrom || lastNight(departure) > ag.validTo) return no(`Agreement covers ${ag.validFrom} to ${ag.validTo}.`)
    if (arrival < rule.validFrom || lastNight(departure) > rule.validTo) return no(`Valid ${rule.validFrom} to ${rule.validTo}.`)
    if (!rule.roomTypes.includes(roomType)) return no(`Only for ${rule.roomTypes.join(', ')}.`)
    if (rule.minNights && nights < rule.minNights) return no(`Needs ${rule.minNights} nights or more.`)
    return { rule, ok: true }
  })
}

/** Why a set of rules cannot be used together, or null if it can. */
export function selectionProblem(a: CorporateAccount, rules: PricingRule[]): string | null {
  const rates = rules.filter((r) => r.kind === 'negotiated-rate')
  const discounts = rules.filter((r) => r.kind !== 'negotiated-rate')
  if (rates.length > 1) return 'Only one negotiated rate can apply.'
  if (discounts.length > 1) return 'Only one discount can apply. Discounts are never added together.'
  if (rates.length && discounts.length && !a.agreement?.allowDiscountOnNegotiatedRate) {
    return "The agreement does not allow a discount on top of the negotiated rate. The negotiated rate is already the company's price."
  }
  return null
}

export type Quote = {
  nights: number
  roomOriginal: number
  roomFinal: number
  /** Meal plan per night. Company prices apply to the room only; the plan is charged at the normal price. */
  planExtra: number
  perNightOriginal: number
  perNightFinal: number
  originalTotal: number
  finalTotal: number
  discountTotal: number
  needsApproval: boolean
}

// Negotiated rate first (it replaces the room price), then at most one discount on top if allowed.
//
// The hotel's own price comes through the rate calendar when the dates are known, so a company without
// an agreed rate pays the December price in December like anybody else. A negotiated rate is a flat
// nightly figure by definition: that is what the company signed for, and it does not move with a season.
export function quote(
  roomType: Room['type'],
  planId: string,
  nights: number,
  rules: PricingRule[],
  rates?: RatesPolicy,
  dates?: { arrival: string; departure: string },
): Quote {
  const n = Math.max(1, nights)
  const planExtra = planFor(planId, rates).extraPerNight
  const roomTotalOriginal =
    rates && dates
      ? roomTotalFor(roomType, dates.arrival, dates.departure, rates)
      : (rates?.roomRates[roomType] ?? roomRate[roomType]) * n
  const tidy = (x: number) => Math.max(0, Math.round(x / 100) * 100)

  let roomTotalFinal = roomTotalOriginal
  const rate = rules.find((r) => r.kind === 'negotiated-rate')
  if (rate) roomTotalFinal = rate.value * n
  const discount = rules.find((r) => r.kind !== 'negotiated-rate')
  if (discount?.kind === 'percent') roomTotalFinal = roomTotalFinal * (1 - discount.value / 100)
  if (discount?.kind === 'amount-off') roomTotalFinal = roomTotalFinal - discount.value * n
  roomTotalFinal = tidy(roomTotalFinal)

  // Per-night figures are an average once a stay crosses a season boundary, and the totals are the truth.
  const roomOriginal = Math.round(roomTotalOriginal / n)
  const roomFinal = Math.round(roomTotalFinal / n)
  const originalTotal = roomTotalOriginal + planExtra * n
  const finalTotal = roomTotalFinal + planExtra * n
  return {
    nights,
    roomOriginal,
    roomFinal,
    planExtra,
    perNightOriginal: roomOriginal + planExtra,
    perNightFinal: roomFinal + planExtra,
    originalTotal,
    finalTotal,
    discountTotal: originalTotal - finalTotal,
    needsApproval: rules.some((r) => r.requiresApproval),
  }
}

export function ruleText(r: PricingRule) {
  if (r.kind === 'negotiated-rate') return `UGX ${r.value.toLocaleString('en-US')} per night`
  if (r.kind === 'percent') return `${r.value}% off the room rate`
  return `UGX ${r.value.toLocaleString('en-US')} off per night`
}

// ---------- Booking checks ----------

export type CheckState = 'ok' | 'pending' | 'failed' | 'not-required'
export type BookingChecks = { account: CheckState; booker: CheckState; guestId: CheckState; billing: CheckState; pricing: CheckState }

const fromStatus = (s: string): CheckState =>
  s === 'verified' || s === 'approved' || s === 'applied' ? 'ok' : s === 'not-required' ? 'not-required' : s === 'pending' ? 'pending' : 'failed'

/** The state of all four checks (plus pricing) for one company booking, right now. */
export function bookingChecks(r: Reservation, account: CorporateAccount | undefined): BookingChecks {
  const c = r.corporate as CorporateBooking
  return {
    account: account?.status === 'active' ? 'ok' : 'failed',
    booker: fromStatus(c.booker.status),
    // The guest's ID is recorded at check-in, so until then it is still to do.
    guestId: r.details ? 'ok' : 'pending',
    billing: fromStatus(c.billing.status),
    pricing: c.pricing ? fromStatus(c.pricing.status) : 'not-required',
  }
}

/** True if anything about the company side still needs a person to act before arrival. */
export function companyChecksPending(r: Reservation) {
  const c = r.corporate
  if (!c) return false
  return c.booker.status === 'pending' || c.billing.status === 'pending' || c.pricing?.status === 'pending'
}

/**
 * Why a company-billed stay cannot be checked in at all, or null. Only the account itself is checked here.
 * The booker, the LPO and the credit are confirmed in the check-in window, where staff can see the guest.
 */
export function checkInBlock(r: Reservation, account: CorporateAccount | undefined): string | null {
  const c = r.corporate
  if (!c || c.billTo === 'guest') return null
  if (!account || account.status !== 'active') {
    return `${c.accountName} is ${account ? STATUS_LABEL[account.status].toLowerCase() : 'not found'}, so this stay cannot be billed to it. Choose "Guest pays instead" to take payment from the guest.`
  }
  return null
}

export const stampNow = () => new Date().toISOString().slice(0, 16).replace('T', ' ')
