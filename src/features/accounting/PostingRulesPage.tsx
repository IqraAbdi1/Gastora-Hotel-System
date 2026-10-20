import { useState } from 'react'
import { Badge, Button, Card, DataTable, ErrorState, Field, Input, LoadingState, Modal, PageHeader, Select, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import { ugx } from '../../lib/format'
import { useAuth } from '../auth/authContext'
import { applyRules } from '../../services/accounting/posting'
import type { GlAccount, PostingRule, TransactionCode, TransactionGroup } from '../../services/accounting/accountingTypes'
import { ErrorNote, FromTrademate } from './accountingUi'
import { FINANCE_SETUP, stampOf, useRun } from './accountingHelpers'
import { useAccounting } from './useAccounting'
import type { AccountingValue } from './useAccounting'

type Tab = 'rules' | 'test' | 'chart'

const GROUP_LABEL: Record<TransactionGroup, string> = {
  room: 'Rooms',
  fb: 'Food and beverage',
  minibar: 'Minibar',
  laundry: 'Laundry',
  'other-revenue': 'Other revenue',
  tax: 'Taxes',
  service: 'Service charge',
  payment: 'Payments',
  deposit: 'Deposits',
  refund: 'Refunds',
  commission: 'Commissions',
  receivable: 'Receivables',
}

type Row = { code: TransactionCode; rule?: PostingRule }

// Which Trademate account each hotel transaction goes to. The chart itself belongs to Trademate.
export default function PostingRulesPage() {
  const acc = useAccounting()
  const { role } = useAuth()
  const [tab, setTab] = useState<Tab>('rules')
  const [editing, setEditing] = useState<Row | null>(null)
  const [group, setGroup] = useState<TransactionGroup | 'all'>('all')
  const sync = useRun()
  const canEdit = !!role && FINANCE_SETUP.includes(role.id)

  if (acc.loading) return <LoadingState />
  if (acc.error) return <ErrorState hint={acc.error} />

  const account = (code: string) => acc.chart.find((a) => a.trademateCode === code)
  const centre = (id: string) => acc.centres.find((c) => c.id === id)
  const rows: Row[] = acc.codes.map((code) => ({ code, rule: acc.rules.find((r) => r.transactionCodeId === code.id) }))
  const problem = (r: Row) => !r.rule ? 'No rule' : !account(r.rule.debitAccount) || !account(r.rule.creditAccount) ? 'Unknown account' : null
  const problems = rows.filter((r) => problem(r))
  const shown = group === 'all' ? rows : rows.filter((r) => r.code.group === group)
  const groups = [...new Set(acc.codes.map((c) => c.group))]

  const acct = (code: string) => {
    const a = account(code)
    return (
      <span className={a ? '' : 'text-bad'}>
        <span className="font-mono text-xs">{code}</span> <span className="text-ink/70">{a?.trademateName ?? 'not in chart'}</span>
      </span>
    )
  }

  const cols: Column<Row>[] = [
    {
      key: 'code',
      header: 'Transaction',
      cell: (r) => (
        <div>
          <p className="font-medium text-ink">{r.code.name}</p>
          <p className="font-mono text-xs text-ink/50">{r.code.code}</p>
        </div>
      ),
    },
    { key: 'dr', header: 'Debit', cell: (r) => (r.rule ? acct(r.rule.debitAccount) : null) },
    { key: 'cr', header: 'Credit', cell: (r) => (r.rule ? acct(r.rule.creditAccount) : null) },
    { key: 'pc', header: 'Centre', hideBelow: 'md', cell: (r) => (r.rule ? centre(r.rule.profitCentreId)?.name : null) },
    {
      key: 'st',
      header: 'Status',
      cell: (r) => {
        const p = problem(r)
        return p ? <Badge tone="bad">{p}</Badge> : r.rule?.active ? <Badge tone="good">Active</Badge> : <Badge>Off</Badge>
      },
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (r) =>
        canEdit ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
            Edit
          </Button>
        ) : null,
    },
  ]

  const chartCols: Column<GlAccount>[] = [
    { key: 'code', header: 'Code', cell: (a) => <span className="font-mono text-xs">{a.trademateCode}</span> },
    { key: 'name', header: 'Account', cell: (a) => a.trademateName },
    { key: 'type', header: 'Type', cell: (a) => <Badge>{a.accountType}</Badge> },
    { key: 'used', header: 'Rules', align: 'right', hideBelow: 'sm', cell: (a) => acc.rules.filter((r) => r.debitAccount === a.trademateCode || r.creditAccount === a.trademateCode).length },
  ]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Accounting" title="Posting rules" description="Hotel transactions mapped to Trademate accounts and centres." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Transaction codes" icon="list" value={acc.codes.length} hint={`${groups.length} groups`} />
        <StatCard label="Active rules" icon="check" value={acc.rules.filter((r) => r.active).length} hint={`of ${acc.codes.length}`} />
        <StatCard label="Problems" icon="alert" value={problems.length} hint={problems[0]?.code.name ?? 'None'} tone={problems.length ? 'bad' : 'good'} />
        <StatCard label="Trademate chart" icon="calendar" value={acc.chart.length} hint={acc.settings ? `Synced ${stampOf(acc.settings.lastSyncAt)}` : ''} />
      </div>

      <Tabs<Tab>
        label="Posting rules"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'rules', label: 'Rules', alert: problems.length > 0 },
          { key: 'test', label: 'Test a posting' },
          { key: 'chart', label: 'Trademate chart', count: acc.chart.length },
        ]}
      />

      {tab === 'rules' && (
        <Card
          title="Rules"
          icon="list"
          padded={false}
          actions={
            <Select aria-label="Group" value={group} onChange={(e) => setGroup(e.target.value as TransactionGroup | 'all')} className="w-auto py-1.5">
              <option value="all">All groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABEL[g]}
                </option>
              ))}
            </Select>
          }
        >
          <DataTable columns={cols} rows={shown} rowKey={(r) => r.code.id} />
        </Card>
      )}

      {tab === 'test' && <TestPosting acc={acc} />}

      {tab === 'chart' && (
        <Card
          title="Chart of accounts"
          icon="list"
          padded={false}
          actions={
            <>
              <FromTrademate at={acc.settings?.lastSyncAt} />
              <Button size="sm" variant="secondary" disabled={sync.busy} onClick={() => sync.run(() => acc.service.syncFromTrademate(acc.propertyId, acc.need()))}>
                {sync.busy ? 'Syncing…' : 'Sync'}
              </Button>
            </>
          }
        >
          {sync.error && (
            <div className="p-3">
              <ErrorNote>{sync.error}</ErrorNote>
            </div>
          )}
          <DataTable columns={chartCols} rows={acc.chart} rowKey={(a) => a.id} />
        </Card>
      )}

      {editing && <RuleDialog row={editing} acc={acc} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RuleDialog({ row, acc, onClose }: { row: Row; acc: AccountingValue; onClose: () => void }) {
  const [debit, setDebit] = useState(row.rule?.debitAccount ?? '')
  const [credit, setCredit] = useState(row.rule?.creditAccount ?? '')
  const [centreId, setCentreId] = useState(row.rule?.profitCentreId ?? acc.centres[0]?.id ?? '')
  const [active, setActive] = useState(row.rule?.active ?? true)
  const { run, busy, error } = useRun()
  const known = (c: string) => acc.chart.some((a) => a.trademateCode === c)
  const options = (current: string) => (
    <>
      {!known(current) && current && <option value={current}>{current} (not in Trademate)</option>}
      {acc.chart.map((a) => (
        <option key={a.id} value={a.trademateCode}>
          {a.trademateCode} {a.trademateName}
        </option>
      ))}
    </>
  )
  return (
    <Modal
      title={`${row.code.name} (${row.code.code})`}
      description={row.rule ? `Last changed by ${row.rule.updatedBy.name}, ${stampOf(row.rule.updatedAt)}` : 'No rule yet'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => run(() => acc.service.savePostingRule(acc.propertyId, row.code.id, { debitAccount: debit, creditAccount: credit, profitCentreId: centreId, active }, acc.need()), onClose)}
          >
            Save rule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Debit account" required error={debit && !known(debit) ? 'Not in the Trademate chart' : undefined}>
          {(id) => (
            <Select id={id} value={debit} onChange={(e) => setDebit(e.target.value)}>
              <option value="">Choose</option>
              {options(debit)}
            </Select>
          )}
        </Field>
        <Field label="Credit account" required error={credit && !known(credit) ? 'Not in the Trademate chart' : undefined}>
          {(id) => (
            <Select id={id} value={credit} onChange={(e) => setCredit(e.target.value)}>
              <option value="">Choose</option>
              {options(credit)}
            </Select>
          )}
        </Field>
        <Field label="Profit or cost centre" required>
          {(id) => (
            <Select id={id} value={centreId} onChange={(e) => setCentreId(e.target.value)}>
              {acc.centres.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-brand" />
          Active
        </label>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}

function TestPosting({ acc }: { acc: AccountingValue }) {
  const [code, setCode] = useState(acc.codes[0]?.code ?? 'ROOM')
  const [amount, setAmount] = useState('250000')
  const [result, setResult] = useState<ReturnType<typeof applyRules> | null>(null)
  const centre = (id: string) => acc.centres.find((c) => c.id === id)?.name ?? ''
  const value = Number(amount)
  return (
    <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card title="Sample transaction" icon="sparkles">
        <div className="space-y-4">
          <Field label="Transaction code">
            {(id) => (
              <Select id={id} value={code} onChange={(e) => setCode(e.target.value)}>
                {acc.codes.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Amount (UGX)" hint="A negative amount tests a reversal" error={amount && !Number.isFinite(value) ? 'Enter a number' : undefined}>
            {(id) => <Input id={id} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d-]/g, ''))} />}
          </Field>
          <Button
            disabled={!value}
            onClick={() => setResult(applyRules([{ transactionCode: code, amount: value, description: 'Test' }], acc.codes, acc.rules, acc.chart))}
          >
            Test posting
          </Button>
        </div>
      </Card>
      <Card title="Result" icon="list" padded={false}>
        {!result ? (
          <p className="p-4 text-sm text-ink/55">Pick a code and an amount.</p>
        ) : (
          <>
            {result.errors.length > 0 && (
              <div className="space-y-1 p-3">
                {result.errors.map((e) => (
                  <ErrorNote key={e}>{e}</ErrorNote>
                ))}
              </div>
            )}
            <DataTable
              columns={[
                { key: 'acc', header: 'Account', cell: (l) => <span><span className="font-mono text-xs">{l.accountCode}</span> {l.accountName}</span> },
                { key: 'pc', header: 'Centre', hideBelow: 'sm', cell: (l) => centre(l.profitCentreId) },
                { key: 'dr', header: 'Debit', align: 'right', cell: (l) => (l.debit ? <span className="tabular-nums">{ugx(l.debit)}</span> : '') },
                { key: 'cr', header: 'Credit', align: 'right', cell: (l) => (l.credit ? <span className="tabular-nums">{ugx(l.credit)}</span> : '') },
              ]}
              rows={result.lines}
              rowKey={(l) => String(l.lineNo)}
              empty={{ title: 'No lines' }}
            />
            {result.lines.length > 0 && (
              <div className="flex justify-between border-t border-ink/10 px-4 py-2 text-sm">
                <span className="font-semibold">{result.totalDebit === result.totalCredit ? 'Balanced' : 'Out of balance'}</span>
                <span className="tabular-nums">
                  {ugx(result.totalDebit)} / {ugx(result.totalCredit)}
                </span>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
