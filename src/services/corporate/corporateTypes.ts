import type { RoleId } from '../../lib/roles'
import type { BillTo, Room } from '../../types'
import type { Actor } from '../types'

/** The person acting, with their role, so the service can check what they may do (as the backend will). */
export type CorporateActor = Actor & { role: RoleId }

export type AccountStatus = 'pending' | 'active' | 'on-hold' | 'suspended' | 'closed' | 'declined'

/** When the company pays. "prepaid" and "on-departure" mean no credit is given. */
export type PaymentTerms = 'prepaid' | 'on-departure' | 'net-15' | 'net-30' | 'net-60'

export interface CorporateContact {
  id: string
  name: string
  jobTitle: string
  phone: string
  email: string
  /** May make bookings for the company. */
  canBook: boolean
  /** May approve charges to the company account. A different right from booking. */
  canApproveCharges: boolean
  active: boolean
}

/**
 * One price rule from the company's agreement.
 * negotiated-rate: the room costs `value` per night instead of the normal rate.
 * percent: `value`% off the room rate. amount-off: `value` UGX off the room rate per night.
 */
export interface PricingRule {
  id: string
  label: string
  kind: 'negotiated-rate' | 'percent' | 'amount-off'
  value: number
  roomTypes: Room['type'][]
  validFrom: string
  validTo: string
  minNights?: number
  /** A manager must approve it on each booking before it is charged. */
  requiresApproval: boolean
}

export interface CorporateAgreement {
  reference: string
  validFrom: string
  validTo: string
  rules: PricingRule[]
  /** Only when the signed agreement says so may a discount be added on top of a negotiated rate. */
  allowDiscountOnNegotiatedRate: boolean
  notes: string
}

export interface BillingInstructions {
  defaultBillTo: BillTo
  invoiceEmail: string
  /** The company's purchase order (LPO) number must be quoted on each booking. */
  poRequired: boolean
  instructions: string
}

export type ApprovalStep = 'manager' | 'finance'

export interface ApprovalRecord {
  step: ApprovalStep
  by: Actor
  at: string
  note?: string
}

/** Audit trail. The backend keeps the real one; this is the prototype's copy. */
export interface AccountEvent {
  at: string
  by: Actor
  action: string
  detail?: string
}

/** Hotel size, which sets the company rules. Defined with the hotel record. */
export type { CompanySize } from '../../lib/features'

export interface CorporateAccount {
  id: string
  name: string
  /** Uganda Revenue Authority tax number. */
  tin: string
  industry: string
  address: string
  phone: string
  email: string
  status: AccountStatus
  statusReason?: string
  paymentTerms: PaymentTerms
  /** 0 = no credit: the company pays before or at departure. */
  creditLimit: number
  /** What the requester asked for. Only an approver can turn it into an actual limit. */
  requestedCreditLimit?: number
  /** Unpaid invoices. In the real system this comes from accounts receivable; here it is a sample figure. */
  outstandingBalance: number
  billing: BillingInstructions
  contacts: CorporateContact[]
  agreement?: CorporateAgreement
  /** Approvals needed to open the account, fixed when it was requested. */
  requiredSteps: ApprovalStep[]
  approvals: ApprovalRecord[]
  createdAt: string
  createdBy: Actor
  history: AccountEvent[]
}

export interface NewAccountInput {
  name: string
  tin: string
  industry: string
  address: string
  phone: string
  email: string
  paymentTerms: PaymentTerms
  requestedCreditLimit: number
  billing: BillingInstructions
  contacts: Omit<CorporateContact, 'id'>[]
}

/**
 * The company rules for one hotel. Set by the platform admin from the hotel's size, not by the hotel.
 * Small hotels keep it simple, medium hotels add finance and checks, large hotels add call-backs and listed bookers.
 */
import type { CompanySize } from '../../lib/features'

export interface CorporatePolicy {
  size: CompanySize
  /** Who sets credit limits. Only this role can give a company credit. Account approval is always a manager's. */
  creditApprover: ApprovalStep
  /** Only people on the company's authorised list may book. Otherwise the guest must be verified by call-back or written authorisation. */
  bookerMustBeListed: boolean
  /** The company must be called back on the number in our records, not the number the guest gives. */
  callbackRequired: boolean
  /** Companies on invoice terms must send an LPO, even if the company did not ask for it to be recorded. */
  lpoForCreditTerms: boolean
}
