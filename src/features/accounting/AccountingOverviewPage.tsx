import { Link } from 'react-router-dom'
import { Badge, Button, Card, DataTable, LoadingState, MoneyBars, PageHeader, StatCard, ErrorState } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dayMonth, ugx } from '../../lib/format'
import { useCorporate } from '../corporate/corporateContext'
import { useFeatures } from '../platform/featuresContext'
import type { TrademateBalance } from '../../services/accounting/accountingTypes'
import { ErrorNote, FromTrademate } from './accountingUi'
import { stampOf, useRun } from './accountingHelpers'
import { METHOD_LABEL } from './daySource'
import { balanceOf, limitOf, overdueOf } from './ledger'
import { useAccounting } from './useAccounting'
import { useDay } from './useDay'

// The accounting front page: where the day stands and what is waiting on Trademate.
export default function AccountingOverviewPage() {
  const acc = useAccounting()
  const { tenant, features } = useFeatures()
  const { byId } = useCorporate()
  const day = useDay(acc.businessDate, acc.transfers)
  const sync = useRun()

  if (acc.loading) return <LoadingState />
  if (acc.error) return <ErrorState hint={acc.error} />

  const waiting = acc.batches.filter((b) => b.status === 'draft' || b.status === 'sent')
  const failed = acc.batches.filter((b) => b.status === 'rejected')
  const ledgerTotal = acc.transfers.reduce((n, t) => n + t.amount - t.paidAmount, 0)
  const overdue = overdueOf(acc.transfers, acc.businessDate)
  const overLimit = acc.accounts.filter((a) => a.status !== 'closed' && balanceOf(acc.transfers, a.id) > limitOf(a, byId))
  const blocking = day.exceptions.filter((e) => e.severity === 'block')
  const outboxFailed = acc.outbox.filter((o) => o.status === 'failed').length
  const outboxPending = acc.outbox.filter((o) => o.status === 'pending').length
  const ratesToday = acc.rates.filter((r) => r.rateDate === acc.businessDate).map((r) => r.currencyCode)
  const missingRates = features.multiCurrency
    ? acc.currencies.filter((c) => c.active && !c.isBase && !ratesToday.includes(c.code)).map((c) => c.code)
    : []

  const known = (code: string) => acc.chart.some((g) => g.trademateCode === code)
  const takings = Object.entries(day.takings)
    .map(([code, amount]) => ({ label: METHOD_LABEL[code] ?? code, amount, tone: 'brand' as const }))
    .sort((a, b) => b.amount - a.amount)
  const takenTotal = takings.reduce((n, t) => n + t.amount, 0)

  const attention: { text: string; to: string; tone: 'bad' | 'warn' }[] = [
    ...failed.map((b) => ({ text: `Journal ${b.reference} rejected`, to: '/accounting/journals', tone: 'bad' as const })),
    ...(blocking.length ? [{ text: `${blocking.length} item${blocking.length === 1 ? '' : 's'} block tonight's close`, to: '/accounting/night-audit', tone: 'bad' as const }] : []),
    ...overLimit.map((a) => ({ text: `${a.name} is over its credit limit`, to: '/accounting/city-ledger', tone: 'warn' as const })),
    ...(missingRates.length ? [{ text: `No rate today for ${missingRates.join(', ')}`, to: '/accounting/currencies', tone: 'warn' as const }] : []),
    ...(acc.rules.some((r) => r.active && (!known(r.debitAccount) || !known(r.creditAccount)))
      ? [{ text: 'A posting rule points at an account Trademate does not have', to: '/accounting/posting-rules', tone: 'bad' as const }]
      : []),
  ]

  const balanceCols: Column<TrademateBalance>[] = [
    { key: 'code', header: 'Account', cell: (b) => (<span><span className="font-mono text-xs text-ink/50">{b.accountCode}</span> {b.accountName}</span>) },
    { key: 'bal', header: 'Balance', align: 'right', cell: (b) => <span className={`tabular-nums ${b.balance < 0 ? 'text-ink/60' : 'font-medium'}`}>{ugx(b.balance)}</span> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Accounting"
        title="Accounting"
        description={`${tenant.name}. The hotel side of the Trademate books.`}
        meta={<Badge tone={acc.businessStatus === 'reopened' ? 'warn' : 'brand'}>{acc.businessStatus === 'reopened' ? 'Day reopened' : 'Business date'} {dayMonth(acc.businessDate)}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Business date" icon="calendar" value={dayMonth(acc.businessDate)} hint={acc.businessStatus === 'reopened' ? 'Reopened' : 'Open'} to="/accounting/night-audit" tone={acc.businessStatus === 'reopened' ? 'warn' : 'default'} />
        <StatCard
          label="Last night audit"
          icon="check"
          value={acc.lastAudit ? dayMonth(acc.lastAudit.businessDate) : 'None'}
          hint={acc.lastAudit ? `${acc.lastAudit.runBy.name}, ${stampOf(acc.lastAudit.finishedAt)}` : 'Not run yet'}
          to="/accounting/night-audit"
        />
        <StatCard label="Journals waiting" icon="list" value={waiting.length} hint={failed.length ? `${failed.length} failed` : 'None failed'} tone={failed.length ? 'bad' : 'default'} to="/accounting/journals" />
        <StatCard label="City ledger" icon="money" value={ugx(ledgerTotal)} hint={`${ugx(overdue)} overdue`} tone={overdue > 0 ? 'warn' : 'default'} to="/accounting/city-ledger" />
      </div>

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
        <Card title="Takings today by method" icon="money" description={`${dayMonth(acc.businessDate)}, folios and POS`}>
          {takings.length === 0 ? (
            <p className="text-sm text-ink/55">Nothing taken yet today.</p>
          ) : (
            <>
              <MoneyBars rows={takings} />
              <div className="mt-3 flex justify-between border-t border-ink/10 pt-2 text-sm">
                <span className="font-semibold">Total</span>
                <span className="font-bold tabular-nums">{ugx(takenTotal)}</span>
              </div>
            </>
          )}
        </Card>

        <Card title="Needs attention" icon="alert" count={attention.length}>
          {attention.length === 0 ? (
            <p className="text-sm text-ink/55">Nothing waiting.</p>
          ) : (
            <ul className="divide-y divide-ink/8">
              {attention.map((a) => (
                <li key={a.text} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === 'bad' ? 'bg-bad' : 'bg-warn'}`} aria-hidden="true" />
                    <span className="truncate">{a.text}</span>
                  </span>
                  <Link to={a.to} className="shrink-0 text-xs font-semibold text-brand hover:underline">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
        <Card title="Cash and bank" icon="money" padded={false} actions={<FromTrademate at={acc.settings?.lastSyncAt} />}>
          <DataTable columns={balanceCols} rows={acc.balances} rowKey={(b) => b.accountCode} empty={{ title: 'No balances yet' }} />
        </Card>

        <Card
          title="Trademate link"
          icon="check"
          actions={
            <Button size="sm" variant="secondary" disabled={sync.busy || !acc.actor} onClick={() => sync.run(() => acc.service.syncFromTrademate(acc.propertyId, acc.need()))}>
              {sync.busy ? 'Syncing…' : 'Sync now'}
            </Button>
          }
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-ink/55">Company</dt>
            <dd className="font-medium">{acc.settings?.trademateCompanyCode}</dd>
            <dt className="text-ink/55">Last sync</dt>
            <dd className="font-medium">{acc.settings ? stampOf(acc.settings.lastSyncAt) : ''}</dd>
            <dt className="text-ink/55">Chart of accounts</dt>
            <dd className="font-medium">{acc.chart.length} accounts</dd>
            <dt className="text-ink/55">Outbox</dt>
            <dd>
              {outboxFailed > 0 ? <Badge tone="bad">{outboxFailed} failed</Badge> : outboxPending > 0 ? <Badge tone="info">{outboxPending} sending</Badge> : <Badge tone="good">All delivered</Badge>}
            </dd>
          </dl>
          <div className="mt-3">
            <ErrorNote>{sync.error}</ErrorNote>
          </div>
        </Card>
      </div>
    </div>
  )
}
