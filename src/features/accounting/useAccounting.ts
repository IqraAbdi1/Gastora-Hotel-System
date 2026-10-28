import { useCallback, useEffect, useMemo, useState } from 'react'
import { accountingService } from '../../services'
import type {
  AccountingActor,
  AccountingSettings,
  AuditException,
  Budget,
  BudgetLine,
  BusinessDate,
  CentreActual,
  CollectionNote,
  CommissionPosting,
  Currency,
  DirectBillAccount,
  DirectBillTransfer,
  ExchangeRate,
  GlAccount,
  JournalBatch,
  NightAudit,
  OutboxMessage,
  PostingRule,
  ProfitCentre,
  TrademateBalance,
  TransactionCode,
} from '../../services/accounting/accountingTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

export interface AccountingData {
  dates: BusinessDate[]
  audits: NightAudit[]
  exceptions: AuditException[]
  codes: TransactionCode[]
  rules: PostingRule[]
  chart: GlAccount[]
  batches: JournalBatch[]
  outbox: OutboxMessage[]
  accounts: DirectBillAccount[]
  transfers: DirectBillTransfer[]
  notes: CollectionNote[]
  commissions: CommissionPosting[]
  currencies: Currency[]
  rates: ExchangeRate[]
  settings: AccountingSettings | null
  centres: ProfitCentre[]
  budgets: Budget[]
  budgetLines: BudgetLine[]
  actuals: CentreActual[]
  balances: TrademateBalance[]
}

const EMPTY: AccountingData = {
  dates: [],
  audits: [],
  exceptions: [],
  codes: [],
  rules: [],
  chart: [],
  batches: [],
  outbox: [],
  accounts: [],
  transfers: [],
  notes: [],
  commissions: [],
  currencies: [],
  rates: [],
  settings: null,
  centres: [],
  budgets: [],
  budgetLines: [],
  actuals: [],
  balances: [],
}

export async function loadAccounting(p: string): Promise<AccountingData> {
  const s = accountingService
  const [dates, audits, exceptions, codes, rules, chart, batches, outbox, accounts, transfers, notes, commissions, currencies, rates, settings, centres, budgets, budgetLines, actuals, balances] =
    await Promise.all([
      s.listBusinessDates(p),
      s.listNightAudits(p),
      s.listExceptions(p),
      s.listTransactionCodes(),
      s.listPostingRules(p),
      s.listGlAccounts(p),
      s.listJournalBatches(p),
      s.listOutbox(p),
      s.listDirectBillAccounts(p),
      s.listTransfers(p),
      s.listCollectionNotes(p),
      s.listCommissionPostings(p),
      s.listCurrencies(),
      s.listExchangeRates(),
      s.getSettings(p),
      s.listProfitCentres(p),
      s.listBudgets(p),
      s.listBudgetLines(p),
      s.listActuals(p),
      s.listTrademateBalances(p),
    ])
  return { dates, audits, exceptions, codes, rules, chart, batches, outbox, accounts, transfers, notes, commissions, currencies, rates, settings, centres, budgets, budgetLines, actuals, balances }
}

/**
 * The accounting records of the hotel being shown, reloaded whenever the service changes.
 * `actor` is the signed-in person with their role, for every change.
 */
export function useAccounting() {
  const { tenant } = useFeatures()
  const { user, role } = useAuth()
  const propertyId = tenant.id
  const [data, setData] = useState<AccountingData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      loadAccounting(propertyId)
        .then((d) => {
          if (!alive) return
          setData(d)
          setError(null)
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load accounting'))
        .finally(() => alive && setLoading(false))
    load()
    const stop = accountingService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [propertyId])

  const actor = useMemo<AccountingActor | null>(() => (user && role ? { id: user.id, name: user.name, role: role.id } : null), [user, role])
  const need = useCallback(() => {
    if (!actor) throw new Error('Sign in first')
    return actor
  }, [actor])

  const open = data.dates.find((d) => d.status === 'open' || d.status === 'reopened')
  const lastAudit = [...data.audits].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0]

  return {
    ...data,
    loading,
    error,
    propertyId,
    actor,
    need,
    service: accountingService,
    /** The business date that is open now. */
    businessDate: open?.businessDate ?? '',
    businessStatus: open?.status ?? 'open',
    lastAudit,
  }
}

export type AccountingValue = ReturnType<typeof useAccounting>
