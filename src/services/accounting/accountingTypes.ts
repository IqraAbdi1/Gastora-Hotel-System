import type { RoleId } from '../../lib/roles'
import type { Actor } from '../types'

// Hotel accounting records. Gastora keeps the hotel side (business dates, the night audit, posting
// rules, journal batches, city ledger transfers, rates and budgets); Trademate keeps the books.
// Names follow the database tables: gst_finance, gst_billing, gst_core and gst_integration.

/** The person acting, with their role, so the service can check what they may do (as the backend will). */
export type AccountingActor = Actor & { role: RoleId }

/** A logged step on a record: who did what, when. */
export interface AccountingEvent {
  at: string
  by: Actor
  action: string
  detail?: string
}

// ---------- gst_finance ----------

export type BusinessDateStatus = 'open' | 'closed' | 'reopened'

/** gst_finance.business_dates: one row per trading day of a property. */
export interface BusinessDate {
  id: string
  propertyId: string
  businessDate: string
  status: BusinessDateStatus
  openedAt: string
  closedAt?: string
  closedBy?: Actor
}

export interface AuditCheck {
  key: string
  label: string
  passed: boolean
  /** A failed required check stops the close; a failed warning does not. */
  required: boolean
  detail: string
}

export interface ReopenRecord {
  at: string
  by: Actor
  approvedBy: Actor
  reason: string
}

/** gst_finance.night_audits: one closing of a business date. */
export interface NightAudit {
  id: string
  propertyId: string
  businessDate: string
  status: 'completed' | 'reopened'
  startedAt: string
  finishedAt: string
  runBy: Actor
  checks: AuditCheck[]
  exceptionCount: number
  roomRevenue: number
  totalRevenue: number
  journalBatchId?: string
  reopens: ReopenRecord[]
  events: AccountingEvent[]
}

export type ExceptionKind = 'unbalanced-folio' | 'unposted-room' | 'open-pos-check' | 'no-show' | 'overstay'
export type ExceptionSeverity = 'block' | 'warn'
export type ExceptionStatus = 'open' | 'waived' | 'resolved'

/** gst_finance.audit_exceptions. `key` identifies the same problem across reloads (kind + reference). */
export interface AuditException {
  id: string
  propertyId: string
  businessDate: string
  nightAuditId?: string
  key: string
  kind: ExceptionKind
  severity: ExceptionSeverity
  reference: string
  description: string
  amount?: number
  status: ExceptionStatus
  note?: string
  resolvedBy?: Actor
  resolvedAt?: string
}

export type JournalStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'void'

/** One hotel transaction feeding a journal, before the posting rules turn it into lines. */
export interface SourceTransaction {
  transactionCode: string
  amount: number
  description: string
  reference?: string
}

/** gst_finance.journal_lines */
export interface JournalLine {
  id: string
  batchId: string
  lineNo: number
  accountCode: string
  accountName: string
  profitCentreId: string
  transactionCode: string
  description: string
  debit: number
  credit: number
}

/** gst_finance.journal_batches: one per business day (a new revision after a reopen). */
export interface JournalBatch {
  id: string
  propertyId: string
  businessDate: string
  reference: string
  revision: number
  status: JournalStatus
  createdAt: string
  createdBy: Actor
  sentAt?: string
  acceptedAt?: string
  attempts: number
  lastError?: string
  trademateRef?: string
  totalDebit: number
  totalCredit: number
  lines: JournalLine[]
  /** Kept so the batch can be rebuilt after a posting rule is corrected. */
  source: SourceTransaction[]
  history: AccountingEvent[]
}

/** gst_finance.budgets */
export interface Budget {
  id: string
  propertyId: string
  name: string
  /** First month of the fiscal year, YYYY-MM. The budget covers twelve months from it. */
  startPeriod: string
  status: 'draft' | 'approved'
  approvedBy?: Actor
  approvedAt?: string
  updatedAt: string
}

/** gst_finance.budget_lines: one centre, one month. */
export interface BudgetLine {
  id: string
  budgetId: string
  profitCentreId: string
  /** YYYY-MM */
  period: string
  amount: number
}

// ---------- gst_billing ----------

export type TransactionGroup =
  | 'room'
  | 'fb'
  | 'minibar'
  | 'laundry'
  | 'other-revenue'
  | 'tax'
  | 'service'
  | 'payment'
  | 'deposit'
  | 'refund'
  | 'commission'
  | 'receivable'

/** gst_billing.transaction_codes */
export interface TransactionCode {
  id: string
  code: string
  name: string
  group: TransactionGroup
}

export type DirectBillKind = 'corporate' | 'agent'

/** gst_billing.direct_bill_accounts: a company or agent the hotel invoices later (city ledger). */
export interface DirectBillAccount {
  id: string
  propertyId: string
  kind: DirectBillKind
  /** The corporate account or travel agent it belongs to. */
  sourceId: string
  name: string
  /** For a company the limit set on the corporate account wins; this is the agent's own limit. */
  creditLimit: number
  paymentTermsDays: number
  status: 'active' | 'on-hold' | 'closed'
  trademateCustomerCode: string
  contactName: string
  contactEmail: string
  createdAt: string
}

/** gst_billing.direct_bill_transfers: a folio balance moved to a direct-bill account. */
export interface DirectBillTransfer {
  id: string
  propertyId: string
  accountId: string
  reservationId?: string
  guest: string
  invoiceNo: string
  amount: number
  /** What Trademate reports as received. Read-only here. */
  paidAmount: number
  businessDate: string
  dueDate: string
  transferredAt: string
  transferredBy: Actor
  status: 'open' | 'part-paid' | 'paid'
  trademateStatus: 'pending' | 'accepted'
}

export interface CollectionNote {
  id: string
  propertyId: string
  accountId: string
  at: string
  by: Actor
  kind: 'note' | 'reminder' | 'promise'
  text: string
  promisedDate?: string
}

export interface CommissionPosting {
  id: string
  propertyId: string
  agentId: string
  agentName: string
  amount: number
  sentAt: string
  sentBy: Actor
  status: 'sent' | 'accepted'
}

// ---------- gst_core ----------

/** gst_core.currencies */
export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  decimals: number
  active: boolean
  isBase: boolean
}

export type RateSource = 'Bank of Uganda' | 'Manual' | 'Trademate'

/** gst_core.exchange_rates: UGX for one unit of the currency, on a date. */
export interface ExchangeRate {
  id: string
  currencyCode: string
  rateDate: string
  rate: number
  source: RateSource
  enteredBy?: Actor
  enteredAt: string
}

/** gst_core.profit_centres: departments that earn (profit) or spend (cost). */
export interface ProfitCentre {
  id: string
  propertyId: string
  code: string
  name: string
  kind: 'profit' | 'cost'
  department: string
  active: boolean
}

/** gst_core.tax_rules. Derived from the hotel's tax settings (Taxes and EFRIS). */
export interface TaxRule {
  id: string
  propertyId: string
  code: string
  name: string
  kind: 'percent' | 'fixed'
  rate: number
  inclusive: boolean
  active: boolean
}

// ---------- gst_integration ----------

/** gst_integration.gl_account_map: Trademate's chart of accounts as last synced. Read-only here. */
export interface GlAccount {
  id: string
  propertyId: string
  trademateCode: string
  trademateName: string
  accountType: 'asset' | 'liability' | 'income' | 'expense'
  syncedAt: string
}

/** gst_finance.posting_rules: a transaction code mapped to Trademate accounts and a profit centre. */
export interface PostingRule {
  id: string
  propertyId: string
  transactionCodeId: string
  debitAccount: string
  creditAccount: string
  profitCentreId: string
  active: boolean
  updatedAt: string
  updatedBy: Actor
}

export type OutboxKind = 'journal_batch' | 'journal_reversal' | 'ar_invoice' | 'ap_commission'

/** gst_integration.outbox: every message sent to Trademate, with its delivery state. */
export interface OutboxMessage {
  id: string
  propertyId: string
  kind: OutboxKind
  refId: string
  description: string
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  lastError?: string
  createdAt: string
  deliveredAt?: string
}

/** A balance Trademate reports back. Shown read-only, marked as from Trademate. */
export interface TrademateBalance {
  propertyId: string
  accountCode: string
  accountName: string
  balance: number
  asOf: string
}

/** Actual spend or income per centre per month, from Trademate's books. */
export interface CentreActual {
  propertyId: string
  profitCentreId: string
  period: string
  amount: number
}

export interface AccountingSettings {
  propertyId: string
  baseCurrency: 'UGX'
  /** 1 = January. Uganda's fiscal year starts in July. */
  fiscalYearStartMonth: number
  trademateCompanyCode: string
  lastSyncAt: string
}

// ---------- inputs ----------

export interface CloseDayInput {
  businessDate: string
  checks: AuditCheck[]
  exceptions: Omit<AuditException, 'id' | 'propertyId' | 'businessDate' | 'status' | 'nightAuditId'>[]
  source: SourceTransaction[]
  roomRevenue: number
  totalRevenue: number
}

export interface RuleInput {
  debitAccount: string
  creditAccount: string
  profitCentreId: string
  active: boolean
}

export interface TransferInput {
  accountId: string
  reservationId?: string
  guest: string
  amount: number
  businessDate: string
}

export interface RateInput {
  currencyCode: string
  rateDate: string
  rate: number
  source: RateSource
}

export interface CentreInput {
  code: string
  name: string
  kind: 'profit' | 'cost'
  department: string
}

export interface DirectBillInput {
  kind: DirectBillKind
  sourceId: string
  name: string
  creditLimit: number
  paymentTermsDays: number
  contactName: string
  contactEmail: string
}
