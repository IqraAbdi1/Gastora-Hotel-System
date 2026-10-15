import type { Unsubscribe } from '../types'
import type {
  AccountStatus,
  ApprovalStep,
  BillingInstructions,
  CorporateAccount,
  CorporateActor,
  CorporateAgreement,
  CorporateContact,
  CorporatePolicy,
  NewAccountInput,
  PaymentTerms,
} from './corporateTypes'

// What the screens need from company accounts. Every change takes the actor, because the backend
// must check permissions and record who did it. The mock does the same checks so the prototype
// behaves like the real thing, but browser checks alone are never enough in production.
export interface CorporateService {
  listAccounts(): Promise<CorporateAccount[]>
  /** Anyone at the desk can ask for a new account; it starts "pending" and has no credit. */
  requestAccount(input: NewAccountInput, policy: CorporatePolicy, actor: CorporateActor): Promise<CorporateAccount>
  approveAccount(
    id: string,
    step: ApprovalStep,
    grant: { note?: string; creditLimit?: number; paymentTerms?: PaymentTerms },
    policy: CorporatePolicy,
    actor: CorporateActor,
  ): Promise<CorporateAccount>
  declineAccount(id: string, reason: string, actor: CorporateActor): Promise<CorporateAccount>
  setStatus(id: string, status: Exclude<AccountStatus, 'pending' | 'declined'>, reason: string, actor: CorporateActor): Promise<CorporateAccount>
  setCredit(id: string, creditLimit: number, paymentTerms: PaymentTerms, reason: string, policy: CorporatePolicy, actor: CorporateActor): Promise<CorporateAccount>
  updateBilling(id: string, billing: BillingInstructions, actor: CorporateActor): Promise<CorporateAccount>
  saveContact(id: string, contact: Omit<CorporateContact, 'id'> & { id?: string }, actor: CorporateActor): Promise<CorporateAccount>
  saveAgreement(id: string, agreement: CorporateAgreement, reason: string, actor: CorporateActor): Promise<CorporateAccount>
  /** The hotel's stored policy, or null to use the default for its plan. */
  getPolicy(): Promise<CorporatePolicy | null>
  setPolicy(policy: CorporatePolicy, actor: CorporateActor): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}
