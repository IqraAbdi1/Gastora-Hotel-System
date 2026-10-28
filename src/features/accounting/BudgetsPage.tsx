import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, ErrorState, Field, Input, LoadingState, Modal, PageHeader, Select, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { accountingService } from '../../services'
import { periodsFrom } from '../../services/accounting/accountingSeed'
import type { Budget, ProfitCentre } from '../../services/accounting/accountingTypes'
import { ErrorNote, FromTrademate, Notice } from './accountingUi'
import { useRun } from './accountingHelpers'
import { loadAccounting, useAccounting } from './useAccounting'
import type { AccountingData, AccountingValue } from './useAccounting'

type Tab = 'actual' | 'budget' | 'centres' | 'group'

const monthLabel = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const pct = (actual: number, budget: number) => (budget ? Math.round(((actual - budget) / budget) * 1000) / 10 : 0)

/** How much of a month's budget counts by today: all of a past month, part of this one, none of a later one. */
function shareToDate(period: string): number {
  const current = TODAY.slice(0, 7)
  if (period < current) return 1
  if (period > current) return 0
  const days = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate()
  return Number(TODAY.slice(8, 10)) / days
}

interface CentreFigures {
  centre: ProfitCentre
  budget: number
  actual: number
  ytdBudget: number
  ytdActual: number
}

function figures(d: Pick<AccountingData, 'centres' | 'budgetLines' | 'actuals'>, budget: Budget | undefined, period: string): CentreFigures[] {
  if (!budget) return []
  const periods = periodsFrom(budget.startPeriod)
  return d.centres
    .filter((c) => c.active)
    .map((centre) => {
      const lines = d.budgetLines.filter((l) => l.budgetId === budget.id && l.profitCentreId === centre.id)
      const acts = d.actuals.filter((a) => a.profitCentreId === centre.id)
      const b = (p: string) => lines.find((l) => l.period === p)?.amount ?? 0
      const a = (p: string) => acts.find((x) => x.period === p)?.amount ?? 0
      const upTo = periods.filter((p) => p <= period)
      return {
        centre,
        budget: Math.round((b(period) * shareToDate(period)) / 1000) * 1000,
        actual: a(period),
        ytdBudget: upTo.reduce((n, p) => n + Math.round((b(p) * shareToDate(p)) / 1000) * 1000, 0),
        ytdActual: upTo.reduce((n, p) => n + a(p), 0),
      }
    })
}

const sum = (rows: CentreFigures[], k: keyof Omit<CentreFigures, 'centre'>) => rows.reduce((n, r) => n + r[k], 0)

// Departments as profit and cost centres, their monthly budgets, and what Trademate says they did.
export default function BudgetsPage() {
  const acc = useAccounting()
  const { features, tenants, tenant } = useFeatures()
  const { role } = useAuth()
  const [tab, setTab] = useState<Tab>('actual')
  const budget = acc.budgets[0]
  const periods = budget ? periodsFrom(budget.startPeriod) : []
  const current = TODAY.slice(0, 7)
  const [period, setPeriod] = useState(current)
  const [editing, setEditing] = useState<ProfitCentre | null>(null)
  const [centreForm, setCentreForm] = useState<ProfitCentre | 'new' | null>(null)
  const [approving, setApproving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const act = useRun()
  const siblings = tenant.group ? tenants.filter((t) => t.group === tenant.group) : []
  const showGroup = features.groupConsolidation && siblings.length > 1
  const canApprove = role?.id === 'owner' || role?.id === 'finance'

  if (acc.loading) return <LoadingState />
  if (acc.error) return <ErrorState hint={acc.error} />

  const rows = figures(acc, budget, period)
  const profit = rows.filter((r) => r.centre.kind === 'profit')
  const cost = rows.filter((r) => r.centre.kind === 'cost')
  const revVar = pct(sum(profit, 'ytdActual'), sum(profit, 'ytdBudget'))
  const costVar = pct(sum(cost, 'ytdActual'), sum(cost, 'ytdBudget'))

  const varCell = (actual: number, budgetAmt: number, isCost: boolean) => {
    const v = actual - budgetAmt
    const good = isCost ? v <= 0 : v >= 0
    return (
      <span className={`tabular-nums ${good ? 'text-good' : 'text-bad'}`}>
        {v > 0 ? '+' : ''}
        {ugx(v)} <span className="text-xs">({pct(actual, budgetAmt) > 0 ? '+' : ''}{pct(actual, budgetAmt)}%)</span>
      </span>
    )
  }

  type Row = CentreFigures | { total: string; rows: CentreFigures[]; isCost: boolean }
  const isTotal = (r: Row): r is { total: string; rows: CentreFigures[]; isCost: boolean } => 'total' in r
  const tableRows: Row[] = [...profit, { total: 'Revenue', rows: profit, isCost: false }, ...cost, { total: 'Costs', rows: cost, isCost: true }]
  const val = (r: Row, k: keyof Omit<CentreFigures, 'centre'>) => (isTotal(r) ? sum(r.rows, k) : r[k])
  const costOf = (r: Row) => (isTotal(r) ? r.isCost : r.centre.kind === 'cost')
  const cols: Column<Row>[] = [
    {
      key: 'c',
      header: 'Centre',
      cell: (r) =>
        isTotal(r) ? (
          <span className="font-bold">{r.total}</span>
        ) : (
          <span>
            <span className="font-medium">{r.centre.name}</span> <span className="font-mono text-xs text-ink/45">{r.centre.code}</span>
          </span>
        ),
    },
    { key: 'b', header: 'Budget', align: 'right', cell: (r) => <span className={`tabular-nums ${isTotal(r) ? 'font-bold' : ''}`}>{ugx(val(r, 'budget'))}</span> },
    { key: 'a', header: 'Actual', align: 'right', cell: (r) => <span className={`tabular-nums ${isTotal(r) ? 'font-bold' : ''}`}>{ugx(val(r, 'actual'))}</span> },
    { key: 'v', header: 'Variance', align: 'right', hideBelow: 'sm', cell: (r) => varCell(val(r, 'actual'), val(r, 'budget'), costOf(r)) },
    { key: 'yb', header: 'YTD budget', align: 'right', hideBelow: 'xl', cell: (r) => <span className="tabular-nums text-ink/70">{ugx(val(r, 'ytdBudget'))}</span> },
    { key: 'ya', header: 'YTD actual', align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular-nums">{ugx(val(r, 'ytdActual'))}</span> },
    {
      key: 'yv',
      header: 'YTD',
      align: 'right',
      hideBelow: 'lg',
      cell: (r) => {
        const v = pct(val(r, 'ytdActual'), val(r, 'ytdBudget'))
        const good = costOf(r) ? v <= 0 : v >= 0
        return <span className={`tabular-nums text-xs font-semibold ${good ? 'text-good' : 'text-bad'}`}>{v > 0 ? '+' : ''}{v}%</span>
      },
    },
  ]

  const lineOf = (centreId: string, p: string) => acc.budgetLines.find((l) => l.budgetId === budget?.id && l.profitCentreId === centreId && l.period === p)?.amount ?? 0
  const budgetCols: Column<ProfitCentre>[] = [
    { key: 'c', header: 'Centre', cell: (c) => <span className="font-medium">{c.name}</span> },
    ...periods.map((p) => ({ key: p, header: monthLabel(p), align: 'right' as const, cell: (c: ProfitCentre) => <span className="tabular-nums text-xs">{(lineOf(c.id, p) / 1_000_000).toFixed(1)}M</span> })),
    { key: 't', header: 'Year', align: 'right', cell: (c) => <span className="font-semibold tabular-nums">{ugx(periods.reduce((n, p) => n + lineOf(c.id, p), 0))}</span> },
    {
      key: 'e',
      header: '',
      align: 'right',
      cell: (c) => (
        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
          Edit
        </Button>
      ),
    },
  ]

  const centreCols: Column<ProfitCentre>[] = [
    { key: 'code', header: 'Code', cell: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { key: 'name', header: 'Name', cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'kind', header: 'Kind', cell: (c) => <Badge tone={c.kind === 'profit' ? 'good' : 'neutral'}>{c.kind === 'profit' ? 'Profit' : 'Cost'}</Badge> },
    { key: 'dept', header: 'Department', hideBelow: 'sm', cell: (c) => c.department },
    { key: 'rules', header: 'Rules', align: 'right', hideBelow: 'md', cell: (c) => acc.rules.filter((r) => r.profitCentreId === c.id).length },
    { key: 'st', header: 'Status', cell: (c) => <Badge tone={c.active ? 'good' : 'neutral'}>{c.active ? 'Active' : 'Off'}</Badge> },
    {
      key: 'e',
      header: '',
      align: 'right',
      cell: (c) => (
        <Button size="sm" variant="ghost" onClick={() => setCentreForm(c)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Accounting"
        title="Budgets and centres"
        description="Profit and cost centres, monthly budgets and actuals from Trademate."
        meta={budget && <Badge tone={budget.status === 'approved' ? 'good' : 'warn'}>{budget.name} · {budget.status === 'approved' ? 'Approved' : 'Draft'}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue to date" icon="money" value={ugx(sum(profit, 'ytdActual'))} hint={`Budget ${ugx(sum(profit, 'ytdBudget'))}`} />
        <StatCard label="Revenue variance" icon="sparkles" value={`${revVar > 0 ? '+' : ''}${revVar}%`} hint="Year to date" tone={revVar >= 0 ? 'good' : 'bad'} />
        <StatCard label="Costs to date" icon="list" value={ugx(sum(cost, 'ytdActual'))} hint={`Budget ${ugx(sum(cost, 'ytdBudget'))}`} />
        <StatCard label="Cost variance" icon="alert" value={`${costVar > 0 ? '+' : ''}${costVar}%`} hint="Year to date" tone={costVar <= 0 ? 'good' : 'warn'} />
      </div>

      <Tabs<Tab>
        label="Budgets"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'actual', label: 'Budget vs actual' },
          { key: 'budget', label: 'Monthly budget' },
          { key: 'centres', label: 'Centres', count: acc.centres.length },
          ...(showGroup ? [{ key: 'group' as const, label: tenant.group ?? 'Group' }] : []),
        ]}
      />

      {msg && <Notice>{msg}</Notice>}

      {tab === 'actual' && (
        <Card
          title="Budget vs actual"
          icon="sparkles"
          padded={false}
          actions={
            <>
              <FromTrademate at={acc.settings?.lastSyncAt} />
              <div className="w-40">
              <Select aria-label="Month" value={period} onChange={(e) => setPeriod(e.target.value)} className="py-1.5">
                {periods.filter((p) => p <= current).map((p) => (
                  <option key={p} value={p}>
                    {monthLabel(p)}
                    {p === current ? ' (to date)' : ''}
                  </option>
                ))}
              </Select>
              </div>
            </>
          }
        >
          <DataTable columns={cols} rows={tableRows} rowKey={(r) => (isTotal(r) ? `t-${r.total}` : r.centre.id)} empty={{ title: 'No budget yet' }} />
        </Card>
      )}

      {tab === 'budget' && budget && (
        <Card
          title={budget.name}
          icon="calendar"
          padded={false}
          description={budget.status === 'approved' ? `Approved by ${budget.approvedBy?.name}` : 'Draft'}
          actions={
            budget.status === 'draft' && canApprove ? (
              <Button size="sm" onClick={() => setApproving(true)}>
                Approve budget
              </Button>
            ) : undefined
          }
        >
          <ErrorNote>{act.error}</ErrorNote>
          <DataTable columns={budgetCols} rows={acc.centres.filter((c) => c.active)} rowKey={(c) => c.id} />
        </Card>
      )}

      {tab === 'centres' && (
        <Card
          title="Profit and cost centres"
          icon="list"
          padded={false}
          actions={
            <Button size="sm" variant="secondary" onClick={() => setCentreForm('new')}>
              Add centre
            </Button>
          }
        >
          <DataTable columns={centreCols} rows={acc.centres} rowKey={(c) => c.id} />
        </Card>
      )}

      {tab === 'group' && showGroup && <GroupView ids={siblings.map((t) => ({ id: t.id, name: t.name }))} />}

      {editing && budget && <BudgetDialog acc={acc} budget={budget} centre={editing} periods={periods} lineOf={lineOf} onClose={() => setEditing(null)} />}
      {centreForm && <CentreDialog acc={acc} centre={centreForm === 'new' ? null : centreForm} onClose={() => setCentreForm(null)} />}
      {approving && budget && (
        <ConfirmDialog
          title="Approve this budget?"
          message={`${budget.name} becomes the approved budget. Later changes need the owner or finance.`}
          confirmLabel={act.busy ? 'Approving…' : 'Approve'}
          onCancel={() => setApproving(false)}
          onConfirm={async () => {
            const ok = await act.run(() => acc.service.approveBudget(acc.propertyId, budget.id, acc.need()))
            setApproving(false)
            if (ok) setMsg(`${budget.name} approved.`)
          }}
        />
      )}
    </div>
  )
}

function BudgetDialog({
  acc,
  budget,
  centre,
  periods,
  lineOf,
  onClose,
}: {
  acc: AccountingValue
  budget: Budget
  centre: ProfitCentre
  periods: string[]
  lineOf: (c: string, p: string) => number
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(periods.map((p) => [p, String(lineOf(centre.id, p))])))
  const [annual, setAnnual] = useState('')
  const { run, busy, error } = useRun()
  const total = periods.reduce((n, p) => n + (Number(values[p]) || 0), 0)
  return (
    <Modal
      title={centre.name}
      description={`${budget.name} · ${centre.kind === 'profit' ? 'revenue' : 'cost'}`}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="mr-auto self-center text-sm font-semibold tabular-nums">Year {ugx(total)}</span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              run(() => acc.service.saveBudgetLines(acc.propertyId, budget.id, centre.id, Object.fromEntries(periods.map((p) => [p, Number(values[p] || 0)])), acc.need()), onClose)
            }
          >
            Save budget
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Spread a year total evenly">
            {(id) => <Input id={id} inputMode="numeric" value={annual} onChange={(e) => setAnnual(e.target.value.replace(/[^\d]/g, ''))} className="w-44" />}
          </Field>
          <Button
            variant="ghost"
            disabled={!annual}
            onClick={() => {
              const each = Math.round(Number(annual) / 12 / 1000) * 1000
              setValues(Object.fromEntries(periods.map((p, i) => [p, String(i === 11 ? Number(annual) - each * 11 : each)])))
            }}
          >
            Spread
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {periods.map((p) => (
            <Field key={p} label={monthLabel(p)}>
              {(id) => <Input id={id} inputMode="numeric" value={values[p]} onChange={(e) => setValues({ ...values, [p]: e.target.value.replace(/[^\d]/g, '') })} />}
            </Field>
          ))}
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}

function CentreDialog({ acc, centre, onClose }: { acc: AccountingValue; centre: ProfitCentre | null; onClose: () => void }) {
  const [code, setCode] = useState(centre?.code ?? '')
  const [name, setName] = useState(centre?.name ?? '')
  const [kind, setKind] = useState<'profit' | 'cost'>(centre?.kind ?? 'profit')
  const [department, setDepartment] = useState(centre?.department ?? '')
  const [active, setActive] = useState(centre?.active ?? true)
  const { run, busy, error } = useRun()
  return (
    <Modal
      title={centre ? centre.name : 'New centre'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => run(() => acc.service.saveProfitCentre(acc.propertyId, { id: centre?.id, code, name, kind, department, active }, acc.need()), onClose)}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" required>
            {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={10} />}
          </Field>
          <Field label="Kind">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as 'profit' | 'cost')}>
                <option value="profit">Profit centre</option>
                <option value="cost">Cost centre</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label="Name" required>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Department">
          {(id) => <Input id={id} value={department} onChange={(e) => setDepartment(e.target.value)} />}
        </Field>
        {centre && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}

/** Every property of the group side by side, year to date. */
function GroupView({ ids }: { ids: { id: string; name: string }[] }) {
  const [data, setData] = useState<Record<string, AccountingData>>({})
  const key = ids.map((x) => x.id).join(',')
  useEffect(() => {
    let alive = true
    const load = () =>
      Promise.all(key.split(',').map((id) => loadAccounting(id).then((d) => [id, d] as const))).then((pairs) => alive && setData(Object.fromEntries(pairs)))
    load()
    const stop = accountingService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [key])

  const rows = useMemo(
    () =>
      ids.map(({ id, name }) => {
        const d = data[id]
        const f = d ? figures(d, d.budgets[0], TODAY.slice(0, 7)) : []
        const profit = f.filter((r) => r.centre.kind === 'profit')
        const cost = f.filter((r) => r.centre.kind === 'cost')
        return {
          id,
          name,
          revB: sum(profit, 'ytdBudget'),
          revA: sum(profit, 'ytdActual'),
          costB: sum(cost, 'ytdBudget'),
          costA: sum(cost, 'ytdActual'),
          cl: d ? d.transfers.reduce((n, t) => n + t.amount - t.paidAmount, 0) : 0,
        }
      }),
    [ids, data],
  )
  type R = (typeof rows)[number]
  const total: R = rows.reduce((t, r) => ({ ...t, revB: t.revB + r.revB, revA: t.revA + r.revA, costB: t.costB + r.costB, costA: t.costA + r.costA, cl: t.cl + r.cl }), {
    id: 'total',
    name: 'Group total',
    revB: 0,
    revA: 0,
    costB: 0,
    costA: 0,
    cl: 0,
  })
  const strong = (r: R, v: number) => <span className={`tabular-nums ${r.id === 'total' ? 'font-bold' : ''}`}>{ugx(v)}</span>
  return (
    <Card title="Consolidated, year to date" icon="occupancy" padded={false} actions={<FromTrademate />}>
      {Object.keys(data).length === 0 ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={[
            { key: 'n', header: 'Property', cell: (r) => <span className={r.id === 'total' ? 'font-bold' : 'font-medium'}>{r.name}</span> },
            { key: 'rb', header: 'Revenue budget', align: 'right', hideBelow: 'md', cell: (r) => strong(r, r.revB) },
            { key: 'ra', header: 'Revenue', align: 'right', cell: (r) => strong(r, r.revA) },
            { key: 'rv', header: 'Variance', align: 'right', hideBelow: 'sm', cell: (r) => <span className={r.revA >= r.revB ? 'text-good' : 'text-bad'}>{pct(r.revA, r.revB)}%</span> },
            { key: 'ca', header: 'Costs', align: 'right', hideBelow: 'sm', cell: (r) => strong(r, r.costA) },
            { key: 'gp', header: 'Contribution', align: 'right', cell: (r) => strong(r, r.revA - r.costA) },
            { key: 'cl', header: 'City ledger', align: 'right', hideBelow: 'lg', cell: (r) => strong(r, r.cl) },
          ]}
          rows={[...rows, total]}
          rowKey={(r) => r.id}
        />
      )}
    </Card>
  )
}
