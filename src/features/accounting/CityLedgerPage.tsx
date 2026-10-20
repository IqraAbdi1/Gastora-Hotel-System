import { useMemo, useState } from 'react'
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
  Select,
  StatCard,
  Tabs,
  Textarea,
} from '../../components/ui'
import type { Column } from '../../components/ui'
import { statements } from '../../lib/agents'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { useFeatures } from '../platform/featuresContext'
import type { CollectionNote, DirectBillAccount, DirectBillTransfer } from '../../services/accounting/accountingTypes'
import TransferDialog from './TransferDialog'
import { ErrorNote, FromTrademate, Notice } from './accountingUi'
import { daysBetween, shortDate, stampOf, useRun } from './accountingHelpers'
import { BUCKETS, ageing, balanceOf, bucketOf, limitOf, overdueOf, owing } from './ledger'
import { useAccounting } from './useAccounting'
import type { AccountingValue } from './useAccounting'

type Tab = 'accounts' | 'invoices' | 'ageing' | 'collections' | 'commissions'

// Direct billing: companies and agents the hotel invoices later. The receivable itself lives in Trademate.
export default function CityLedgerPage() {
  const acc = useAccounting()
  const { features, options } = useFeatures()
  const { reservations } = useHotel()
  const { byId } = useCorporate()
  const [tab, setTab] = useState<Tab>('accounts')
  const [transferring, setTransferring] = useState(false)
  const [opening, setOpening] = useState(false)
  const [panel, setPanel] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<{ accountId: string; kind: CollectionNote['kind'] } | null>(null)
  const [commission, setCommission] = useState<{ agentId: string; name: string; amount: number } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const send = useRun()

  const agentRows = useMemo(() => statements(options.agents, reservations), [options.agents, reservations])

  if (acc.loading) return <LoadingState />
  if (acc.error) return <ErrorState hint={acc.error} />

  const today = acc.businessDate
  const total = acc.transfers.reduce((n, t) => n + owing(t), 0)
  const overdue = overdueOf(acc.transfers, today)
  const buckets = ageing(acc.transfers, today)
  const live = acc.accounts.filter((a) => a.status !== 'closed')
  const overLimit = live.filter((a) => balanceOf(acc.transfers, a.id) > limitOf(a, byId))
  const sentTo = (agentId: string) => acc.commissions.filter((c) => c.agentId === agentId).reduce((n, c) => n + c.amount, 0)
  const commissionRows = agentRows.map((s) => ({ ...s, sent: sentTo(s.agent.id), due: Math.max(0, s.owedToAgent - sentTo(s.agent.id)) }))
  const commissionDue = commissionRows.reduce((n, r) => n + r.due, 0)
  const accountName = (id: string) => acc.accounts.find((a) => a.id === id)?.name ?? id

  const accountCols: Column<DirectBillAccount>[] = [
    {
      key: 'name',
      header: 'Account',
      cell: (a) => (
        <div>
          <p className="font-medium text-ink">{a.name}</p>
          <p className="text-xs text-ink/50">
            {a.kind === 'corporate' ? 'Company' : 'Travel agent'} · {a.trademateCustomerCode}
          </p>
        </div>
      ),
    },
    {
      key: 'use',
      header: 'Credit used',
      cell: (a) => {
        const bal = balanceOf(acc.transfers, a.id)
        const lim = limitOf(a, byId)
        const used = lim > 0 ? Math.round((bal / lim) * 100) : bal > 0 ? 100 : 0
        const pct = Math.min(100, used)
        return (
          <div className="w-40">
            <div className="flex justify-between text-xs tabular-nums">
              <span className={bal > lim ? 'font-semibold text-bad' : ''}>{ugx(bal)}</span>
              <span className="text-ink/50">{lim ? `${used}%` : 'No limit'}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/8">
              <div className={`h-full rounded-full ${bal > lim ? 'bg-bad' : pct > 80 ? 'bg-warn' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      },
    },
    { key: 'lim', header: 'Limit', align: 'right', hideBelow: 'sm', cell: (a) => <span className="tabular-nums">{ugx(limitOf(a, byId))}</span> },
    { key: 'terms', header: 'Terms', hideBelow: 'md', cell: (a) => `${a.paymentTermsDays} days` },
    { key: 'st', header: 'Status', cell: (a) => <Badge tone={a.status === 'active' ? 'good' : a.status === 'on-hold' ? 'warn' : 'neutral'}>{a.status === 'on-hold' ? 'On hold' : a.status === 'active' ? 'Active' : 'Closed'}</Badge> },
  ]

  const invoiceCols: Column<DirectBillTransfer>[] = [
    {
      key: 'inv',
      header: 'Invoice',
      cell: (t) => (
        <div>
          <p className="font-mono text-xs">{t.invoiceNo}</p>
          <p className="text-xs text-ink/55">{t.guest}</p>
        </div>
      ),
    },
    { key: 'acc', header: 'Account', hideBelow: 'sm', cell: (t) => accountName(t.accountId) },
    { key: 'date', header: 'Date', hideBelow: 'md', cell: (t) => shortDate(t.businessDate) },
    { key: 'due', header: 'Due', cell: (t) => <span className={owing(t) > 0 && t.dueDate < today ? 'font-semibold text-bad' : ''}>{shortDate(t.dueDate)}</span> },
    { key: 'amt', header: 'Amount', align: 'right', hideBelow: 'sm', cell: (t) => <span className="tabular-nums">{ugx(t.amount)}</span> },
    { key: 'paid', header: 'Received', align: 'right', hideBelow: 'lg', cell: (t) => <span className="tabular-nums text-ink/60">{ugx(t.paidAmount)}</span> },
    { key: 'owe', header: 'Owing', align: 'right', cell: (t) => <span className="font-medium tabular-nums">{ugx(owing(t))}</span> },
    {
      key: 'st',
      header: 'Trademate',
      hideBelow: 'md',
      cell: (t) => <Badge tone={t.trademateStatus === 'accepted' ? 'good' : 'info'}>{t.trademateStatus === 'accepted' ? 'In AR' : 'Sending'}</Badge>,
    },
  ]

  type AgeRow = { account: DirectBillAccount; b: Record<(typeof BUCKETS)[number], number>; total: number }
  const ageRows: AgeRow[] = live
    .map((a) => {
      const b = ageing(acc.transfers.filter((t) => t.accountId === a.id), today)
      return { account: a, b, total: BUCKETS.reduce((n, k) => n + b[k], 0) }
    })
    .filter((r) => r.total > 0)
  const ageCols: Column<AgeRow>[] = [
    { key: 'name', header: 'Account', cell: (r) => <span className="font-medium">{r.account.name}</span> },
    ...BUCKETS.map((k) => ({
      key: k,
      header: `${k} days`,
      align: 'right' as const,
      cell: (r: AgeRow) => <span className={`tabular-nums ${r.b[k] && (k === '61-90' || k === '90+') ? 'font-semibold text-bad' : r.b[k] ? '' : 'text-ink/35'}`}>{r.b[k] ? ugx(r.b[k]) : '-'}</span>,
    })),
    { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="font-semibold tabular-nums">{ugx(r.total)}</span> },
  ]

  const notes = [...acc.notes].sort((a, b) => b.at.localeCompare(a.at))
  const promisesDue = notes.filter((n) => n.kind === 'promise' && n.promisedDate && n.promisedDate <= today)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Accounting"
        title="City ledger"
        description="Direct-bill accounts, credit, ageing and collections."
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpening(true)}>
              Open account
            </Button>
            <Button onClick={() => setTransferring(true)}>Transfer from folio</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outstanding" icon="money" value={ugx(total)} hint={`${acc.transfers.filter((t) => owing(t) > 0).length} open invoices`} onClick={() => setTab('invoices')} />
        <StatCard label="Overdue" icon="alert" value={ugx(overdue)} hint={`90+ days ${ugx(buckets['90+'])}`} tone={overdue ? 'warn' : 'good'} onClick={() => setTab('ageing')} />
        <StatCard label="Accounts" icon="guests" value={live.length} hint={overLimit.length ? `${overLimit.length} over limit` : 'All within limit'} tone={overLimit.length ? 'bad' : 'default'} onClick={() => setTab('accounts')} />
        {features.travelAgents ? (
          <StatCard label="Commissions payable" icon="departure" value={ugx(commissionDue)} hint="To travel agents" onClick={() => setTab('commissions')} />
        ) : (
          <StatCard label="Promises due" icon="calendar" value={promisesDue.length} hint="Collections" onClick={() => setTab('collections')} />
        )}
      </div>

      <Tabs<Tab>
        label="City ledger"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'accounts', label: 'Accounts', count: live.length },
          { key: 'invoices', label: 'Invoices', count: acc.transfers.length },
          { key: 'ageing', label: 'Ageing' },
          { key: 'collections', label: 'Collections', count: notes.length, alert: promisesDue.length > 0 },
          ...(features.travelAgents ? [{ key: 'commissions' as const, label: 'Agent commissions' }] : []),
        ]}
      />

      {msg && <Notice>{msg}</Notice>}

      {tab === 'accounts' && (
        <Card title="Direct-bill accounts" icon="guests" padded={false}>
          <DataTable columns={accountCols} rows={acc.accounts} rowKey={(a) => a.id} onRowClick={(a) => setPanel(a.id)} empty={{ title: 'No direct-bill accounts' }} />
        </Card>
      )}

      {tab === 'invoices' && (
        <Card title="Invoices" icon="list" padded={false} actions={<FromTrademate at={acc.settings?.lastSyncAt} />} description="Received amounts come from Trademate">
          <DataTable columns={invoiceCols} rows={acc.transfers} rowKey={(t) => t.id} empty={{ title: 'Nothing transferred yet' }} />
        </Card>
      )}

      {tab === 'ageing' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {BUCKETS.map((k) => (
              <StatCard key={k} label={`${k} days`} value={ugx(buckets[k])} tone={buckets[k] && (k === '61-90' || k === '90+') ? 'bad' : 'default'} />
            ))}
          </div>
          <Card title="Ageing by account" icon="calendar" padded={false}>
            <DataTable columns={ageCols} rows={ageRows} rowKey={(r) => r.account.id} empty={{ title: 'Nothing owing' }} />
          </Card>
        </>
      )}

      {tab === 'collections' && (
        <Card title="Collections" icon="tasks" padded={false}>
          {notes.length === 0 ? (
            <p className="p-4 text-sm text-ink/55">No notes yet. Open an account to add one.</p>
          ) : (
            <ul className="divide-y divide-ink/8">
              {notes.map((n) => (
                <NoteItem key={n.id} note={n} accountName={accountName(n.accountId)} today={today} />
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'commissions' && features.travelAgents && (
        <Card title="Agent commissions" icon="departure" padded={false} description="Earned on completed stays; billed in Trademate AP">
          <DataTable
            columns={[
              { key: 'n', header: 'Agent', cell: (r) => <span className="font-medium">{r.agent.name}</span> },
              { key: 'b', header: 'Stays', align: 'right', hideBelow: 'sm', cell: (r) => r.completed },
              { key: 'e', header: 'Earned', align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular-nums">{ugx(r.owedToAgent)}</span> },
              { key: 's', header: 'Sent', align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular-nums text-ink/60">{ugx(r.sent)}</span> },
              { key: 'x', header: 'Expected', align: 'right', hideBelow: 'lg', cell: (r) => <span className="tabular-nums text-ink/50">{ugx(r.expected)}</span> },
              { key: 'd', header: 'Payable', align: 'right', cell: (r) => <span className="font-semibold tabular-nums">{r.agent.collectsPayment ? 'Net billing' : ugx(r.due)}</span> },
              {
                key: 'a',
                header: '',
                align: 'right',
                cell: (r) =>
                  r.due > 0 ? (
                    <Button size="sm" variant="secondary" onClick={() => setCommission({ agentId: r.agent.id, name: r.agent.name, amount: r.due })}>
                      Send to AP
                    </Button>
                  ) : null,
              },
            ]}
            rows={commissionRows}
            rowKey={(r) => r.agent.id}
            empty={{ title: 'No travel agents' }}
          />
          <div className="p-3">
            <ErrorNote>{send.error}</ErrorNote>
          </div>
        </Card>
      )}

      {transferring && <TransferDialog acc={acc} onClose={() => setTransferring(false)} />}
      {opening && <OpenAccountDialog acc={acc} onClose={() => setOpening(false)} />}
      {panel && <AccountPanel acc={acc} id={panel} onClose={() => setPanel(null)} onNote={(kind) => setNoteFor({ accountId: panel, kind })} />}
      {noteFor && <NoteDialog acc={acc} accountId={noteFor.accountId} kind={noteFor.kind} onClose={() => setNoteFor(null)} />}
      {commission && (
        <ConfirmDialog
          title="Send commission to Trademate?"
          message={`${ugx(commission.amount)} goes to Trademate accounts payable as a bill from ${commission.name}.`}
          confirmLabel={send.busy ? 'Sending…' : 'Send'}
          onCancel={() => setCommission(null)}
          onConfirm={async () => {
            const ok = await send.run(() => acc.service.sendCommission(acc.propertyId, commission.agentId, commission.name, commission.amount, acc.need()))
            if (ok) setMsg(`Commission for ${commission.name} sent to Trademate.`)
            setCommission(null)
          }}
        />
      )}
    </div>
  )
}

const NOTE_LABEL: Record<CollectionNote['kind'], string> = { note: 'Note', reminder: 'Reminder sent', promise: 'Promise to pay' }

function NoteItem({ note, accountName, today }: { note: CollectionNote; accountName?: string; today: string }) {
  const late = note.kind === 'promise' && note.promisedDate && note.promisedDate < today
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={note.kind === 'promise' ? (late ? 'bad' : 'warn') : note.kind === 'reminder' ? 'info' : 'neutral'}>{NOTE_LABEL[note.kind]}</Badge>
        {accountName && <span className="font-medium">{accountName}</span>}
        {note.promisedDate && <span className="text-xs text-ink/60">by {dayMonth(note.promisedDate)}</span>}
      </div>
      <p className="mt-1 text-ink/80">{note.text}</p>
      <p className="text-xs text-ink/50">
        {note.by.name}, {stampOf(note.at)}
      </p>
    </li>
  )
}

function AccountPanel({ acc, id, onClose, onNote }: { acc: AccountingValue; id: string; onClose: () => void; onNote: (k: CollectionNote['kind']) => void }) {
  const { byId } = useCorporate()
  const { role } = useAuth()
  const a = acc.accounts.find((x) => x.id === id)
  const [limit, setLimit] = useState(String(a?.creditLimit ?? 0))
  const [terms, setTerms] = useState(String(a?.paymentTermsDays ?? 30))
  const save = useRun()
  const [saved, setSaved] = useState(false)
  if (!a) return null
  const bal = balanceOf(acc.transfers, a.id)
  const lim = limitOf(a, byId)
  const transfers = acc.transfers.filter((t) => t.accountId === a.id)
  const notes = acc.notes.filter((n) => n.accountId === a.id)
  const canLimit = role?.id === 'owner' || role?.id === 'finance'
  const oldest = transfers.filter((t) => owing(t) > 0).sort((x, y) => x.businessDate.localeCompare(y.businessDate))[0]

  return (
    <Modal title={a.name} description={`${a.kind === 'corporate' ? 'Company' : 'Travel agent'} · ${a.trademateCustomerCode}`} onClose={onClose} side wide>
      <div className="space-y-5 text-sm">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink/55">Owing</dt>
            <dd className={`font-semibold tabular-nums ${bal > lim ? 'text-bad' : ''}`}>{ugx(bal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/55">Limit</dt>
            <dd className="font-semibold tabular-nums">{ugx(lim)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/55">Available</dt>
            <dd className="font-semibold tabular-nums">{ugx(Math.max(0, lim - bal))}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink/55">Oldest</dt>
            <dd className="font-semibold">{oldest ? `${daysBetween(oldest.businessDate, acc.businessDate)} days (${bucketOf(oldest.businessDate, acc.businessDate)})` : '-'}</dd>
          </div>
        </dl>

        <section className="space-y-3 rounded-lg border border-ink/10 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Terms</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {a.kind === 'corporate' ? (
              <div>
                <p className="text-sm font-medium text-ink/80">Credit limit</p>
                <p className="text-sm">{ugx(lim)}</p>
                <Link to="/desk/companies" className="text-xs font-semibold text-brand hover:underline">
                  Set on the company account
                </Link>
              </div>
            ) : (
              <Field label="Credit limit (UGX)" hint={canLimit ? undefined : 'Owner or finance only'}>
                {(fid) => <Input id={fid} inputMode="numeric" disabled={!canLimit} value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ''))} />}
              </Field>
            )}
            <Field label="Payment terms (days)">
              {(fid) => <Input id={fid} inputMode="numeric" value={terms} onChange={(e) => setTerms(e.target.value.replace(/[^\d]/g, ''))} />}
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={save.busy}
              onClick={() => {
                setSaved(false)
                const patch: { paymentTermsDays: number; creditLimit?: number } = { paymentTermsDays: Number(terms) }
                if (a.kind === 'agent' && canLimit && Number(limit) !== a.creditLimit) patch.creditLimit = Number(limit)
                save.run(() => acc.service.updateDirectBillAccount(acc.propertyId, a.id, patch, acc.need()), () => setSaved(true))
              }}
            >
              Save terms
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={save.busy}
              onClick={() => save.run(() => acc.service.updateDirectBillAccount(acc.propertyId, a.id, { status: a.status === 'active' ? 'on-hold' : 'active' }, acc.need()))}
            >
              {a.status === 'active' ? 'Put on hold' : 'Make active'}
            </Button>
            {saved && <span className="text-xs font-medium text-good">Saved</span>}
          </div>
          <ErrorNote>{save.error}</ErrorNote>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/50">Invoices</h3>
          {transfers.length === 0 ? (
            <p className="text-ink/55">None yet.</p>
          ) : (
            <ul className="divide-y divide-ink/8">
              {transfers.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="font-mono text-xs">{t.invoiceNo}</span> <span className="text-ink/70">{t.guest}</span>
                    <span className="block text-xs text-ink/50">
                      {shortDate(t.businessDate)} · due {shortDate(t.dueDate)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {ugx(owing(t))}
                    {t.paidAmount > 0 && <span className="block text-xs text-ink/50">of {ugx(t.amount)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Collections</h3>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => onNote('note')}>
                Note
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onNote('promise')}>
                Promise
              </Button>
              <Button size="sm" variant="secondary" disabled={!a.contactEmail} onClick={() => onNote('reminder')}>
                Send reminder
              </Button>
            </div>
          </div>
          {notes.length === 0 ? (
            <p className="text-ink/55">No notes.</p>
          ) : (
            <ul className="-mx-4 divide-y divide-ink/8">
              {notes.map((n) => (
                <NoteItem key={n.id} note={n} today={acc.businessDate} />
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-ink/50">
          {a.contactName} · {a.contactEmail || 'no email'}
        </p>
      </div>
    </Modal>
  )
}

function NoteDialog({ acc, accountId, kind, onClose }: { acc: AccountingValue; accountId: string; kind: CollectionNote['kind']; onClose: () => void }) {
  const a = acc.accounts.find((x) => x.id === accountId)
  const owingNow = balanceOf(acc.transfers, accountId)
  const [text, setText] = useState(kind === 'reminder' ? `Statement of ${ugx(owingNow)} emailed to ${a?.contactName ?? 'the contact'}.` : '')
  const [date, setDate] = useState('')
  const { run, busy, error } = useRun()
  const title = kind === 'reminder' ? 'Send reminder' : kind === 'promise' ? 'Promise to pay' : 'Collection note'
  return (
    <Modal
      title={title}
      description={a?.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => run(() => acc.service.addCollectionNote(acc.propertyId, { accountId, kind, text, promisedDate: date || undefined }, acc.need()), onClose)}>
            {kind === 'reminder' ? 'Send' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {kind === 'reminder' && <p className="text-sm text-ink/70">To {a?.contactEmail}</p>}
        <Field label={kind === 'reminder' ? 'Message' : 'Note'} required>
          {(id) => <Textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        {kind === 'promise' && (
          <Field label="Promised by" required>
            {(id) => <Input id={id} type="date" value={date} min={acc.businessDate} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}

function OpenAccountDialog({ acc, onClose }: { acc: AccountingValue; onClose: () => void }) {
  const { accounts: companies } = useCorporate()
  const { options, features } = useFeatures()
  const [kind, setKind] = useState<'corporate' | 'agent'>('corporate')
  const taken = (k: string, id: string) => acc.accounts.some((a) => a.kind === k && a.sourceId === id && a.status !== 'closed')
  const choices =
    kind === 'corporate'
      ? companies.filter((c) => (c.status === 'active' || c.status === 'on-hold') && !taken('corporate', c.id)).map((c) => ({ id: c.id, name: c.name, limit: c.creditLimit, contact: c.contacts.find((x) => x.canApproveCharges) ?? c.contacts[0], email: c.billing.invoiceEmail || c.email }))
      : options.agents.filter((g) => g.active && !taken('agent', g.id)).map((g) => ({ id: g.id, name: g.name, limit: 0, contact: { name: g.contact }, email: g.email ?? '' }))
  const [sourceId, setSourceId] = useState('')
  const pick = choices.find((c) => c.id === sourceId) ?? choices[0]
  const [limit, setLimit] = useState('1000000')
  const [terms, setTerms] = useState('30')
  const { run, busy, error } = useRun()
  return (
    <Modal
      title="Open direct-bill account"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !pick}
            onClick={() =>
              pick &&
              run(
                () =>
                  acc.service.openDirectBillAccount(
                    acc.propertyId,
                    {
                      kind,
                      sourceId: pick.id,
                      name: pick.name,
                      creditLimit: kind === 'corporate' ? pick.limit : Number(limit),
                      paymentTermsDays: Number(terms),
                      contactName: pick.contact?.name ?? '',
                      contactEmail: pick.email,
                    },
                    acc.need(),
                  ),
                onClose,
              )
            }
          >
            Open account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="For">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => { setKind(e.target.value as 'corporate' | 'agent'); setSourceId('') }}>
              <option value="corporate">A company (corporate account)</option>
              {features.travelAgents && <option value="agent">A travel agent</option>}
            </Select>
          )}
        </Field>
        <Field label={kind === 'corporate' ? 'Company' : 'Agent'} required>
          {(id) => (
            <Select id={id} value={pick?.id ?? ''} onChange={(e) => setSourceId(e.target.value)}>
              {choices.length === 0 && <option value="">None left to add</option>}
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {kind === 'corporate' ? (
          <p className="text-sm text-ink/70">Credit limit {ugx(pick?.limit ?? 0)}, from the company account.</p>
        ) : (
          <Field label="Credit limit (UGX)">
            {(id) => <Input id={id} inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ''))} />}
          </Field>
        )}
        <Field label="Payment terms (days)">
          {(id) => <Input id={id} inputMode="numeric" value={terms} onChange={(e) => setTerms(e.target.value.replace(/[^\d]/g, ''))} />}
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  )
}
