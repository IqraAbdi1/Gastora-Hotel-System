import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Segmented,
  Select,
  StatCard,
  Tabs,
} from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import type { Currency, ExchangeRate, RateSource, TaxRule } from '../../services/accounting/accountingTypes'
import { ErrorNote, Notice, RateLine } from './accountingUi'
import { FINANCE_SETUP, shortDate, stampOf, useRun } from './accountingHelpers'
import { taxRulesOf } from './taxRules'
import { useAccounting } from './useAccounting'
import type { AccountingValue } from './useAccounting'

type Tab = 'rates' | 'currencies' | 'pricing'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const fmtRate = (r: number) => (r >= 100 ? r.toLocaleString('en-US', { maximumFractionDigits: 2 }) : r.toLocaleString('en-US', { maximumFractionDigits: 4 }))

// Currencies the hotel takes, their daily rates to UGX, and how prices carry tax.
export default function CurrenciesPage() {
  const acc = useAccounting()
  const { tax, setTax, tenant } = useFeatures()
  const { role, can } = useAuth()
  const [tab, setTab] = useState<Tab>('rates')
  const [entering, setEntering] = useState<string | null>(null)
  const [chartCode, setChartCode] = useState('USD')
  const [convert, setConvert] = useState({ amount: '100', code: 'USD' })
  const [confirmFetch, setConfirmFetch] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const act = useRun()
  const canEdit = !!role && FINANCE_SETUP.includes(role.id)

  if (acc.loading) return <LoadingState />
  if (acc.error) return <ErrorState hint={acc.error} />

  const foreign = acc.currencies.filter((c) => !c.isBase)
  const active = foreign.filter((c) => c.active)
  const history = (code: string) => acc.rates.filter((r) => r.currencyCode === code).sort((a, b) => b.rateDate.localeCompare(a.rateDate))
  const latest = (code: string) => history(code)[0]
  const todayRate = (code: string) => acc.rates.find((r) => r.currencyCode === code && r.rateDate === TODAY)
  const missing = active.filter((c) => !todayRate(c.code))
  const usd = latest('USD')
  const conv = latest(convert.code)
  const rules = taxRulesOf(acc.propertyId, tax)

  async function fetchRates() {
    const ok = await act.run(async () => {
      for (const c of missing) {
        const last = latest(c.code)
        if (!last) continue
        // Stand-in for the Bank of Uganda feed: yesterday's rate moved a little.
        const rate = last.rate >= 100 ? Math.round(last.rate * 1.0015 * 100) / 100 : Math.round(last.rate * 1.0015 * 10000) / 10000
        await acc.service.saveExchangeRate({ currencyCode: c.code, rateDate: TODAY, rate, source: 'Bank of Uganda' }, acc.need())
      }
    })
    setConfirmFetch(false)
    if (ok) setMsg(`Today's rates added for ${missing.map((c) => c.code).join(', ')}.`)
  }

  type RateRow = { c: Currency; today?: ExchangeRate; prev?: ExchangeRate }
  const rateRows: RateRow[] = active.map((c) => {
    const h = history(c.code)
    const today = h.find((r) => r.rateDate === TODAY)
    return { c, today, prev: h.find((r) => r.rateDate < TODAY) }
  })
  const rateCols: Column<RateRow>[] = [
    { key: 'c', header: 'Currency', cell: (r) => (<span><span className="font-semibold">{r.c.code}</span> <span className="text-ink/60">{r.c.name}</span></span>) },
    { key: 't', header: 'Today', align: 'right', cell: (r) => (r.today ? <span className="font-semibold tabular-nums">{fmtRate(r.today.rate)}</span> : <Badge tone="warn">Missing</Badge>) },
    { key: 'p', header: 'Previous', align: 'right', hideBelow: 'sm', cell: (r) => (r.prev ? <span className="tabular-nums text-ink/60">{fmtRate(r.prev.rate)}</span> : '') },
    {
      key: 'ch',
      header: 'Change',
      align: 'right',
      hideBelow: 'md',
      cell: (r) => {
        if (!r.today || !r.prev) return ''
        const pct = (r.today.rate / r.prev.rate - 1) * 100
        return <span className={`tabular-nums ${pct > 0 ? 'text-good' : pct < 0 ? 'text-bad' : ''}`}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</span>
      },
    },
    { key: 's', header: 'Source', hideBelow: 'md', cell: (r) => (r.today ? <Badge tone={r.today.source === 'Manual' ? 'neutral' : 'info'}>{r.today.source}</Badge> : '') },
    {
      key: 'a',
      header: '',
      align: 'right',
      cell: (r) =>
        canEdit ? (
          <Button size="sm" variant="ghost" onClick={() => setEntering(r.c.code)}>
            {r.today ? 'Change' : 'Enter'}
          </Button>
        ) : null,
    },
  ]

  const chartHistory = history(chartCode).slice(0, 30).reverse()

  const currencyCols: Column<Currency>[] = [
    { key: 'c', header: 'Code', cell: (c) => <span className="font-semibold">{c.code}</span> },
    { key: 'n', header: 'Name', cell: (c) => c.name },
    { key: 's', header: 'Symbol', hideBelow: 'sm', cell: (c) => c.symbol },
    { key: 'r', header: 'Latest rate', align: 'right', cell: (c) => (c.isBase ? 'Base' : latest(c.code) ? <span className="tabular-nums">{fmtRate(latest(c.code)!.rate)}</span> : '-') },
    {
      key: 'a',
      header: 'In use',
      align: 'right',
      cell: (c) =>
        c.isBase ? (
          <Badge tone="brand">Base</Badge>
        ) : (
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={c.active}
              disabled={!canEdit || act.busy}
              onChange={(e) => act.run(() => acc.service.setCurrencyActive(c.code, e.target.checked, acc.need()))}
            />
            {c.active ? 'On' : 'Off'}
          </label>
        ),
    },
  ]

  const ruleCols: Column<TaxRule>[] = [
    { key: 'n', header: 'Tax', cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'r', header: 'Rate', align: 'right', cell: (r) => (r.kind === 'percent' ? `${r.rate}%` : ugx(r.rate)) },
    { key: 'i', header: 'Pricing', hideBelow: 'sm', cell: (r) => (r.inclusive ? 'Inside the price' : 'Added on top') },
    { key: 'a', header: 'Status', cell: (r) => <Badge tone={r.active ? 'good' : 'neutral'}>{r.active ? 'On' : 'Off'}</Badge> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Accounting" title="Currencies" description="Base UGX, foreign currencies, daily rates and tax pricing." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Base currency" icon="money" value="UGX" hint="Uganda shilling" />
        <StatCard label="In use" icon="list" value={active.length} hint={active.map((c) => c.code).join(', ')} />
        <StatCard label="Today's rates" icon="calendar" value={`${active.length - missing.length} of ${active.length}`} hint={missing.length ? `Missing ${missing.map((c) => c.code).join(', ')}` : 'All entered'} tone={missing.length ? 'warn' : 'good'} />
        <StatCard label="US dollar" icon="sparkles" value={usd ? fmtRate(usd.rate) : '-'} hint={usd ? `${usd.source}, ${shortDate(usd.rateDate)}` : ''} />
      </div>

      <Tabs<Tab>
        label="Currencies"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'rates', label: 'Exchange rates', alert: missing.length > 0 },
          { key: 'currencies', label: 'Currencies', count: acc.currencies.length },
          { key: 'pricing', label: 'Pricing and tax' },
        ]}
      />

      {msg && <Notice>{msg}</Notice>}
      <ErrorNote>{act.error}</ErrorNote>

      {tab === 'rates' && (
        <>
          <Card
            title={`Rates for ${dayMonth(TODAY)}`}
            icon="calendar"
            padded={false}
            description="UGX for one unit"
            actions={
              canEdit && missing.length > 0 ? (
                <Button size="sm" variant="secondary" disabled={act.busy} onClick={() => setConfirmFetch(true)}>
                  Fetch Bank of Uganda rates
                </Button>
              ) : undefined
            }
          >
            <DataTable columns={rateCols} rows={rateRows} rowKey={(r) => r.c.code} empty={{ title: 'No foreign currency in use' }} />
          </Card>

          <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card
              title="History"
              icon="sparkles"
              actions={
                <Select aria-label="Currency" value={chartCode} onChange={(e) => setChartCode(e.target.value)} className="w-auto py-1.5">
                  {foreign.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              }
            >
              <RateLine points={chartHistory.map((r) => ({ label: shortDate(r.rateDate), value: r.rate }))} />
              <ul className="mt-3 divide-y divide-ink/8 text-sm">
                {history(chartCode)
                  .slice(0, 5)
                  .map((r) => (
                    <li key={r.id} className="flex justify-between gap-3 py-1.5">
                      <span className="text-ink/70">
                        {dayMonth(r.rateDate)} · {r.source}
                        {r.enteredBy ? ` · ${r.enteredBy.name}` : ''}
                      </span>
                      <span className="tabular-nums font-medium">{fmtRate(r.rate)}</span>
                    </li>
                  ))}
              </ul>
            </Card>

            <Card title="Convert" icon="money">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input aria-label="Amount" inputMode="decimal" value={convert.amount} onChange={(e) => setConvert({ ...convert, amount: e.target.value.replace(/[^\d.]/g, '') })} />
                  <Select aria-label="Currency" value={convert.code} onChange={(e) => setConvert({ ...convert, code: e.target.value })} className="w-28">
                    {active.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </Select>
                </div>
                <p className="text-2xl font-bold tabular-nums">{conv ? ugx(Math.round(Number(convert.amount || 0) * conv.rate)) : '-'}</p>
                {conv && <p className="text-xs text-ink/55">At {fmtRate(conv.rate)}, {shortDate(conv.rateDate)}</p>}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'currencies' && (
        <Card title="Currencies" icon="list" padded={false}>
          <DataTable columns={currencyCols} rows={acc.currencies} rowKey={(c) => c.code} />
        </Card>
      )}

      {tab === 'pricing' && (
        <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
          <Card title="Room prices" icon="money" description={tenant.name}>
            {tax ? (
              <div className="space-y-3">
                {can('changeSettings') ? (
                  <Segmented
                    label="VAT in prices"
                    value={tax.vatMode}
                    onChange={(v) => setTax({ vatMode: v })}
                    options={[
                      { key: 'included', label: 'Tax inclusive' },
                      { key: 'added', label: 'Tax exclusive' },
                    ]}
                  />
                ) : (
                  <Badge tone="brand">{tax.vatMode === 'included' ? 'Tax inclusive' : 'Tax exclusive'}</Badge>
                )}
                <p className="text-sm text-ink/65">
                  {tax.vatMode === 'included' ? 'Rates contain VAT; postings split it out.' : 'VAT is added on top of the rate.'}
                </p>
                {!can('changeSettings') && <p className="text-xs text-ink/50">Set by the hotel admin or owner.</p>}
                {tax.lhtBand === 'star45' && usd && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 p-3 text-sm">
                    <span>
                      Local Hotel Tax USD rate: <span className="font-semibold tabular-nums">{fmtRate(tax.usdRate)}</span>
                    </span>
                    {Math.round(usd.rate) !== tax.usdRate && can('changeSettings') && (
                      <Button size="sm" variant="secondary" onClick={() => { setTax({ usdRate: Math.round(usd.rate) }); setMsg(`Local Hotel Tax now uses ${fmtRate(Math.round(usd.rate))}.`) }}>
                        Use {fmtRate(Math.round(usd.rate))}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink/60">Tax lines are not on this hotel's plan. Prices are taken as entered.</p>
            )}
          </Card>

          <FiscalCard acc={acc} canEdit={canEdit} />

          <Card
            title="Tax rules"
            icon="list"
            padded={false}
            className="lg:col-span-2"
            actions={
              <Link to="/admin/taxes" className="text-xs font-semibold text-brand hover:underline">
                Taxes and EFRIS
              </Link>
            }
          >
            <DataTable columns={ruleCols} rows={rules} rowKey={(r) => r.id} empty={{ title: 'No tax rules', hint: 'Tax lines are off for this hotel.' }} />
          </Card>
        </div>
      )}

      {entering && <RateDialog acc={acc} code={entering} last={latest(entering)} onClose={() => setEntering(null)} />}
      {confirmFetch && (
        <ConfirmDialog
          title="Fetch today's rates?"
          message={`Adds Bank of Uganda rates for ${missing.map((c) => c.code).join(', ')}.`}
          confirmLabel={act.busy ? 'Fetching…' : 'Fetch'}
          onConfirm={fetchRates}
          onCancel={() => setConfirmFetch(false)}
        />
      )}
    </div>
  )
}

function FiscalCard({ acc, canEdit }: { acc: AccountingValue; canEdit: boolean }) {
  const { run, busy, error } = useRun()
  const month = acc.settings?.fiscalYearStartMonth ?? 7
  return (
    <Card title="Fiscal year" icon="calendar">
      <div className="space-y-3">
        <Field label="Starts in" hint="Uganda's fiscal year starts in July">
          {(id) => (
            <Select id={id} value={month} disabled={!canEdit || busy} onChange={(e) => run(() => acc.service.saveSettings(acc.propertyId, { fiscalYearStartMonth: Number(e.target.value) }, acc.need()))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="text-xs text-ink/55">Trademate company {acc.settings?.trademateCompanyCode}</p>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}

function RateDialog({ acc, code, last, onClose }: { acc: AccountingValue; code: string; last?: ExchangeRate; onClose: () => void }) {
  const [date, setDate] = useState(TODAY)
  const [rate, setRate] = useState(last ? String(last.rate) : '')
  const [source, setSource] = useState<RateSource>('Manual')
  const { run, busy, error } = useRun()
  return (
    <Modal
      title={`${code} rate`}
      description={last ? `Last: ${fmtRate(last.rate)} on ${dayMonth(last.rateDate)} (${stampOf(last.enteredAt)})` : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => run(() => acc.service.saveExchangeRate({ currencyCode: code, rateDate: date, rate: Number(rate), source }, acc.need()), onClose)}>
            Save rate
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date" required>
          {(id) => <Input id={id} type="date" max={TODAY} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={`UGX for 1 ${code}`} required>
          {(id) => <Input id={id} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} />}
        </Field>
        <Field label="Source">
          {(id) => (
            <Select id={id} value={source} onChange={(e) => setSource(e.target.value as RateSource)}>
              <option>Manual</option>
              <option>Bank of Uganda</option>
              <option>Trademate</option>
            </Select>
          )}
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}
