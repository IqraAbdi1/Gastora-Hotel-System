import type { CorporateAccount, CorporateContact, CorporatePolicy, PricingRule } from '../services/corporate/corporateTypes'
import type { BillTo, CorporateBooking, GuaranteeType, Reservation, Room } from '../types'
import { stayTotal } from './booking'
import { checkRules, creditPosition, initialBillingStatus, quote, selectionProblem, STATUS_LABEL, stampNow } from './corporate'
import type { CreditPosition, Quote, RuleCheck } from './corporate'

/** What the person making the booking has chosen on the company side. */
export type CompanyInput = {
  accountId: string
  /** "" when the booker is not on the company's list. */
  bookerContactId: string
  bookerName: string
  bookerPhone: string
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
  withinCredit: boolean
  billingStatus: CorporateBooking['billing']['status']
  /** Stop the booking. */
  errors: string[]
  /** What will happen next, shown before confirming. */
  notes: string[]
}

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

  // 1. The account itself.
  if (account.status !== 'active') {
    errors.push(
      `${account.name} is ${STATUS_LABEL[account.status].toLowerCase()}. It cannot be used for bookings. Book the guest privately, or ask a manager.`,
    )
  }

  // 2. The booker.
  if (!booker) {
    if (!input.bookerName.trim()) errors.push('Enter who is making the booking for the company.')
    else if (policy.bookerMustBeListed) {
      errors.push(`${input.bookerName.trim()} is not on ${account.name}'s list of people who can book. The company must add them first.`)
    } else {
      notes.push(`${input.bookerName.trim()} is not on the company's list. Verify them by calling the company, or with written authorisation, before arrival.`)
    }
  }

  // Prices.
  const checks = checkRules(account, stay.roomType, stay.arrival, stay.departure, stay.nights)
  const usable = new Set(checks.filter((c) => c.ok).map((c) => c.rule.id))
  const selected = (account.agreement?.rules ?? []).filter((r) => input.ruleIds.includes(r.id) && usable.has(r.id))
  const problem = selectionProblem(account, selected)
  if (problem) errors.push(problem)
  const q = quote(stay.roomType, stay.planId, stay.nights, selected)
  const normalTotal = stayTotal(stay.roomType, stay.planId, stay.nights)
  const chargedTotal = selected.length && !q.needsApproval ? q.finalTotal : normalTotal
  if (q.needsApproval) notes.push('This company price needs a manager to approve it. The normal price is charged until then.')

  // 4. Billing. (3, the guest's ID, is checked at check-in.)
  const credit = creditPosition(account, reservations)
  const withinCredit = account.creditLimit > 0 && chargedTotal <= credit.available
  const billingStatus = initialBillingStatus(policy, input.billTo, !!booker, withinCredit)
  if (input.billTo !== 'guest') {
    if (billingStatus === 'approved') {
      notes.push('Billing to the company is approved: booked by an authorised contact and within the credit limit.')
    } else {
      const why =
        account.creditLimit <= 0
          ? 'The company has no credit with the hotel.'
          : !withinCredit
            ? `This stay is over the company's available credit (UGX ${Math.max(0, credit.available).toLocaleString('en-US')}).`
            : policy.bookingApproval === 'always'
              ? 'The hotel needs the company to approve every booking.'
              : 'The booker still has to be verified.'
      notes.push(`${why} Billing stays pending until a company approver confirms it. The guest is not guaranteed by the company until then.`)
    }
    if (account.billing.poRequired) notes.push("The company's LPO number will be needed to approve billing.")
  }

  return { account, booker, checks, selected, quote: q, normalTotal, chargedTotal, credit, withinCredit, billingStatus, errors, notes }
}

/** The company record saved on the reservation, plus the total and guarantee that follow from it. */
export function companyBookingRecord(plan: CompanyPlan, input: CompanyInput, staff: string): {
  corporate: CorporateBooking
  total: number
  guarantee?: GuaranteeType
} {
  const now = stampNow()
  const { account, booker, selected, quote: q } = plan
  const billingApproved = plan.billingStatus === 'approved'
  const corporate: CorporateBooking = {
    accountId: account.id,
    accountName: account.name,
    booker: booker
      ? { contactId: booker.id, name: booker.name, phone: booker.phone, status: 'verified', method: 'authorised-list', by: staff, at: now }
      : { name: input.bookerName.trim(), phone: input.bookerPhone.trim() || undefined, status: 'pending' },
    billTo: input.billTo,
    billing: billingApproved
      ? { status: 'approved', by: staff, at: now, note: 'Authorised booker within the credit limit (hotel rule).' }
      : { status: plan.billingStatus },
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
    log: [{ at: now, by: staff, action: `Booked for ${account.name}${booker ? ` by ${booker.name}` : ` by ${input.bookerName.trim()} (not on list)`}` }],
  }
  return { corporate, total: plan.chargedTotal, guarantee: billingApproved && input.billTo !== 'guest' ? 'company' : undefined }
}
