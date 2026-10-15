import type { Unsubscribe } from '../types'
import type {
  AccountStatus,
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
  /** Anyone at the desk can ask for a new account. It waits for a manager and has no credit. */
  requestAccount(input: NewAccountInput, actor: CorporateActor): Promise<CorporateAccount>
  /** One manager sign-off. The person who requested the account cannot approve it. */
  approveAccount(id: string, note: string, actor: CorporateActor): Promise<CorporateAccount>
  declineAccount(id: string, reason: string, actor: CorporateActor): Promise<CorporateAccount>
  setStatus(id: string, status: Exclude<AccountStatus, 'pending' | 'declined'>, reason: string, actor: CorporateActor): Promise<CorporateAccount>
  /** Credit is a separate decision from opening the account. Only the hotel's credit approver can give it. */
  setCredit(id: string, creditLimit: number, paymentTerms: PaymentTerms, reason: string, policy: CorporatePolicy, actor: CorporateActor): Promise<CorporateAccount>
  updateBilling(id: string, billing: BillingInstructions, actor: CorporateActor): Promise<CorporateAccount>
  saveContact(id: string, contact: Omit<CorporateContact, 'id'> & { id?: string }, actor: CorporateActor): Promise<CorporateAccount>
  /** Prices. A manager sets them; every change is logged with its reason. */
  saveAgreement(id: string, agreement: CorporateAgreement, reason: string, actor: CorporateActor): Promise<CorporateAccount>
  subscribe(listener: () => void): Unsubscribe
}
