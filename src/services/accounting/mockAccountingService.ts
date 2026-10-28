import { TODAY } from '../../data/sample'
import type { RoleId } from '../../lib/roles'
import type { AccountingService } from './accountingService'
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
  SourceTransaction,
  TrademateBalance,
} from './accountingTypes'
import {
  CURRENCIES,
  SYSTEM,
  TRANSACTION_CODES,
  at,
  centresFor,
  chartFor,
  fiscalStart,
  hash01,
  oldChartFor,
  periodsFrom,
  rulesFor,
  scaleOf,
  seedBudget,
  seedDirectBill,
  seedRates,
  shift,
  syntheticDay,
} from './accountingSeed'
import { applyRules } from './posting'

// In-memory accounting for the prototype. It lasts until the page is reloaded. Trademate is played by
// a small stand-in that accepts a balanced batch whose accounts are all in its chart, and rejects the rest.

const CLOSE_ROLES: RoleId[] = ['owner', 'admin', 'gm', 'finance', 'frontdesk']
const FINANCE_ROLES: RoleId[] = ['owner', 'admin', 'finance']
const LEDGER_ROLES: RoleId[] = ['owner', 'admin', 'gm', 'finance']
const APPROVER_ROLES: RoleId[] = ['owner', 'gm', 'finance']
const BUDGET_ROLES: RoleId[] = ['owner', 'admin', 'gm', 'finance']
const BUDGET_APPROVERS: RoleId[] = ['owner', 'finance']

interface PropertyState {
  dates: BusinessDate[]
  audits: NightAudit[]
  exceptions: AuditException[]
  rules: PostingRule[]
  chart: GlAccount[]
  batches: JournalBatch[]
  outbox: OutboxMessage[]
  accounts: DirectBillAccount[]
  transfers: DirectBillTransfer[]
  notes: CollectionNote[]
  commissions: CommissionPosting[]
  centres: ProfitCentre[]
  budgets: Budget[]
  budgetLines: BudgetLine[]
  settings: AccountingSettings
}

const now = () => new Date().toISOString()
const copy = <T,>(x: T): T => structuredClone(x)
const reject = (msg: string) => Promise.reject(new Error(msg))
const actorOf = (a: AccountingActor) => ({ id: a.id, name: a.name })

export function createMockAccountingService(): AccountingService {
  const props = new Map<string, PropertyState>()
  let currencies: Currency[] = copy(CURRENCIES)
  let rates: ExchangeRate[] = seedRates()
  let counter = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const nextId = (prefix: string) => `${prefix}-${String(++counter).padStart(4, '0')}`

  function batchFrom(s: PropertyState, propertyId: string, date: string, source: SourceTransaction[], revision: number, chart: GlAccount[], by = SYSTEM): JournalBatch {
    const id = `${propertyId}-JB-${date}-${revision}`
    const r = applyRules(source, TRANSACTION_CODES, s.rules, chart)
    return {
      id,
      propertyId,
      businessDate: date,
      reference: `GST-${propertyId.toUpperCase()}-${date.replace(/-/g, '')}${revision > 1 ? `-R${revision}` : ''}`,
      revision,
      status: 'draft',
      createdAt: at(date, '23:45'),
      createdBy: by,
      attempts: 0,
      totalDebit: r.totalDebit,
      totalCredit: r.totalCredit,
      lines: r.lines.map((l) => ({ ...l, id: `${id}-L${l.lineNo}`, batchId: id })),
      source,
      history: [{ at: at(date, '23:45'), by, action: 'Built from the night audit' }],
    }
  }

  function seed(propertyId: string): PropertyState {
    const centres = centresFor(propertyId)
    const synced = at(shift(TODAY, -1), '06:00')
    const rules = rulesFor(propertyId, centres, at(shift(TODAY, -60), '09:00'))
    const db = seedDirectBill(propertyId)
    const settings: AccountingSettings = {
      propertyId,
      baseCurrency: 'UGX',
      fiscalYearStartMonth: 7,
      trademateCompanyCode: `TM-${propertyId.toUpperCase()}`,
      lastSyncAt: synced,
    }
    const { budget, lines } = seedBudget(propertyId, centres, settings.fiscalYearStartMonth)
    const s: PropertyState = {
      dates: [],
      audits: [],
      exceptions: [],
      rules,
      chart: chartFor(propertyId, synced),
      batches: [],
      outbox: [],
      accounts: db.accounts,
      transfers: db.transfers,
      notes: db.notes,
      commissions: [],
      centres,
      budgets: [budget],
      budgetLines: lines,
      settings,
    }
    const runner = scaleOf(propertyId).size === 'small' ? { id: 'u-desk', name: 'Rita Auma' } : { id: 'u-gm', name: 'Esther Nambi' }
    // Seven closed days before today. Trademate renumbered laundry revenue two days ago, so the batch
    // for that day was rejected and the one for yesterday is waiting.
    for (let d = 7; d >= 1; d--) {
      const date = shift(TODAY, -d)
      const source = syntheticDay(propertyId, date)
      const old = d >= 3
      const b = batchFrom(s, propertyId, date, source, 1, old ? oldChartFor(propertyId, synced) : s.chart)
      if (old) {
        b.status = 'accepted'
        b.attempts = 1
        b.sentAt = at(shift(date, 1), '00:10')
        b.acceptedAt = at(shift(date, 1), '00:11')
        b.trademateRef = `TM-JV-${String(41000 + Math.round(hash01(propertyId + date) * 900) + d).padStart(6, '0')}`
        b.history.push({ at: b.sentAt, by: SYSTEM, action: 'Sent to Trademate' }, { at: b.acceptedAt, by: SYSTEM, action: 'Accepted by Trademate', detail: b.trademateRef })
        s.outbox.push({ id: `${b.id}-OB`, propertyId, kind: 'journal_batch', refId: b.id, description: `Journal ${b.reference}`, status: 'delivered', attempts: 1, createdAt: b.sentAt, deliveredAt: b.acceptedAt })
      } else if (d === 2) {
        b.status = 'rejected'
        b.attempts = 1
        b.sentAt = at(shift(date, 1), '00:10')
        b.lastError = 'Trademate: account 4305 does not exist in the chart of accounts'
        b.history.push({ at: b.sentAt, by: SYSTEM, action: 'Sent to Trademate' }, { at: b.sentAt, by: SYSTEM, action: 'Rejected by Trademate', detail: b.lastError })
        s.outbox.push({ id: `${b.id}-OB`, propertyId, kind: 'journal_batch', refId: b.id, description: `Journal ${b.reference}`, status: 'failed', attempts: 1, lastError: b.lastError, createdAt: b.sentAt })
      }
      s.batches.push(b)
      const total = source.filter((x) => !x.transactionCode.startsWith('PAY') && !x.transactionCode.startsWith('DEP') && x.transactionCode !== 'COMM').reduce((n, x) => n + x.amount, 0)
      const room = source.find((x) => x.transactionCode === 'ROOM')?.amount ?? 0
      const audit: NightAudit = {
        id: `${propertyId}-NA-${date}`,
        propertyId,
        businessDate: date,
        status: 'completed',
        startedAt: at(date, '23:20'),
        finishedAt: at(date, '23:45'),
        runBy: runner,
        checks: [],
        exceptionCount: d === 1 ? 1 : 0,
        roomRevenue: room,
        totalRevenue: total,
        journalBatchId: b.id,
        reopens: [],
        events: [{ at: at(date, '23:45'), by: runner, action: 'Day closed and date rolled' }],
      }
      s.audits.push(audit)
      s.dates.push({ id: `${propertyId}-BD-${date}`, propertyId, businessDate: date, status: 'closed', openedAt: at(date, '00:00'), closedAt: audit.finishedAt, closedBy: runner })
      if (d === 1)
        s.exceptions.push({
          id: `${propertyId}-EX-${date}-1`,
          propertyId,
          businessDate: date,
          nightAuditId: audit.id,
          key: 'open-pos-check|Bar T4',
          kind: 'open-pos-check',
          severity: 'warn',
          reference: 'Bar T4',
          description: 'Bar check left open at close',
          amount: 46000,
          status: 'waived',
          note: 'Guest paying in the morning; bar manager informed.',
          resolvedBy: runner,
          resolvedAt: at(date, '23:30'),
        })
    }
    s.dates.push({ id: `${propertyId}-BD-${TODAY}`, propertyId, businessDate: TODAY, status: 'open', openedAt: at(TODAY, '00:00') })
    return s
  }

  function st(propertyId: string): PropertyState {
    let s = props.get(propertyId)
    if (!s) {
      s = seed(propertyId)
      props.set(propertyId, s)
    }
    return s
  }

  const allowed = (actor: AccountingActor, roles: RoleId[], what: string) =>
    roles.includes(actor.role) ? null : new Error(`Your role may not ${what}`)

  const openDate = (s: PropertyState) => s.dates.find((d) => d.status === 'open' || d.status === 'reopened')
  const outstanding = (s: PropertyState, accountId: string) =>
    s.transfers.filter((t) => t.accountId === accountId).reduce((n, t) => n + t.amount - t.paidAmount, 0)

  /** The stand-in for Trademate: what it would say about a batch. */
  function trademateCheck(s: PropertyState, b: JournalBatch): string | null {
    if (b.lines.length === 0) return 'Trademate: the batch has no lines'
    const missing = b.lines.find((l) => !s.chart.some((a) => a.trademateCode === l.accountCode))
    if (missing) return `Trademate: account ${missing.accountCode} does not exist in the chart of accounts`
    if (b.totalDebit !== b.totalCredit) return 'Trademate: debits and credits do not balance'
    return null
  }

  function deliver(propertyId: string, s: PropertyState, b: JournalBatch, actor: AccountingActor): JournalBatch {
    const t = now()
    b.attempts += 1
    b.sentAt = t
    const err = trademateCheck(s, b)
    const msg: OutboxMessage = s.outbox.find((o) => o.refId === b.id && o.kind === 'journal_batch') ?? {
      id: nextId('OB'),
      propertyId,
      kind: 'journal_batch',
      refId: b.id,
      description: `Journal ${b.reference}`,
      status: 'pending',
      attempts: 0,
      createdAt: t,
    }
    if (!s.outbox.includes(msg)) s.outbox.unshift(msg)
    msg.attempts += 1
    b.history.push({ at: t, by: actorOf(actor), action: b.attempts > 1 ? 'Sent again to Trademate' : 'Sent to Trademate' })
    if (err) {
      b.status = 'rejected'
      b.lastError = err
      msg.status = 'failed'
      msg.lastError = err
      b.history.push({ at: t, by: SYSTEM, action: 'Rejected by Trademate', detail: err })
      return b
    }
    b.status = 'sent'
    b.lastError = undefined
    msg.status = 'pending'
    msg.lastError = undefined
    // Trademate answers a moment later, as the real connection would.
    window.setTimeout(() => {
      if (b.status !== 'sent') return
      b.status = 'accepted'
      b.acceptedAt = now()
      b.trademateRef = `TM-JV-${String(42000 + counter).padStart(6, '0')}`
      msg.status = 'delivered'
      msg.deliveredAt = b.acceptedAt
      b.history.push({ at: b.acceptedAt, by: SYSTEM, action: 'Accepted by Trademate', detail: b.trademateRef })
      emit()
    }, 900)
    return b
  }

  function outboxDelivered(propertyId: string, s: PropertyState, kind: OutboxMessage['kind'], refId: string, description: string, after?: () => void) {
    const msg: OutboxMessage = { id: nextId('OB'), propertyId, kind, refId, description, status: 'pending', attempts: 1, createdAt: now() }
    s.outbox.unshift(msg)
    window.setTimeout(() => {
      msg.status = 'delivered'
      msg.deliveredAt = now()
      after?.()
      emit()
    }, 700)
  }

  const done = <T,>(x: T) => {
    emit()
    return Promise.resolve(copy(x))
  }

  return {
    listBusinessDates: (p) => Promise.resolve(copy(st(p).dates)),
    listNightAudits: (p) => Promise.resolve(copy(st(p).audits)),
    listExceptions: (p) => Promise.resolve(copy(st(p).exceptions)),

    waiveException(p, date, key, note, actor) {
      const s = st(p)
      const no = allowed(actor, CLOSE_ROLES, 'clear audit exceptions')
      if (no) return Promise.reject(no)
      if (openDate(s)?.businessDate !== date) return reject('That day is already closed')
      if (note.trim().length < 5) return reject('Say why this can wait (at least 5 characters)')
      const [kind, reference] = key.split('|')
      if (kind === 'overstay' || kind === 'unposted-room') return reject('This item blocks the close and cannot be waived')
      s.exceptions = s.exceptions.filter((e) => !(e.businessDate === date && e.key === key))
      s.exceptions.push({
        id: nextId('EX'),
        propertyId: p,
        businessDate: date,
        key,
        kind: kind as AuditException['kind'],
        severity: 'warn',
        reference: reference ?? '',
        description: 'Accepted before the close',
        status: 'waived',
        note: note.trim(),
        resolvedBy: actorOf(actor),
        resolvedAt: now(),
      })
      emit()
      return Promise.resolve()
    },

    closeDay(p, input, actor) {
      const s = st(p)
      const no = allowed(actor, CLOSE_ROLES, 'close the day')
      if (no) return Promise.reject(no)
      const open = openDate(s)
      if (!open || open.businessDate !== input.businessDate) return reject(`The open business date is ${open?.businessDate ?? 'not set'}`)
      const failed = input.checks.filter((c) => c.required && !c.passed)
      if (failed.length) return reject(`Not ready: ${failed.map((c) => c.label).join(', ')}`)
      const t = now()
      const by = actorOf(actor)
      const prior = s.batches.filter((b) => b.businessDate === open.businessDate)
      const revision = prior.length ? Math.max(...prior.map((b) => b.revision)) + 1 : 1
      const batch = batchFrom(s, p, open.businessDate, input.source, revision, s.chart, by)
      batch.createdAt = t
      batch.history = [{ at: t, by, action: 'Built by the night audit' }]
      s.batches.push(batch)
      const audit: NightAudit = {
        id: nextId(`${p}-NA`),
        propertyId: p,
        businessDate: open.businessDate,
        status: 'completed',
        startedAt: t,
        finishedAt: t,
        runBy: by,
        checks: input.checks,
        exceptionCount: input.exceptions.length,
        roomRevenue: input.roomRevenue,
        totalRevenue: input.totalRevenue,
        journalBatchId: batch.id,
        reopens: [],
        events: [{ at: t, by, action: revision > 1 ? 'Day closed again after a reopen' : 'Day closed and date rolled' }],
      }
      s.audits.push(audit)
      for (const e of input.exceptions) {
        const waived = s.exceptions.find((x) => x.businessDate === open.businessDate && x.key === e.key && x.status === 'waived')
        if (waived) Object.assign(waived, { ...e, status: 'waived', nightAuditId: audit.id, note: waived.note })
        else s.exceptions.push({ ...e, id: nextId('EX'), propertyId: p, businessDate: open.businessDate, status: 'open', nightAuditId: audit.id })
      }
      // Waivers for problems that cleared themselves before the close are dropped.
      s.exceptions = s.exceptions.filter((x) => x.businessDate !== open.businessDate || x.nightAuditId)
      open.status = 'closed'
      open.closedAt = t
      open.closedBy = by
      const next = shift(open.businessDate, 1)
      if (!s.dates.some((d) => d.businessDate === next))
        s.dates.push({ id: `${p}-BD-${next}`, propertyId: p, businessDate: next, status: 'open', openedAt: t })
      else s.dates = s.dates.map((d) => (d.businessDate === next ? { ...d, status: 'open' } : d))
      return done(audit)
    },

    reopenDay(p, date, reason, approver, actor) {
      const s = st(p)
      const no = allowed(actor, CLOSE_ROLES, 'reopen a day')
      if (no) return Promise.reject(no)
      if (!APPROVER_ROLES.includes(approver.role)) return reject('The approver must be the owner, the general manager or finance')
      if (approver.id === actor.id) return reject('Somebody else must approve a reopen')
      if (reason.trim().length < 10) return reject('Give the reason in a sentence (at least 10 characters)')
      const closed = s.dates.filter((d) => d.status === 'closed').sort((a, b) => b.businessDate.localeCompare(a.businessDate))
      if (closed[0]?.businessDate !== date) return reject('Only the last closed day can be reopened')
      const audit = [...s.audits].reverse().find((a) => a.businessDate === date)
      if (!audit) return reject('No night audit found for that day')
      const open = openDate(s)
      const t = now()
      const by = actorOf(actor)
      // The day that had just opened goes away; the reopened day becomes the business date again.
      if (open) s.dates = s.dates.filter((d) => d !== open)
      const row = s.dates.find((d) => d.businessDate === date)!
      row.status = 'reopened'
      row.closedAt = undefined
      row.closedBy = undefined
      audit.status = 'reopened'
      const rec = { at: t, by, approvedBy: actorOf(approver), reason: reason.trim() }
      audit.reopens.push(rec)
      audit.events.push({ at: t, by, action: `Reopened, approved by ${approver.name}`, detail: rec.reason })
      for (const b of s.batches.filter((x) => x.businessDate === date && x.status !== 'void')) {
        const wasPosted = b.status === 'accepted' || b.status === 'sent'
        b.status = 'void'
        b.history.push({ at: t, by, action: 'Voided by a reopen', detail: rec.reason })
        if (wasPosted) {
          b.history.push({ at: t, by: SYSTEM, action: 'Reversal asked of Trademate', detail: b.trademateRef })
          outboxDelivered(p, s, 'journal_reversal', b.id, `Reverse ${b.reference}`)
        }
      }
      s.exceptions = s.exceptions.filter((e) => !(e.businessDate === date && e.status === 'open'))
      return done(audit)
    },

    listTransactionCodes: () => Promise.resolve(copy(TRANSACTION_CODES)),
    listPostingRules: (p) => Promise.resolve(copy(st(p).rules)),

    savePostingRule(p, codeId, input, actor) {
      const s = st(p)
      const no = allowed(actor, FINANCE_ROLES, 'change posting rules')
      if (no) return Promise.reject(no)
      const known = (c: string) => s.chart.some((a) => a.trademateCode === c)
      const dr = input.debitAccount.trim()
      const cr = input.creditAccount.trim()
      if (!dr || !cr) return reject('Both a debit and a credit account are needed')
      if (dr === cr) return reject('Debit and credit cannot be the same account')
      if (!known(dr)) return reject(`Account ${dr} is not in the Trademate chart`)
      if (!known(cr)) return reject(`Account ${cr} is not in the Trademate chart`)
      if (!s.centres.some((c) => c.id === input.profitCentreId && c.active)) return reject('Pick an active profit or cost centre')
      const existing = s.rules.find((r) => r.transactionCodeId === codeId)
      const rule: PostingRule = {
        id: existing?.id ?? nextId(`${p}-PR`),
        propertyId: p,
        transactionCodeId: codeId,
        debitAccount: dr,
        creditAccount: cr,
        profitCentreId: input.profitCentreId,
        active: input.active,
        updatedAt: now(),
        updatedBy: actorOf(actor),
      }
      s.rules = existing ? s.rules.map((r) => (r === existing ? rule : r)) : [...s.rules, rule]
      return done(rule)
    },

    listGlAccounts: (p) => Promise.resolve(copy(st(p).chart)),

    syncFromTrademate(p, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'sync with Trademate')
      if (no) return Promise.reject(no)
      const t = now()
      s.settings.lastSyncAt = t
      s.chart = s.chart.map((a) => ({ ...a, syncedAt: t }))
      emit()
      return Promise.resolve()
    },

    listJournalBatches: (p) => Promise.resolve(copy(st(p).batches)),

    buildJournal(p, date, source, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'build journals')
      if (no) return Promise.reject(no)
      if (source.length === 0) return reject('There are no transactions for that day')
      const live = s.batches.filter((b) => b.businessDate === date && b.status !== 'void')
      const posted = live.find((b) => b.status === 'sent' || b.status === 'accepted')
      if (posted) return reject('Already sent to Trademate. Reopen the day to change it.')
      const editable = live.find((b) => b.status === 'draft' || b.status === 'rejected')
      const revision = editable?.revision ?? Math.max(0, ...s.batches.filter((b) => b.businessDate === date).map((b) => b.revision)) + 1
      const fresh = batchFrom(s, p, date, source, revision, s.chart, actorOf(actor))
      fresh.createdAt = now()
      if (editable) {
        Object.assign(editable, { lines: fresh.lines, source, totalDebit: fresh.totalDebit, totalCredit: fresh.totalCredit })
        editable.history.push({ at: now(), by: actorOf(actor), action: 'Rebuilt from the day’s transactions' })
        return done(editable)
      }
      fresh.history = [{ at: fresh.createdAt, by: actorOf(actor), action: 'Built by hand' }]
      s.batches.push(fresh)
      return done(fresh)
    },

    sendJournal(p, id, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'send journals')
      if (no) return Promise.reject(no)
      const b = s.batches.find((x) => x.id === id)
      if (!b) return reject('Journal not found')
      if (b.status !== 'draft') return reject(`Only a draft can be sent; this one is ${b.status}`)
      if (openDate(s)?.businessDate === b.businessDate) return reject('Close the day before sending its journal')
      // A draft always goes with today's posting rules.
      const r = applyRules(b.source, TRANSACTION_CODES, s.rules, s.chart)
      const changed = r.lines.some((l, i) => l.accountCode !== b.lines[i]?.accountCode || l.debit !== b.lines[i]?.debit) || r.lines.length !== b.lines.length
      if (changed) {
        b.lines = r.lines.map((l) => ({ ...l, id: `${b.id}-L${l.lineNo}-s`, batchId: b.id }))
        b.totalDebit = r.totalDebit
        b.totalCredit = r.totalCredit
        b.history.push({ at: now(), by: actorOf(actor), action: 'Rebuilt with the current posting rules' })
      }
      return done(deliver(p, s, b, actor))
    },

    retryJournal(p, id, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'send journals')
      if (no) return Promise.reject(no)
      const b = s.batches.find((x) => x.id === id)
      if (!b) return reject('Journal not found')
      if (b.status !== 'rejected') return reject('Only a rejected journal can be retried')
      const r = applyRules(b.source, TRANSACTION_CODES, s.rules, s.chart)
      b.lines = r.lines.map((l) => ({ ...l, id: `${b.id}-L${l.lineNo}-${b.attempts}`, batchId: b.id }))
      b.totalDebit = r.totalDebit
      b.totalCredit = r.totalCredit
      b.history.push({ at: now(), by: actorOf(actor), action: 'Rebuilt with the current posting rules' })
      return done(deliver(p, s, b, actor))
    },

    listOutbox: (p) => Promise.resolve(copy(st(p).outbox)),

    listDirectBillAccounts: (p) => Promise.resolve(copy(st(p).accounts)),

    openDirectBillAccount(p, input, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'open direct-bill accounts')
      if (no) return Promise.reject(no)
      if (s.accounts.some((a) => a.kind === input.kind && a.sourceId === input.sourceId && a.status !== 'closed'))
        return reject(`${input.name} already has a direct-bill account`)
      if (input.creditLimit < 0) return reject('The credit limit cannot be negative')
      if (input.paymentTermsDays < 0 || input.paymentTermsDays > 120) return reject('Payment terms must be 0 to 120 days')
      if (input.contactEmail && !/^\S+@\S+\.\S+$/.test(input.contactEmail)) return reject('That email address does not look right')
      const acc: DirectBillAccount = {
        ...input,
        id: nextId(`${p}-DB`),
        propertyId: p,
        status: 'active',
        trademateCustomerCode: `${input.kind === 'agent' ? 'A' : 'C'}-${input.name.replace(/[^A-Za-z]/g, '').slice(0, 8).toUpperCase()}`,
        createdAt: now(),
      }
      s.accounts.push(acc)
      return done(acc)
    },

    updateDirectBillAccount(p, id, patch, actor) {
      const s = st(p)
      const acc = s.accounts.find((a) => a.id === id)
      if (!acc) return reject('Account not found')
      if (patch.creditLimit !== undefined) {
        const no = allowed(actor, ['owner', 'finance'], 'change credit limits')
        if (no) return Promise.reject(no)
        if (patch.creditLimit < 0) return reject('The credit limit cannot be negative')
      } else {
        const no = allowed(actor, LEDGER_ROLES, 'change direct-bill accounts')
        if (no) return Promise.reject(no)
      }
      if (patch.paymentTermsDays !== undefined && (patch.paymentTermsDays < 0 || patch.paymentTermsDays > 120))
        return reject('Payment terms must be 0 to 120 days')
      Object.assign(acc, patch)
      return done(acc)
    },

    listTransfers: (p) => Promise.resolve(copy(st(p).transfers)),

    transferToCityLedger(p, input, creditLimit, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'transfer to the city ledger')
      if (no) return Promise.reject(no)
      const acc = s.accounts.find((a) => a.id === input.accountId)
      if (!acc) return reject('Pick a direct-bill account')
      if (acc.status !== 'active') return reject(`${acc.name} is ${acc.status}; nothing can be charged to it`)
      if (!(input.amount > 0)) return reject('The amount must be more than zero')
      const used = outstanding(s, acc.id)
      if (used + input.amount > creditLimit)
        return reject(`Over the credit limit: ${acc.name} would owe UGX ${(used + input.amount).toLocaleString('en-US')} of UGX ${creditLimit.toLocaleString('en-US')}`)
      const n = s.transfers.length + 1
      const tr: DirectBillTransfer = {
        id: nextId(`${p}-CL`),
        propertyId: p,
        accountId: acc.id,
        reservationId: input.reservationId,
        guest: input.guest.trim() || 'Guest',
        invoiceNo: `CL-${p.toUpperCase()}-${String(n).padStart(4, '0')}`,
        amount: Math.round(input.amount),
        paidAmount: 0,
        businessDate: input.businessDate,
        dueDate: shift(input.businessDate, acc.paymentTermsDays),
        transferredAt: now(),
        transferredBy: actorOf(actor),
        status: 'open',
        trademateStatus: 'pending',
      }
      s.transfers.unshift(tr)
      outboxDelivered(p, s, 'ar_invoice', tr.id, `Invoice ${tr.invoiceNo} to ${acc.trademateCustomerCode}`, () => {
        tr.trademateStatus = 'accepted'
      })
      return done(tr)
    },

    listCollectionNotes: (p) => Promise.resolve(copy(st(p).notes)),

    addCollectionNote(p, note, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'add collection notes')
      if (no) return Promise.reject(no)
      if (!s.accounts.some((a) => a.id === note.accountId)) return reject('Account not found')
      if (note.text.trim().length < 3) return reject('Write the note')
      if (note.kind === 'promise' && !note.promisedDate) return reject('A promise needs the date the company gave')
      const n: CollectionNote = { ...note, text: note.text.trim(), id: nextId(`${p}-CN`), propertyId: p, at: now(), by: actorOf(actor) }
      s.notes.unshift(n)
      return done(n)
    },

    listCommissionPostings: (p) => Promise.resolve(copy(st(p).commissions)),

    sendCommission(p, agentId, agentName, amount, actor) {
      const s = st(p)
      const no = allowed(actor, LEDGER_ROLES, 'send commissions')
      if (no) return Promise.reject(no)
      if (!(amount > 0)) return reject('Nothing is owed to this agent')
      const c: CommissionPosting = { id: nextId(`${p}-AC`), propertyId: p, agentId, agentName, amount: Math.round(amount), sentAt: now(), sentBy: actorOf(actor), status: 'sent' }
      s.commissions.unshift(c)
      outboxDelivered(p, s, 'ap_commission', c.id, `Commission bill for ${agentName}`, () => {
        c.status = 'accepted'
      })
      return done(c)
    },

    listCurrencies: () => Promise.resolve(copy(currencies)),

    setCurrencyActive(code, active, actor) {
      const no = allowed(actor, FINANCE_ROLES, 'change currencies')
      if (no) return Promise.reject(no)
      const c = currencies.find((x) => x.code === code)
      if (!c) return reject('Currency not found')
      if (c.isBase) return reject('The base currency is always on')
      currencies = currencies.map((x) => (x.code === code ? { ...x, active } : x))
      return done(currencies.find((x) => x.code === code)!)
    },

    listExchangeRates: () => Promise.resolve(copy(rates)),

    saveExchangeRate(input, actor) {
      const no = allowed(actor, FINANCE_ROLES, 'enter exchange rates')
      if (no) return Promise.reject(no)
      const c = currencies.find((x) => x.code === input.currencyCode)
      if (!c || c.isBase) return reject('Pick a foreign currency')
      if (!(input.rate > 0)) return reject('The rate must be more than zero')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.rateDate)) return reject('Pick a date')
      if (input.rateDate > TODAY) return reject('A rate cannot be entered for a future date')
      const prev = rates.filter((r) => r.currencyCode === c.code && r.rateDate < input.rateDate).sort((a, b) => b.rateDate.localeCompare(a.rateDate))[0]
      if (prev && Math.abs(input.rate / prev.rate - 1) > 0.2)
        return reject(`That is more than 20% away from the last rate (${prev.rate}). Check the figure.`)
      const rate: ExchangeRate = {
        id: `XR-${c.code}-${input.rateDate}`,
        currencyCode: c.code,
        rateDate: input.rateDate,
        rate: input.rate,
        source: input.source,
        enteredBy: input.source === 'Manual' ? actorOf(actor) : undefined,
        enteredAt: now(),
      }
      rates = [...rates.filter((r) => r.id !== rate.id), rate]
      return done(rate)
    },

    getSettings: (p) => Promise.resolve(copy(st(p).settings)),

    saveSettings(p, patch, actor) {
      const s = st(p)
      const no = allowed(actor, FINANCE_ROLES, 'change accounting settings')
      if (no) return Promise.reject(no)
      if (patch.fiscalYearStartMonth !== undefined && !(patch.fiscalYearStartMonth >= 1 && patch.fiscalYearStartMonth <= 12))
        return reject('Pick a month')
      Object.assign(s.settings, patch)
      return done(s.settings)
    },

    listProfitCentres: (p) => Promise.resolve(copy(st(p).centres)),

    saveProfitCentre(p, input, actor) {
      const s = st(p)
      const no = allowed(actor, BUDGET_ROLES, 'change centres')
      if (no) return Promise.reject(no)
      const code = input.code.trim().toUpperCase()
      if (!/^[A-Z0-9-]{2,10}$/.test(code)) return reject('The code is 2 to 10 letters or digits')
      if (input.name.trim().length < 2) return reject('Give the centre a name')
      if (s.centres.some((c) => c.code === code && c.id !== input.id)) return reject(`Code ${code} is already used`)
      if (input.id && input.active === false && s.rules.some((r) => r.profitCentreId === input.id && r.active))
        return reject('Posting rules still use this centre. Move them first.')
      const existing = input.id ? s.centres.find((c) => c.id === input.id) : undefined
      const centre: ProfitCentre = {
        id: existing?.id ?? nextId(`${p}-PC`),
        propertyId: p,
        code,
        name: input.name.trim(),
        kind: input.kind,
        department: input.department.trim() || input.name.trim(),
        active: input.active ?? true,
      }
      s.centres = existing ? s.centres.map((c) => (c === existing ? centre : c)) : [...s.centres, centre]
      if (!existing)
        for (const b of s.budgets)
          for (const period of periodsFrom(b.startPeriod))
            s.budgetLines.push({ id: nextId('BL'), budgetId: b.id, profitCentreId: centre.id, period, amount: 0 })
      return done(centre)
    },

    listBudgets: (p) => Promise.resolve(copy(st(p).budgets)),
    listBudgetLines: (p) => Promise.resolve(copy(st(p).budgetLines)),

    saveBudgetLines(p, budgetId, centreId, amounts, actor) {
      const s = st(p)
      const no = allowed(actor, BUDGET_ROLES, 'change budgets')
      if (no) return Promise.reject(no)
      const b = s.budgets.find((x) => x.id === budgetId)
      if (!b) return reject('Budget not found')
      if (b.status === 'approved' && !BUDGET_APPROVERS.includes(actor.role)) return reject('This budget is approved; only the owner or finance can change it')
      const periods = periodsFrom(b.startPeriod)
      for (const [period, amount] of Object.entries(amounts)) {
        if (!periods.includes(period)) return reject(`${period} is outside this budget`)
        if (!(amount >= 0) || !Number.isFinite(amount)) return reject('Amounts must be zero or more')
      }
      for (const [period, amount] of Object.entries(amounts)) {
        const line = s.budgetLines.find((l) => l.budgetId === budgetId && l.profitCentreId === centreId && l.period === period)
        if (line) line.amount = Math.round(amount)
        else s.budgetLines.push({ id: nextId('BL'), budgetId, profitCentreId: centreId, period, amount: Math.round(amount) })
      }
      b.updatedAt = now()
      emit()
      return Promise.resolve()
    },

    approveBudget(p, budgetId, actor) {
      const s = st(p)
      const no = allowed(actor, BUDGET_APPROVERS, 'approve budgets')
      if (no) return Promise.reject(no)
      const b = s.budgets.find((x) => x.id === budgetId)
      if (!b) return reject('Budget not found')
      if (b.status === 'approved') return reject('Already approved')
      b.status = 'approved'
      b.approvedBy = actorOf(actor)
      b.approvedAt = now()
      return done(b)
    },

    listActuals(p) {
      const s = st(p)
      const start = fiscalStart(TODAY, s.settings.fiscalYearStartMonth)
      const current = TODAY.slice(0, 7)
      const day = Number(TODAY.slice(8, 10))
      const days = new Date(Date.UTC(Number(current.slice(0, 4)), Number(current.slice(5, 7)), 0)).getUTCDate()
      const out: CentreActual[] = []
      const baseline = seedBudget(p, s.centres, s.settings.fiscalYearStartMonth).lines
      for (const period of periodsFrom(start)) {
        if (period > current) break
        for (const c of s.centres) {
          const base = baseline.find((l) => l.profitCentreId === c.id && l.period === period)?.amount ?? 0
          const factor = 0.86 + hash01(`${p}${c.code}${period}`) * 0.26
          const part = period === current ? day / days : 1
          out.push({ propertyId: p, profitCentreId: c.id, period, amount: Math.round((base * factor * part) / 1000) * 1000 })
        }
      }
      return Promise.resolve(out)
    },

    listTrademateBalances(p) {
      const s = st(p)
      const { rooms } = scaleOf(p)
      const k = rooms / 120
      const asOf = s.batches.filter((b) => b.status === 'accepted').map((b) => b.businessDate).sort().pop() ?? TODAY
      const rows: [string, string, number][] = [
        ['1000', 'Cash on hand', 4_850_000 * k],
        ['1020', 'MTN MoMo float', 7_420_000 * k],
        ['1030', 'Card clearing', 5_960_000 * k],
        ['1100', 'Stanbic Bank UGX', 186_400_000 * k],
        ['1110', 'Stanbic Bank USD (in UGX)', 52_300_000 * k],
        ['1210', 'City ledger receivables', s.transfers.filter((t) => t.trademateStatus === 'accepted').reduce((n, t) => n + t.amount - t.paidAmount, 0)],
        ['2300', 'Advance deposits', -18_700_000 * k],
        ['2400', 'Agent commissions payable', -3_240_000 * k],
      ]
      const small = scaleOf(p).size === 'small'
      return Promise.resolve(rows.filter(([code]) => !small || (code !== '1110' && code !== '2400')).map(([code, name, bal]) => ({ propertyId: p, accountCode: code, accountName: name, balance: Math.round(bal / 1000) * 1000, asOf })) as TrademateBalance[])
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

