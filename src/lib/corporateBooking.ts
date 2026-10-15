import type { CorporateAccount, CorporateContact, CorporatePolicy, PricingRule } from '../services/corporate/corporateTypes'
import type { BillTo, CorporateBooking, GuaranteeType, Reservation, Room } from '../types'
import { stayTotal } from './booking'
import { checkRules, creditPosition, needsLpo, offersCredit, quote, selectionProblem, STATUS_LABEL, stampNow } from './corporate'
import type { CreditPosition, Quote, RuleCheck } from './corporate'

/** What the person making the booking has chosen on the company side. Nothing here is verified yet. */
export type CompanyInput = {
  accountId: string
  /** "" when the booker is not on the company's list. */
  bookerContactId: string
  bookerName: string
  bookerPhone: string
  /** The LPO number the guest or booker gave at booking, if any. Checked against the company at check-in. */
  claimedLpo: string
  billTo: BillTo
  ruleIds: string[]
}

export type CompanyPlan = {
  account: CorporateAccount
  booker?: CorporateContact
  checks: RuleCheck[]
  selected: PricingRule[]
  quote: Quote
  /** The stay total without company prices. */
  normalTotal: number
  /** What the booking will be charged now. Prices that need approval are not charged until approved. */
  chargedTotal: number
  credit: CreditPosition
  /** Credit this stay would use beyond what the company has. 0 when it fits, or when the company pays on departure. */
  overCreditBy: number
  billingStatus: CorporateBooking['billing']['status']
  /** Stop the booking. */
  errors: string[]
  /** What will happen next, shown before confirming. Nothing is confirmed at booking. */
  notes: string[]
}

// At booking we only record what the company side claims. Verification happens at check-in, when the
// staff member can see the guest: the guest's link to the company, the LPO and who approves the charges.
export function planCompanyBooking(
  input: CompanyInput,
  account: CorporateAccount,
  policy: CorporatePolicy,
  reservations: Reservation[],
  stay: { roomType: Room['type']; planId: string; arrival: string; departure: string; nights: number },
): CompanyPlan {
  const errors: string[] = []
  const notes: string[] = []
  const booker = account.contacts.find((c) => c.id === input.bookerContactId && c.active && c.canBook)

  if (account.status !== 'active') {
    errors.push(
      `${account.name} is ${STATUS_LABEL[account.status].toLowerCase()}. It cannot be used for bookings. Book the guest privately, or ask a manager.`,
    )
  }

  if (!booker) {
    if (!input.bookerName.trim()) errors.push('Enter who is making the booking for the company.')
    else if (policy.bookerMustBeListed) {
      errors.push(`${input.bookerName.trim()} is not on ${account.name}'s list of people who can book. The company must add them first.`)
    } else {
      notes.push(`${input.bookerName.trim()} is not on the company's list. They will be checked at check-in.`)
    }
  }

  const checks = checkRules(account, stay.roomType, stay.arrival, stay.departure, stay.nights)
  const usable = new Set(checks.filter((c) => c.ok).map((c) => c.rule.id))
  const selected = (account.agreement?.rules ?? []).filter((r) => input.ruleIds.includes(r.id) && usable.has(r.id))
  const problem = selectionProblem(account, selected)
  if (problem) errors.push(problem)
  const q = quote(stay.roomType, stay.planId, stay.nights, selected)
  const normalTotal = stayTotal(stay.roomType, stay.planId, stay.nights)
  const chargedTotal = selected.length && !q.needsApproval ? q.finalTotal : normalTotal
  if (q.needsApproval) notes.push('This company price needs a manager to approve it. The normal price is charged until then.')

  let overCreditBy = 0
  let billingStatus: CorporateBooking['billing']['status'] = 'not-required'
  if (input.billTo !== 'guest') {
    billingStatus = 'pending'
    const credit = creditPosition(account, reservations)
    if (offersCredit(account.paymentTerms)) {
      overCreditBy = Math.max(0, chargedTotal - credit.available)
    }
    notes.push('Billing to the company is confirmed at check-in, when the guest arrives.')
    if (overCreditBy > 0) {
      notes.push(`This stay is over the company's available credit by ${overCreditBy.toLocaleString('en-US')} UGX. ${policy.creditApprover === 'finance' ? 'Finance' : 'A manager'} must approve it before check-in.`)
    }
    if (needsLpo(account, policy) && !input.claimedLpo.trim()) {
      notes.push('This company needs an LPO. Record its number now if it has been given, or the company must send it before check-in.')
    }
  }

  return {
    account,
    booker,
    checks,
    selected,
    quote: q,
    normalTotal,
    chargedTotal,
    credit: creditPosition(account, reservations),
    overCreditBy,
    billingStatus,
    errors,
    notes,
  }
}

/** The company record saved on the reservation. Booker and billing are both still pending until check-in. */
export function companyBookingRecord(plan: CompanyPlan, input: CompanyInput, staff: string): {
  corporate: CorporateBooking
  total: number
  guarantee?: GuaranteeType
} {
  const now = stampNow()
  const { account, booker, selected, quote: q } = plan
  const corporate: CorporateBooking = {
    accountId: account.id,
    accountName: account.name,
    booker: booker
      ? { contactId: booker.id, name: booker.name, phone: booker.phone, status: 'pending' }
      : { name: input.bookerName.trim(), phone: input.bookerPhone.trim() || undefined, status: 'pending' },
    billTo: input.billTo,
    billing: {
      status: plan.billingStatus,
      claimedLpo: input.claimedLpo.trim() || undefined,
    },
    pricing: selected.length
      ? {
          ruleIds: selected.map((r) => r.id),
          labels: selected.map((r) => r.label),
          nights: q.nights,
          perNightOriginal: q.perNightOriginal,
          perNightFinal: q.perNightFinal,
          originalTotal: q.originalTotal,
          finalTotal: q.finalTotal,
          status: q.needsApproval ? 'pending' : 'applied',
        }
      : undefined,
    log: [{ at: now, by: staff, action: `Booked for ${account.name} by ${booker ? booker.name : input.bookerName.trim()} (to confirm at check-in)` }],
  }
  // Company-billed stays are guaranteed by the company only once it has confirmed at check-in.
  return { corporate, total: plan.chargedTotal, guarantee: input.billTo !== 'guest' ? 'none' : undefined }
}
