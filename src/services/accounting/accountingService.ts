import type { Unsubscribe } from '../types'
import type {
  AccountingActor,
  AccountingSettings,
  AuditException,
  Budget,
  BudgetLine,
  BusinessDate,
  CentreActual,
  CentreInput,
  CloseDayInput,
  CollectionNote,
  CommissionPosting,
  Currency,
  DirectBillAccount,
  DirectBillInput,
  DirectBillTransfer,
  ExchangeRate,
  GlAccount,
  JournalBatch,
  NightAudit,
  OutboxMessage,
  PostingRule,
  ProfitCentre,
  RateInput,
  RuleInput,
  SourceTransaction,
  TrademateBalance,
  TransactionCode,
  TransferInput,
} from './accountingTypes'

// What the accounting screens need. Every call is for one property (the hotel being shown) and every
// change takes the actor, because the backend checks permissions and keeps the audit trail. Trademate
// owns the books: anything marked "from Trademate" is read-only here.
export interface AccountingService {
  // Business dates and the night audit
  listBusinessDates(propertyId: string): Promise<BusinessDate[]>
  listNightAudits(propertyId: string): Promise<NightAudit[]>
  listExceptions(propertyId: string): Promise<AuditException[]>
  /** Accept a warning before the close, with a note. Blocking items cannot be waived. */
  waiveException(propertyId: string, businessDate: string, key: string, note: string, actor: AccountingActor): Promise<void>
  /** Close the open business date: record the audit and its exceptions, build the journal, roll the date. */
  closeDay(propertyId: string, input: CloseDayInput, actor: AccountingActor): Promise<NightAudit>
  /** Reopen the last closed date. Needs a reason and a second person's approval; both are logged. */
  reopenDay(propertyId: string, businessDate: string, reason: string, approver: AccountingActor, actor: AccountingActor): Promise<NightAudit>

  // Posting rules
  listTransactionCodes(): Promise<TransactionCode[]>
  listPostingRules(propertyId: string): Promise<PostingRule[]>
  savePostingRule(propertyId: string, transactionCodeId: string, input: RuleInput, actor: AccountingActor): Promise<PostingRule>
  /** Trademate's chart of accounts, as last synced. */
  listGlAccounts(propertyId: string): Promise<GlAccount[]>
  syncFromTrademate(propertyId: string, actor: AccountingActor): Promise<void>

  // Journals
  listJournalBatches(propertyId: string): Promise<JournalBatch[]>
  /** Build (or rebuild) the draft batch for a date from its hotel transactions. */
  buildJournal(propertyId: string, businessDate: string, source: SourceTransaction[], actor: AccountingActor): Promise<JournalBatch>
  sendJournal(propertyId: string, batchId: string, actor: AccountingActor): Promise<JournalBatch>
  /** Rebuild the lines with today's posting rules and send again. */
  retryJournal(propertyId: string, batchId: string, actor: AccountingActor): Promise<JournalBatch>
  listOutbox(propertyId: string): Promise<OutboxMessage[]>

  // City ledger
  listDirectBillAccounts(propertyId: string): Promise<DirectBillAccount[]>
  openDirectBillAccount(propertyId: string, input: DirectBillInput, actor: AccountingActor): Promise<DirectBillAccount>
  updateDirectBillAccount(
    propertyId: string,
    id: string,
    patch: Partial<Pick<DirectBillAccount, 'creditLimit' | 'paymentTermsDays' | 'status' | 'contactName' | 'contactEmail'>>,
    actor: AccountingActor,
  ): Promise<DirectBillAccount>
  listTransfers(propertyId: string): Promise<DirectBillTransfer[]>
  /** Move a folio balance to a direct-bill account. Refused over the credit limit. */
  transferToCityLedger(propertyId: string, input: TransferInput, creditLimit: number, actor: AccountingActor): Promise<DirectBillTransfer>
  listCollectionNotes(propertyId: string): Promise<CollectionNote[]>
  addCollectionNote(
    propertyId: string,
    note: Pick<CollectionNote, 'accountId' | 'kind' | 'text' | 'promisedDate'>,
    actor: AccountingActor,
  ): Promise<CollectionNote>
  listCommissionPostings(propertyId: string): Promise<CommissionPosting[]>
  sendCommission(propertyId: string, agentId: string, agentName: string, amount: number, actor: AccountingActor): Promise<CommissionPosting>

  // Currencies
  listCurrencies(): Promise<Currency[]>
  setCurrencyActive(code: string, active: boolean, actor: AccountingActor): Promise<Currency>
  listExchangeRates(): Promise<ExchangeRate[]>
  saveExchangeRate(input: RateInput, actor: AccountingActor): Promise<ExchangeRate>
  getSettings(propertyId: string): Promise<AccountingSettings>
  saveSettings(propertyId: string, patch: Partial<Pick<AccountingSettings, 'fiscalYearStartMonth'>>, actor: AccountingActor): Promise<AccountingSettings>

  // Budgets and centres
  listProfitCentres(propertyId: string): Promise<ProfitCentre[]>
  saveProfitCentre(propertyId: string, input: CentreInput & { id?: string; active?: boolean }, actor: AccountingActor): Promise<ProfitCentre>
  listBudgets(propertyId: string): Promise<Budget[]>
  listBudgetLines(propertyId: string): Promise<BudgetLine[]>
  saveBudgetLines(propertyId: string, budgetId: string, profitCentreId: string, amounts: Record<string, number>, actor: AccountingActor): Promise<void>
  approveBudget(propertyId: string, budgetId: string, actor: AccountingActor): Promise<Budget>
  /** Actuals per centre per month, from Trademate. */
  listActuals(propertyId: string): Promise<CentreActual[]>
  /** Balances Trademate reports back (cash, bank, receivables). */
  listTrademateBalances(propertyId: string): Promise<TrademateBalance[]>

  subscribe(listener: () => void): Unsubscribe
}
