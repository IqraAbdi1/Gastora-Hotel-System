import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, DataTable, Input, Modal, PageHeader, StatCard, Tabs } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { depositStatus } from '../../services/events/eventsRules'
import type { Contract, DepositSchedule, EventsData, Quote, QuoteLine } from '../../services/events/eventsTypes'
import { SignDialog } from './BeoTab'
import { ErrorNote } from './ErrorNote'
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, LINE_KIND_LABEL, QUOTE_STATUS_LABEL, QUOTE_STATUS_TONE, addDays, num, stampText, ugxShort } from './eventsUi'
import PaymentDialog from './PaymentDialog'
import QuoteBuilder from './QuoteBuilder'
import { useEvents, useRun } from './useEvents'

type Tab = 'quotes' | 'contracts' | 'deposits'
const DEP_TONE = { paid: 'good', part: 'warn', overdue: 'bad', due: 'neutral' } as const
const DEP_LABEL = { paid: 'Paid', part: 'Part paid', overdue: 'Overdue', due: 'Due' } as const

export default function QuotesPage() {
  const { data, loading } = useEvents()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('quotes')
  const [building, setBuilding] = useState<{ quote?: Quote; newFor?: string } | null>(params.get('newFor') ? { newFor: params.get('newFor') as string } : null)
  const [openQuote, setOpenQuote] = useState<string | null>(params.get('open'))
  const [openContract, setOpenContract] = useState<string | null>(null)
  const [paying, setPaying] = useState<DepositSchedule | null>(null)

  const versionOf = (q: Quote) => data.quoteVersions.find((v) => v.quoteId === q.id && v.version === q.currentVersion)
  const clientOf = (q: Quote) => data.bookings.find((b) => b.id === q.eventBookingId)?.clientName ?? data.leads.find((l) => l.id === q.leadId)?.clientName ?? ''
  const eventName = (id: string) => data.bookings.find((b) => b.id === id)?.name ?? id
  const open = data.quotes.filter((q) => q.status === 'draft' || q.status === 'sent')
  const accepted = data.quotes.filter((q) => q.status === 'accepted')
  const liveContracts = new Set(data.contracts.filter((c) => c.status !== 'cancelled').map((c) => c.id))
  const deposits = data.depositSchedules.filter((d) => liveContracts.has(d.contractId)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const depRows = deposits.map((d) => ({ ...d, ...depositStatus(d, data.payments, TODAY) }))
  const overdue = depRows.filter((d) => d.status === 'overdue')
  const dueSoon = depRows.filter((d) => d.status !== 'paid' && d.dueDate <= addDays(TODAY, 30))
  const received = data.payments.reduce((s, p) => s + p.amount, 0)
  const contractOf = (d: DepositSchedule) => data.contracts.find((c) => c.id === d.contractId)

  const closeQuote = () => {
    setOpenQuote(null)
    if (params.get('open')) setParams({}, { replace: true })
  }
  const shownQuote = data.quotes.find((q) => q.id === openQuote)
  const shownContract = data.contracts.find((c) => c.id === openContract)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Events and sales"
        title="Quotes and contracts"
        description="Proposals and amendments, contracts and deposit schedules."
        actions={<Button onClick={() => setBuilding({})}>New quote</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open quotes" value={ugxShort(open.reduce((s, q) => s + (versionOf(q)?.total ?? 0), 0))} hint={`${open.length} draft or sent`} icon="list" />
        <StatCard label="Accepted" value={ugxShort(accepted.reduce((s, q) => s + (versionOf(q)?.total ?? 0), 0))} hint={`${accepted.length} quotes`} tone="good" icon="check" />
        <StatCard label="Deposits due" value={ugxShort(dueSoon.reduce((s, d) => s + d.outstanding, 0))} hint={overdue.length ? `${overdue.length} overdue` : 'Next 30 days'} tone={overdue.length ? 'bad' : 'default'} icon="alert" onClick={() => setTab('deposits')} />
        <StatCard label="Received" value={ugxShort(received)} hint={`${data.payments.length} payments`} icon="money" />
      </div>

      <Tabs
        label="Sales documents"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'quotes', label: 'Quotes', count: data.quotes.length },
          { key: 'contracts', label: 'Contracts', count: data.contracts.length },
          { key: 'deposits', label: 'Deposits', count: depRows.filter((d) => d.status !== 'paid').length, alert: overdue.length > 0 },
        ]}
      />

      {tab === 'quotes' && (
        <Card padded={false}>
          <DataTable
            rows={data.quotes}
            rowKey={(q) => q.id}
            onRowClick={(q) => setOpenQuote(q.id)}
            empty={{ title: 'No quotes yet' }}
            columns={[
              { key: 'n', header: 'Quote', cell: (q) => <span className="font-mono text-xs font-semibold text-ink">{q.number}</span> },
              {
                key: 't',
                header: 'Event',
                cell: (q) => (
                  <div>
                    <p className="font-medium text-ink">{q.title}</p>
                    <p className="text-xs text-ink/55">{clientOf(q)}</p>
                  </div>
                ),
              },
              { key: 'v', header: 'Version', cell: (q) => `v${q.currentVersion}`, hideBelow: 'md' },
              { key: 'total', header: 'Total', cell: (q) => ugx(versionOf(q)?.total ?? 0), align: 'right' },
              { key: 's', header: 'Status', cell: (q) => <Badge tone={QUOTE_STATUS_TONE[q.status]}>{QUOTE_STATUS_LABEL[q.status]}</Badge> },
              {
                key: 'valid',
                header: 'Valid until',
                hideBelow: 'lg',
                cell: (q) => <span className={q.validUntil < TODAY && q.status !== 'accepted' ? 'text-bad' : ''}>{dayMonth(q.validUntil)}</span>,
              },
            ]}
          />
        </Card>
      )}

      {tab === 'contracts' && (
        <Card padded={false}>
          <DataTable
            rows={data.contracts}
            rowKey={(c) => c.id}
            onRowClick={(c) => setOpenContract(c.id)}
            empty={{ title: 'No contracts yet', hint: 'Accepting a quote drafts one.' }}
            columns={[
              { key: 'n', header: 'Contract', cell: (c) => <span className="font-mono text-xs font-semibold text-ink">{c.number}</span> },
              { key: 'e', header: 'Event', cell: (c) => <span className="font-medium text-ink">{eventName(c.eventBookingId)}</span> },
              { key: 'v', header: 'Value', cell: (c) => ugx(c.value), align: 'right' },
              {
                key: 'p',
                header: 'Paid',
                align: 'right',
                hideBelow: 'md',
                cell: (c) => {
                  const rows = data.depositSchedules.filter((d) => d.contractId === c.id)
                  return ugx(rows.reduce((s, d) => s + depositStatus(d, data.payments, TODAY).paid, 0))
                },
              },
              { key: 's', header: 'Status', cell: (c) => <Badge tone={CONTRACT_STATUS_TONE[c.status]}>{CONTRACT_STATUS_LABEL[c.status]}</Badge> },
            ]}
          />
        </Card>
      )}

      {tab === 'deposits' && (
        <Card padded={false}>
          <DataTable
            rows={depRows}
            rowKey={(d) => d.id}
            empty={{ title: 'No deposit schedules' }}
            columns={[
              { key: 'due', header: 'Due', cell: (d) => dayMonth(d.dueDate) },
              {
                key: 'e',
                header: 'Event',
                cell: (d) => (
                  <div>
                    <p className="font-medium text-ink">{eventName(contractOf(d)?.eventBookingId ?? '')}</p>
                    <p className="text-xs text-ink/55">
                      {contractOf(d)?.number} · {d.label}
                    </p>
                  </div>
                ),
              },
              { key: 'a', header: 'Amount', cell: (d) => ugx(d.amount), align: 'right', hideBelow: 'md' },
              { key: 'o', header: 'Outstanding', cell: (d) => ugx(d.outstanding), align: 'right' },
              { key: 's', header: 'Status', cell: (d) => <Badge tone={DEP_TONE[d.status]}>{DEP_LABEL[d.status]}</Badge> },
              {
                key: 'x',
                header: '',
                cell: (d) =>
                  d.status !== 'paid' && (
                    <Button size="sm" variant="secondary" onClick={() => setPaying(d)}>
                      Record payment
                    </Button>
                  ),
              },
            ]}
          />
        </Card>
      )}

      {building && !loading && (
        <QuoteBuilder
          data={data}
          quote={building.quote}
          newFor={building.newFor}
          onClose={() => {
            setBuilding(null)
            if (params.get('newFor')) setParams({}, { replace: true })
          }}
          onSaved={(q) => {
            setBuilding(null)
            setParams({}, { replace: true })
            setOpenQuote(q.id)
          }}
        />
      )}
      {shownQuote && !building && (
        <QuotePanel
          quote={shownQuote}
          data={data}
          onClose={closeQuote}
          onAmend={() => setBuilding({ quote: shownQuote })}
          onContract={(id) => {
            closeQuote()
            setTab('contracts')
            setOpenContract(id)
          }}
        />
      )}
      {shownContract && <ContractPanel contract={shownContract} data={data} onClose={() => setOpenContract(null)} onPay={setPaying} />}
      {paying && (
        <PaymentDialog
          eventBookingId={contractOf(paying)?.eventBookingId ?? ''}
          depositScheduleId={paying.id}
          label={`${eventName(contractOf(paying)?.eventBookingId ?? '')} · ${paying.label}`}
          amount={depositStatus(paying, data.payments, TODAY).outstanding}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  )
}

function QuotePanel({ quote, data, onClose, onAmend, onContract }: { quote: Quote; data: EventsData; onClose: () => void; onAmend: () => void; onContract: (id: string) => void }) {
  const { service, actor } = useEvents()
  const { busy, error, run } = useRun()
  const versions = data.quoteVersions.filter((v) => v.quoteId === quote.id).sort((a, b) => b.version - a.version)
  const [shown, setShown] = useState(quote.currentVersion)
  const [declining, setDeclining] = useState(false)
  const v = versions.find((x) => x.version === shown) ?? versions[0]
  const prevV = versions.find((x) => x.version === (v?.version ?? 0) - 1)
  const lines = data.quoteLines.filter((l) => l.quoteVersionId === v?.id)
  const prevLines = prevV ? data.quoteLines.filter((l) => l.quoteVersionId === prevV.id) : []
  const contract = data.contracts.find((c) => c.quoteId === quote.id && c.status !== 'cancelled')
  const diff = prevV ? lineDiff(prevLines, lines) : []

  return (
    <Modal title={`${quote.number} · ${quote.title}`} description={`Valid until ${dayMonth(quote.validUntil)}`} onClose={onClose} side wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={QUOTE_STATUS_TONE[quote.status]} dot>
            {QUOTE_STATUS_LABEL[quote.status]}
          </Badge>
          {quote.sentAt && <span className="text-xs text-ink/55">Sent {stampText(quote.sentAt)}</span>}
          {quote.acceptedAt && <span className="text-xs text-ink/55">· accepted {stampText(quote.acceptedAt)}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {quote.status === 'draft' && (
            <Button size="sm" disabled={busy} onClick={() => run(() => service.sendQuote(quote.id, actor))}>
              Send to client
            </Button>
          )}
          {quote.status === 'sent' && (
            <>
              <Button size="sm" disabled={busy} onClick={() => run(() => service.acceptQuote(quote.id, actor))}>
                Client accepted
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeclining(true)}>
                Declined
              </Button>
            </>
          )}
          {quote.status !== 'declined' && (
            <Button size="sm" variant="secondary" onClick={onAmend}>
              Amend
            </Button>
          )}
          {contract && (
            <Button size="sm" variant="ghost" onClick={() => onContract(contract.id)}>
              Contract {contract.number}
            </Button>
          )}
          {quote.eventBookingId && (
            <Link to={`/events/bookings/${quote.eventBookingId}`} className="self-center text-sm font-semibold text-brand hover:underline">
              Event
            </Link>
          )}
        </div>
        <ErrorNote error={error} />

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Version {v?.version}</p>
            {versions.length > 1 && (
              <div className="flex gap-1">
                {[...versions].reverse().map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setShown(x.version)}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${x.version === shown ? 'bg-brand text-white' : 'bg-ink/8 text-ink/70'}`}
                  >
                    v{x.version}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 overflow-x-auto rounded-lg border border-ink/10">
            <table className="w-full text-sm">
              <thead className="bg-canvas/50 text-xs text-ink/55">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <span className="text-ink">{l.description}</span>
                      <span className="ml-2 text-[11px] text-ink/45">{LINE_KIND_LABEL[l.kind]}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{ugx(l.unitPrice)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{ugx(l.quantity * l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              {v && (
                <tfoot className="border-t border-ink/10 text-sm">
                  <tr>
                    <td colSpan={3} className="px-3 py-1.5 text-right text-ink/60">
                      Discount {v.discountPct}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">− {ugx(v.discount)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-3 py-1.5 text-right font-semibold">
                      Total
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-bold tabular-nums">{ugx(v.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {prevV && v && (
          <div>
            <p className="text-sm font-semibold text-ink">
              Changes from v{prevV.version}{' '}
              <span className={v.total >= prevV.total ? 'text-good' : 'text-bad'}>
                ({v.total >= prevV.total ? '+' : '−'} {ugx(Math.abs(v.total - prevV.total))})
              </span>
            </p>
            <p className="mt-0.5 text-xs text-ink/60">{v.reason}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {diff.map((d, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className={d.kind === 'added' ? 'text-good' : d.kind === 'removed' ? 'text-bad' : 'text-ink'}>
                    {d.kind === 'added' ? '+ ' : d.kind === 'removed' ? '− ' : '~ '}
                    {d.text}
                  </span>
                  <span className={`whitespace-nowrap tabular-nums ${d.delta >= 0 ? 'text-good' : 'text-bad'}`}>
                    {d.delta >= 0 ? '+' : '−'} {ugx(Math.abs(d.delta))}
                  </span>
                </li>
              ))}
              {prevV.discountPct !== v.discountPct && (
                <li className="text-ink">
                  ~ Discount {prevV.discountPct}% to {v.discountPct}%
                </li>
              )}
            </ul>
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-ink">Versions</p>
          <ol className="mt-2 space-y-1 text-sm text-ink/70">
            {versions.map((x, i) => {
              const before = versions[i + 1]
              return (
                <li key={x.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    v{x.version} · {x.reason} · {x.createdBy}, {stampText(x.createdAt)}
                  </span>
                  <span className="tabular-nums">
                    {ugx(x.total)}
                    {before && (
                      <span className={x.total >= before.total ? 'text-good' : 'text-bad'}>
                        {' '}
                        ({x.total >= before.total ? '+' : '−'}
                        {ugxShort(Math.abs(x.total - before.total)).replace('UGX ', '')})
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
      {declining && (
        <ConfirmDialog
          title="Client declined?"
          message="The quote is closed. You can still start a new one."
          confirmLabel="Mark declined"
          danger
          onCancel={() => setDeclining(false)}
          onConfirm={() => {
            setDeclining(false)
            void run(() => service.declineQuote(quote.id, actor))
          }}
        />
      )}
    </Modal>
  )
}

function lineDiff(before: QuoteLine[], after: QuoteLine[]) {
  const key = (l: QuoteLine) => `${l.kind}|${l.refId ?? ''}|${l.description}`
  const out: { kind: 'added' | 'removed' | 'changed'; text: string; delta: number }[] = []
  for (const a of after) {
    const b = before.find((x) => key(x) === key(a))
    const total = a.quantity * a.unitPrice
    if (!b) out.push({ kind: 'added', text: `${a.description} (${a.quantity} × ${ugx(a.unitPrice)})`, delta: total })
    else if (b.quantity !== a.quantity || b.unitPrice !== a.unitPrice)
      out.push({ kind: 'changed', text: `${a.description}: ${b.quantity} → ${a.quantity}${b.unitPrice !== a.unitPrice ? `, ${ugx(b.unitPrice)} → ${ugx(a.unitPrice)}` : ''}`, delta: total - b.quantity * b.unitPrice })
  }
  for (const b of before) if (!after.some((a) => key(a) === key(b))) out.push({ kind: 'removed', text: b.description, delta: -b.quantity * b.unitPrice })
  return out
}

function ContractPanel({ contract, data, onClose, onPay }: { contract: Contract; data: EventsData; onClose: () => void; onPay: (d: DepositSchedule) => void }) {
  const { service, actor } = useEvents()
  const { busy, error, run } = useRun()
  const [signing, setSigning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [editing, setEditing] = useState(false)
  const booking = data.bookings.find((b) => b.id === contract.eventBookingId)
  const rows = data.depositSchedules.filter((d) => d.contractId === contract.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const payments = data.payments.filter((p) => p.eventBookingId === contract.eventBookingId)
  const scheduled = rows.reduce((s, r) => s + r.amount, 0)
  const paid = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <Modal title={`Contract ${contract.number}`} description={booking?.name} onClose={onClose} side wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CONTRACT_STATUS_TONE[contract.status]} dot>
            {CONTRACT_STATUS_LABEL[contract.status]}
          </Badge>
          <span className="text-sm text-ink/65">
            Quote v{contract.quoteVersion} · {ugx(contract.value)}
          </span>
          {contract.signedAt && <span className="text-xs text-ink/55">Signed by {contract.signedBy}, {stampText(contract.signedAt)}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {contract.status === 'draft' && (
            <Button size="sm" disabled={busy} onClick={() => run(() => service.sendContract(contract.id, actor))}>
              Send for signature
            </Button>
          )}
          {contract.status === 'sent' && (
            <Button size="sm" onClick={() => setSigning(true)}>
              Record signature
            </Button>
          )}
          {contract.status !== 'cancelled' && (
            <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
              Cancel contract
            </Button>
          )}
        </div>
        <ErrorNote error={error} />
        <p className="text-sm text-ink/70">{contract.cancellationTerms}</p>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Deposit schedule</p>
            {contract.status !== 'cancelled' && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit schedule
              </Button>
            )}
          </div>
          <ul className="mt-2 divide-y divide-ink/8 rounded-lg border border-ink/10">
            {rows.map((r) => {
              const s = depositStatus(r, data.payments, TODAY)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink">{r.label}</p>
                    <p className="text-xs text-ink/55">
                      Due {dayMonth(r.dueDate)} · {ugx(r.amount)}
                      {s.paid > 0 && s.status !== 'paid' ? ` · ${ugx(s.paid)} paid` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={DEP_TONE[s.status]}>{DEP_LABEL[s.status]}</Badge>
                    {s.status !== 'paid' && contract.status !== 'cancelled' && (
                      <Button size="sm" variant="secondary" onClick={() => onPay(r)}>
                        Record payment
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-ink/60">
            Scheduled {ugx(scheduled)} of {ugx(contract.value)} · received {ugx(paid)}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Payments</p>
          {payments.length === 0 ? (
            <p className="mt-1 text-sm text-ink/55">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-ink/75">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {stampText(p.receivedAt)} · {p.method} {p.reference} · {p.receivedBy}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">{ugx(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {signing && (
        <SignDialog title="Client signature" defaultName={booking?.contactName ?? ''} onClose={() => setSigning(false)} onSign={(name) => service.signContract(contract.id, name, actor)} />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Cancel this contract?"
          message="Deposits already received stay on record. The event itself is not cancelled."
          confirmLabel="Cancel contract"
          danger
          onCancel={() => setCancelling(false)}
          onConfirm={() => {
            setCancelling(false)
            void run(() => service.cancelContract(contract.id, actor))
          }}
        />
      )}
      {editing && <DepositEditor contract={contract} rows={rows} onClose={() => setEditing(false)} />}
    </Modal>
  )
}

function DepositEditor({ contract, rows, onClose }: { contract: Contract; rows: DepositSchedule[]; onClose: () => void }) {
  const { service, actor } = useEvents()
  const { busy, error, run } = useRun()
  const [list, setList] = useState(rows.map((r) => ({ id: r.id as string | undefined, label: r.label, dueDate: r.dueDate, amount: String(r.amount) })))
  const sum = list.reduce((s, r) => s + num(r.amount), 0)
  const save = async () => {
    if (await run(() => service.saveDepositSchedule(contract.id, list.map((r) => ({ id: r.id, label: r.label, dueDate: r.dueDate, amount: num(r.amount) })), actor))) onClose()
  }
  return (
    <Modal
      title="Deposit schedule"
      description={`Contract ${contract.number} · ${ugx(contract.value)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {list.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_150px_130px_auto]">
            <div className="col-span-3 sm:col-span-1">
              <Input value={r.label} aria-label="Label" onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </div>
            <Input type="date" value={r.dueDate} aria-label="Due" onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
            <Input value={r.amount} aria-label="Amount" inputMode="numeric" onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
            <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => setList(list.filter((_, j) => j !== i))}>
              ×
            </Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setList([...list, { id: undefined, label: 'Deposit', dueDate: addDays(TODAY, 14), amount: String(Math.max(0, contract.value - sum)) }])}>
          Add deposit
        </Button>
        <p className={`text-sm ${sum > contract.value ? 'font-semibold text-bad' : 'text-ink/65'}`}>
          Scheduled {ugx(sum)} of {ugx(contract.value)}
        </p>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}
