import { useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, LoadingState, Modal, PageHeader, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import type { Column } from '../../components/ui'
import { ugx } from '../../lib/format'
import type { Rfq, RfqQuote } from '../../services/procurement/procurementTypes'
import { useAuth } from '../auth/authContext'
import { RFQ_STATUS, addDaysIso, shortDate } from './procurementUi'
import { useRequests } from './requestsContext'
import { sameName } from './requestsModel'
import { useProcurement } from './useProcurement'

// Area I: requests for quotation. Made from an approved requisition, sent to approved suppliers,
// compared side by side and awarded. The award becomes a purchase order in the existing flow.

type View = 'open' | 'decided' | 'all'

const lineTotal = (q: RfqQuote, rfq: Rfq) => q.prices.reduce((s, p, i) => s + p * rfq.lines[i].qty, 0)
const complete = (q: RfqQuote) => q.prices.every((p) => p > 0)

export default function RfqPage() {
  const { data, run, actor } = useProcurement()
  const { requests, suppliers, orders } = useRequests()
  const { can } = useAuth()
  const [view, setView] = useState<View>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const buyer = !!actor && ['owner', 'admin', 'gm', 'procurement'].includes(actor.role)
  const rfqs = useMemo(() => data?.rfqs ?? [], [data])
  const quotes = useMemo(() => data?.quotes ?? [], [data])

  if (!data) return <LoadingState />

  const today = new Date().toISOString().slice(0, 10)
  const quotesOf = (id: string) => quotes.filter((q) => q.rfqId === id)
  const open = rfqs.filter((r) => r.status === 'open')
  const due = open.filter((r) => r.dueOn <= today)
  const waitingPo = rfqs.filter((r) => r.status === 'awarded')
  const saved = rfqs
    .filter((r) => r.awardedSupplier)
    .reduce((s, r) => {
      const qs = quotesOf(r.id).filter(complete)
      const won = qs.find((q) => q.supplierName === r.awardedSupplier)
      if (!won || qs.length < 2) return s
      return s + Math.max(...qs.map((q) => lineTotal(q, r))) - lineTotal(won, r)
    }, 0)

  const rows = rfqs.filter((r) => (view === 'open' ? r.status === 'open' : view === 'decided' ? r.status === 'awarded' || r.status === 'ordered' : true))
  const poFor = (r: Rfq) => (r.poId ? orders.find((o) => o.id === r.poId) : undefined) ?? orders.find((o) => o.requestId === r.requisitionId)

  const columns: Column<Rfq>[] = [
    { key: 'id', header: 'RFQ', cell: (r) => <span className="font-semibold">{r.id}</span> },
    { key: 'title', header: 'For', cell: (r) => <span className="block max-w-56 truncate">{r.title}</span> },
    { key: 'req', header: 'Requisition', cell: (r) => r.requisitionId, hideBelow: 'md' },
    { key: 'quotes', header: 'Quotes', cell: (r) => `${quotesOf(r.id).length} of ${r.invited.length}`, align: 'right' },
    { key: 'due', header: 'Due', cell: (r) => <span className={r.status === 'open' && r.dueOn <= today ? 'font-semibold text-warn' : ''}>{shortDate(r.dueOn)}</span>, hideBelow: 'sm' },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <span className="flex items-center gap-2">
          <Badge tone={RFQ_STATUS[r.status].tone}>{RFQ_STATUS[r.status].label}</Badge>
          {r.status === 'ordered' && poFor(r) && <span className="text-xs text-ink/55">{poFor(r)?.id}</span>}
        </span>
      ),
    },
  ]

  const current = rfqs.find((r) => r.id === openId)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Procurement"
        title="Quotations"
        description="Ask approved suppliers to quote, compare side by side and award."
        actions={buyer && <Button onClick={() => setCreating(true)}>New RFQ</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open" value={open.length} icon="list" onClick={() => setView('open')} active={view === 'open'} />
        <StatCard label="Due" value={due.length} icon="calendar" tone={due.length ? 'warn' : 'default'} />
        <StatCard label="No PO yet" value={waitingPo.length} icon="tasks" tone={waitingPo.length ? 'warn' : 'default'} onClick={() => setView('decided')} active={view === 'decided'} />
        <StatCard label="Saved" value={ugx(saved)} icon="money" tone="good" hint="Highest quote less the award" />
      </div>
      <Card padded={false}>
        <div className="border-b border-ink/10 px-4 pt-3">
          <Tabs
            label="Quotations"
            value={view}
            onChange={setView}
            tabs={[
              { key: 'open', label: 'Open', count: open.length },
              { key: 'decided', label: 'Awarded', count: rfqs.filter((r) => r.status === 'awarded' || r.status === 'ordered').length },
              { key: 'all', label: 'All', count: rfqs.length },
            ]}
          />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => setOpenId(r.id)} empty={{ title: 'No quotation requests here' }} />
      </Card>

      {creating && <NewRfqDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id) }} />}
      {current && (
        <RfqDetail
          rfq={current}
          quotes={quotesOf(current.id)}
          buyer={buyer}
          canPurchase={can('purchase')}
          poId={poFor(current)?.id}
          suppliers={suppliers.filter((s) => s.active).map((s) => s.name)}
          requisitionOpen={requests.some((r) => r.id === current.requisitionId && r.status === 'Approved')}
          onClose={() => setOpenId(null)}
          run={run}
        />
      )}
    </div>
  )
}

function NewRfqDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { data, run, propertyId, service } = useProcurement()
  const { requests, suppliers, stock } = useRequests()
  const taken = new Set((data?.rfqs ?? []).filter((r) => r.status !== 'cancelled').map((r) => r.requisitionId))
  const ready = requests.filter((r) => r.status === 'Approved' && !taken.has(r.id))
  const [reqId, setReqId] = useState(ready[0]?.id ?? '')
  const req = ready.find((r) => r.id === reqId)
  const [title, setTitle] = useState(req?.reason || '')
  const [dueOn, setDueOn] = useState(addDaysIso(3))
  const [picked, setPicked] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const itemOf = (name: string) => stock.find((s) => sameName(s.name, name))
  // Suppliers approved for the requisition's items or their categories come first and are ticked.
  const approvedNames = new Set(
    (data?.approved ?? [])
      .filter((a) => req?.items.some((i) => (a.itemName ? sameName(a.itemName, i.name) : sameName(a.category ?? '', itemOf(i.name)?.category ?? ''))))
      .map((a) => a.supplierName),
  )
  const active = suppliers.filter((s) => s.active).sort((a, b) => Number(approvedNames.has(b.name)) - Number(approvedNames.has(a.name)))
  const invited = picked ?? active.filter((s) => approvedNames.has(s.name)).map((s) => s.name)

  async function save() {
    if (!req) return setError('Pick an approved requisition.')
    let created = ''
    const err = await run(async (a) => {
      const r = await service.createRfq(
        { propertyId, requisitionId: req.id, title: title || req.items.map((i) => i.name).join(', '), dueOn, invited, lines: req.items.map((i) => ({ itemName: i.name, qty: i.qty, unit: itemOf(i.name)?.unit ?? 'piece' })) },
        a,
      )
      created = r.id
    })
    if (err) setError(err)
    else onCreated(created)
  }

  return (
    <Modal
      title="New request for quotation"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!req}>Send to {invited.length} suppliers</Button>
        </>
      }
    >
      {ready.length === 0 ? (
        <EmptyState title="No approved requisitions waiting" hint="A requisition needs approval before it goes out for quotes." />
      ) : (
        <div className="space-y-4">
          <Field label="Approved requisition" required>
            {(id) => (
              <Select id={id} value={reqId} onChange={(e) => { setReqId(e.target.value); setPicked(null); setTitle(ready.find((r) => r.id === e.target.value)?.reason ?? '') }}>
                {ready.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.department} · {r.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is being bought" />}</Field>
            <Field label="Quotes due" required>{(id) => <Input id={id} type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />}</Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-ink/80">Invite suppliers</p>
            <ul className="divide-y divide-ink/8 rounded-lg border border-ink/10">
              {active.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={invited.includes(s.name)}
                      onChange={(e) => setPicked(e.target.checked ? [...invited, s.name] : invited.filter((n) => n !== s.name))}
                    />
                    <span className="flex-1">{s.name}</span>
                    {approvedNames.has(s.name) && <Badge tone="good">Approved</Badge>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {error && <p className="text-sm font-medium text-bad">{error}</p>}
        </div>
      )}
    </Modal>
  )
}

function RfqDetail({
  rfq,
  quotes,
  buyer,
  canPurchase,
  poId,
  suppliers,
  requisitionOpen,
  onClose,
  run,
}: {
  rfq: Rfq
  quotes: RfqQuote[]
  buyer: boolean
  canPurchase: boolean
  poId?: string
  suppliers: string[]
  requisitionOpen: boolean
  onClose: () => void
  run: ReturnType<typeof useProcurement>['run']
}) {
  const { service } = useProcurement()
  const { purchase } = useRequests()
  const [quoteFor, setQuoteFor] = useState<string | null>(null)
  const [awarding, setAwarding] = useState<RfqQuote | null>(null)
  const [note, setNote] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [inviting, setInviting] = useState('')
  const [error, setError] = useState<string | null>(null)

  const full = quotes.filter(complete)
  const cheapest = full.length ? Math.min(...full.map((q) => lineTotal(q, rfq))) : 0
  const bestPrice = rfq.lines.map((_, i) => Math.min(...quotes.map((q) => q.prices[i]).filter((p) => p > 0)))
  const notInvited = suppliers.filter((s) => !rfq.invited.includes(s))
  const awardedQuote = quotes.find((q) => q.supplierName === rfq.awardedSupplier)

  const act = async (fn: Parameters<typeof run>[0]) => {
    const e = await run(fn)
    setError(e)
    return e
  }

  async function raisePo() {
    if (!awardedQuote || !rfq.awardedSupplier) return
    const e = purchase(rfq.requisitionId, rfq.awardedSupplier, awardedQuote.prices)
    if (e) return setError(e)
    await act((a) => service.markOrdered(rfq.id, undefined, a))
  }

  return (
    <Modal side wide title={`${rfq.id} · ${rfq.title}`} description={`${rfq.requisitionId} · due ${shortDate(rfq.dueOn)} · by ${rfq.createdBy}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={RFQ_STATUS[rfq.status].tone}>{RFQ_STATUS[rfq.status].label}</Badge>
          {rfq.awardedSupplier && <span className="text-sm text-ink/70">Awarded to <b>{rfq.awardedSupplier}</b> by {rfq.awardedBy}</span>}
          {poId && rfq.status === 'ordered' && <Badge tone="good">{poId}</Badge>}
        </div>
        {error && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}

        {rfq.status === 'awarded' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm">
            <span>{canPurchase ? `Raise the order with ${rfq.awardedSupplier} at the quoted prices.` : 'Procurement raises the purchase order.'}</span>
            {canPurchase && (
              <Button size="sm" onClick={raisePo} disabled={!requisitionOpen}>
                Raise purchase order
              </Button>
            )}
          </div>
        )}

        <Card title="Compare quotes" padded={false} count={quotes.length}>
          {quotes.length === 0 ? (
            <EmptyState title="No quotes recorded yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-canvas/50 text-xs text-ink/55">
                    <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                    {quotes.map((q) => (
                      <th key={q.id} className="px-4 py-2.5 text-right font-semibold">
                        {q.supplierName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {rfq.lines.map((l, i) => (
                    <tr key={l.itemName}>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {l.qty} × {l.itemName}
                      </td>
                      {quotes.map((q) => (
                        <td key={q.id} className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${q.prices[i] > 0 && q.prices[i] === bestPrice[i] ? 'font-semibold text-good' : ''}`}>
                          {q.prices[i] > 0 ? ugx(q.prices[i]) : <span className="text-ink/40">Not quoted</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-canvas/40 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    {quotes.map((q) => (
                      <td key={q.id} className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${complete(q) && lineTotal(q, rfq) === cheapest ? 'text-good' : ''}`}>
                        {complete(q) ? ugx(lineTotal(q, rfq)) : 'Incomplete'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-ink/60">Lead time</td>
                    {quotes.map((q) => (
                      <td key={q.id} className="px-4 py-2.5 text-right">{q.leadTimeDays} days</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-ink/60">Terms</td>
                    {quotes.map((q) => (
                      <td key={q.id} className="whitespace-nowrap px-4 py-2.5 text-right">{q.paymentTerms}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-ink/60">Valid until</td>
                    {quotes.map((q) => (
                      <td key={q.id} className="whitespace-nowrap px-4 py-2.5 text-right">{shortDate(q.validUntil)}</td>
                    ))}
                  </tr>
                  {quotes.some((q) => q.notes) && (
                    <tr>
                      <td className="px-4 py-2.5 text-ink/60">Notes</td>
                      {quotes.map((q) => (
                        <td key={q.id} className="px-4 py-2.5 text-right text-xs text-ink/70">{q.notes ?? ''}</td>
                      ))}
                    </tr>
                  )}
                  {rfq.status === 'open' && buyer && (
                    <tr>
                      <td />
                      {quotes.map((q) => (
                        <td key={q.id} className="px-4 py-2.5 text-right">
                          <Button size="sm" variant={complete(q) && lineTotal(q, rfq) === cheapest ? 'primary' : 'ghost'} disabled={!complete(q)} onClick={() => { setNote(''); setAwarding(q) }}>
                            Award
                          </Button>
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Invited suppliers" count={rfq.invited.length} padded={false}>
          <ul className="divide-y divide-ink/8">
            {rfq.invited.map((s) => {
              const q = quotes.find((x) => x.supplierName === s)
              return (
                <li key={s} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex-1 font-medium">{s}</span>
                  {q ? <Badge tone="good">Quoted {shortDate(q.receivedAt)}</Badge> : <Badge tone="neutral">Waiting</Badge>}
                  {rfq.status === 'open' && buyer && (
                    <Button size="sm" variant="ghost" onClick={() => setQuoteFor(s)}>
                      {q ? 'Edit quote' : 'Record quote'}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          {rfq.status === 'open' && buyer && notInvited.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-ink/10 px-4 py-3">
              <Select value={inviting} onChange={(e) => setInviting(e.target.value)} className="max-w-xs">
                <option value="">Invite another supplier…</option>
                {notInvited.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Button size="sm" variant="secondary" disabled={!inviting} onClick={async () => { if (!(await act((a) => service.inviteSupplier(rfq.id, inviting, a)))) setInviting('') }}>
                Invite
              </Button>
            </div>
          )}
        </Card>

        <Card title="History" padded={false}>
          <ul className="divide-y divide-ink/8 text-sm">
            {[...rfq.history].reverse().map((h, i) => (
              <li key={i} className="px-4 py-2">
                <span className="text-ink/55">{shortDate(h.at)} · {h.by}</span> · {h.text}
              </li>
            ))}
          </ul>
        </Card>

        {buyer && (rfq.status === 'open' || rfq.status === 'awarded') && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => { setNote(''); setCancelling(true) }}>Cancel RFQ</Button>
          </div>
        )}
      </div>

      {quoteFor && <QuoteDialog rfq={rfq} supplier={quoteFor} existing={quotes.find((q) => q.supplierName === quoteFor)} onClose={() => setQuoteFor(null)} />}
      {awarding && (
        <ConfirmDialog
          title={`Award to ${awarding.supplierName}?`}
          confirmLabel="Award"
          onCancel={() => setAwarding(null)}
          onConfirm={async () => {
            if (!(await act((a) => service.award(rfq.id, awarding.supplierName, note, a)))) setAwarding(null)
          }}
          message={
            <div className="space-y-3">
              <p>
                {ugx(lineTotal(awarding, rfq))} · {awarding.leadTimeDays} days · {awarding.paymentTerms}
              </p>
              {lineTotal(awarding, rfq) > cheapest && <p className="font-medium text-warn">Not the cheapest quote. Say why it wins.</p>}
              <Field label="Reason (optional when cheapest)">{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Cancel this RFQ?"
          danger
          confirmLabel="Cancel RFQ"
          onCancel={() => setCancelling(false)}
          onConfirm={async () => {
            if (!(await act((a) => service.cancelRfq(rfq.id, note, a)))) setCancelling(false)
          }}
          message={
            <div className="space-y-2">
              <Field label="Reason" required>{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
    </Modal>
  )
}

function QuoteDialog({ rfq, supplier, existing, onClose }: { rfq: Rfq; supplier: string; existing?: RfqQuote; onClose: () => void }) {
  const { run, service } = useProcurement()
  const [prices, setPrices] = useState(rfq.lines.map((_, i) => (existing ? String(existing.prices[i] || '') : '')))
  const [lead, setLead] = useState(existing ? String(existing.leadTimeDays) : '3')
  const [terms, setTerms] = useState(existing?.paymentTerms ?? '30 days')
  const [validUntil, setValidUntil] = useState(existing?.validUntil ?? addDaysIso(14))
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const total = rfq.lines.reduce((s, l, i) => s + (Number(prices[i]) || 0) * l.qty, 0)

  async function save() {
    const e = await run((a) =>
      service.recordQuote(rfq.id, { supplierName: supplier, prices: prices.map((p) => Number(p) || 0), leadTimeDays: Number(lead), paymentTerms: terms, validUntil, notes }, a),
    )
    if (e) setError(e)
    else onClose()
  }

  return (
    <Modal
      title={`Quote from ${supplier}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save quote</Button>
        </>
      }
    >
      <div className="space-y-4">
        {rfq.lines.map((l, i) => (
          <Field key={l.itemName} label={`${l.qty} × ${l.itemName} · price per ${l.unit}`}>
            {(id) => (
              <Input id={id} type="number" min={0} inputMode="decimal" value={prices[i]} onChange={(e) => setPrices(prices.map((p, n) => (n === i ? e.target.value : p)))} />
            )}
          </Field>
        ))}
        <p className="text-sm text-ink/70">Total {ugx(total)}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lead time (days)">{(id) => <Input id={id} type="number" min={0} value={lead} onChange={(e) => setLead(e.target.value)} />}</Field>
          <Field label="Payment terms">{(id) => <Input id={id} value={terms} onChange={(e) => setTerms(e.target.value)} />}</Field>
          <Field label="Valid until">{(id) => <Input id={id} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />}</Field>
        </div>
        <Field label="Notes">{(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
