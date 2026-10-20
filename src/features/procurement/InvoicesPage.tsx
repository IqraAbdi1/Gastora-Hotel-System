import { useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, LoadingState, Modal, PageHeader, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import type { Column, Tone } from '../../components/ui'
import { ugx } from '../../lib/format'
import { matchLines, varianceValue } from '../../services/procurement/procurementRules'
import type { InvoiceMatch, MatchResult, SupplierInvoice } from '../../services/procurement/procurementTypes'
import RejectDialog from './RejectDialog'
import { INVOICE_STATUS, addDaysIso, poContextOf, qtyText, shortDate, todayIso } from './procurementUi'
import { useRequests } from './requestsContext'
import { useProcurement } from './useProcurement'

// Area I: supplier invoices and the three-way match (order, goods received, invoice), then approval
// for payment and hand-over to Trademate accounts payable, where the payment itself is made.

type View = 'review' | 'approved' | 'sent' | 'all'

const RESULT: Record<MatchResult, { label: string; tone: Tone }> = {
  ok: { label: 'Match', tone: 'good' },
  price: { label: 'Price', tone: 'bad' },
  qty: { label: 'Quantity', tone: 'bad' },
  both: { label: 'Price and quantity', tone: 'bad' },
}

const ENTRY = ['owner', 'admin', 'gm', 'finance', 'procurement']
const APPROVE = ['owner', 'gm', 'finance']
const AP = ['owner', 'finance']

export default function InvoicesPage() {
  const { data, actor } = useProcurement()
  const [view, setView] = useState<View>('review')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [tolerances, setTolerances] = useState(false)
  const invoices = useMemo(() => data?.invoices ?? [], [data])

  if (!data) return <LoadingState />
  const role = actor?.role ?? ''
  const matchesOf = (id: string) => data.matches.filter((m) => m.invoiceId === id)
  const review = invoices.filter((i) => i.status === 'matched' || i.status === 'variance' || i.status === 'disputed')
  const variances = invoices.filter((i) => i.status === 'variance')
  const varianceSum = variances.reduce((s, i) => s + matchesOf(i.id).reduce((n, m) => n + varianceValue(m), 0), 0)
  const approved = invoices.filter((i) => i.status === 'approved')
  const month = todayIso().slice(0, 7)
  const sentMonth = invoices.filter((i) => i.status === 'sentToAp' && (i.sentAt ?? '').slice(0, 7) === month)

  const rows = invoices.filter((i) =>
    view === 'review' ? review.includes(i) : view === 'approved' ? i.status === 'approved' : view === 'sent' ? i.status === 'sentToAp' : true,
  )

  const columns: Column<SupplierInvoice>[] = [
    {
      key: 'no',
      header: 'Invoice',
      cell: (i) => (
        <div>
          <p className="font-semibold">{i.invoiceNo}</p>
          <p className="text-xs text-ink/55">{i.supplierName}</p>
        </div>
      ),
    },
    { key: 'po', header: 'PO', cell: (i) => i.poId, hideBelow: 'sm' },
    { key: 'date', header: 'Dated', cell: (i) => shortDate(i.invoiceDate), hideBelow: 'md' },
    { key: 'due', header: 'Due', cell: (i) => shortDate(i.dueDate), hideBelow: 'lg' },
    { key: 'total', header: 'Total', cell: (i) => <span className="tabular-nums">{ugx(i.total)}</span>, align: 'right' },
    { key: 'status', header: 'Status', cell: (i) => <Badge tone={INVOICE_STATUS[i.status].tone} dot>{INVOICE_STATUS[i.status].label}</Badge> },
  ]

  const current = invoices.find((i) => i.id === openId)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Procurement"
        title="Supplier invoices"
        description={`Order, delivery and invoice matched per line within ${data.settings.priceTolerancePct}% on price.`}
        actions={
          <>
            {APPROVE.includes(role) && <Button variant="ghost" onClick={() => setTolerances(true)}>Tolerances</Button>}
            {ENTRY.includes(role) && <Button onClick={() => setCreating(true)}>Enter invoice</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="To review" value={review.length} icon="tasks" onClick={() => setView('review')} active={view === 'review'} />
        <StatCard label="Variances" value={variances.length} hint={ugx(varianceSum)} icon="alert" tone={variances.length ? 'bad' : 'default'} />
        <StatCard label="To send" value={approved.length} hint={ugx(approved.reduce((s, i) => s + i.total, 0))} icon="check" tone={approved.length ? 'warn' : 'default'} onClick={() => setView('approved')} active={view === 'approved'} />
        <StatCard label="Sent this month" value={ugx(sentMonth.reduce((s, i) => s + i.total, 0))} icon="money" onClick={() => setView('sent')} active={view === 'sent'} />
      </div>

      {variances.length > 0 && (
        <Card title="Variance alerts" icon="alert" count={variances.length} padded={false}>
          <ul className="divide-y divide-ink/8">
            {variances.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setOpenId(i.id)} className="flex w-full flex-wrap items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-canvas/70">
                  <span className="font-semibold">{i.invoiceNo}</span>
                  <span className="text-ink/60">{i.supplierName}</span>
                  <span className="flex-1" />
                  {matchesOf(i.id)
                    .filter((m) => m.result !== 'ok')
                    .map((m) => (
                      <Badge key={m.id} tone="bad">
                        {m.itemName}: {RESULT[m.result].label.toLowerCase()}
                      </Badge>
                    ))}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padded={false}>
        <div className="border-b border-ink/10 px-4 pt-3">
          <Tabs
            label="Invoices"
            value={view}
            onChange={setView}
            tabs={[
              { key: 'review', label: 'To review', count: review.length, alert: variances.length > 0 },
              { key: 'approved', label: 'Approved', count: approved.length },
              { key: 'sent', label: 'Sent to Trademate', count: invoices.filter((i) => i.status === 'sentToAp').length },
              { key: 'all', label: 'All', count: invoices.length },
            ]}
          />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(i) => i.id} onRowClick={(i) => setOpenId(i.id)} empty={{ title: 'No invoices here' }} />
      </Card>

      {creating && <NewInvoiceDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id) }} />}
      {tolerances && <ToleranceDialog onClose={() => setTolerances(false)} />}
      {current && <InvoiceDetail invoice={current} matches={matchesOf(current.id)} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function MatchTable({ matches }: { matches: InvoiceMatch[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/10 bg-canvas/50 text-xs text-ink/55">
            <th className="px-3 py-2 text-left font-semibold">Item</th>
            <th className="px-3 py-2 text-right font-semibold">Ordered</th>
            <th className="px-3 py-2 text-right font-semibold">Accepted</th>
            <th className="px-3 py-2 text-right font-semibold">Invoiced</th>
            <th className="px-3 py-2 text-right font-semibold">Price</th>
            <th className="px-3 py-2 text-right font-semibold">Qty</th>
            <th className="px-3 py-2 text-left font-semibold">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/8">
          {matches.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap px-3 py-2">{m.itemName}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {qtyText(m.poQty)} @ {ugx(m.poUnitPrice)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{qtyText(m.receivedQty)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {qtyText(m.invoicedQty)} @ {ugx(m.invoicedUnitPrice)}
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${m.result === 'price' || m.result === 'both' ? 'font-semibold text-bad' : ''}`}>
                {m.priceVariancePct > 0 ? '+' : ''}
                {m.priceVariancePct}%
              </td>
              <td className={`px-3 py-2 text-right tabular-nums ${m.result === 'qty' || m.result === 'both' ? 'font-semibold text-bad' : ''}`}>
                {m.qtyVariance > 0 ? '+' : ''}
                {qtyText(m.qtyVariance)}
              </td>
              <td className="px-3 py-2">
                <Badge tone={RESULT[m.result].tone}>{RESULT[m.result].label}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InvoiceDetail({ invoice: inv, matches, onClose }: { invoice: SupplierInvoice; matches: InvoiceMatch[]; onClose: () => void }) {
  const { data, run, service, actor } = useProcurement()
  const { orders } = useRequests()
  const [confirm, setConfirm] = useState<'approve' | 'dispute' | 'send' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const role = actor?.role ?? ''
  const po = orders.find((o) => o.id === inv.poId)
  const reviewable = inv.status === 'matched' || inv.status === 'variance' || inv.status === 'disputed'
  const issues = matches.filter((m) => m.result !== 'ok')
  const tol = data?.settings

  const act = async (fn: Parameters<typeof run>[0]) => {
    const e = await run(fn)
    setError(e)
    if (!e) setConfirm(null)
  }

  return (
    <Modal side wide title={`${inv.invoiceNo} · ${inv.supplierName}`} description={`${inv.poId} · dated ${shortDate(inv.invoiceDate)} · due ${shortDate(inv.dueDate)}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={INVOICE_STATUS[inv.status].tone} dot>{INVOICE_STATUS[inv.status].label}</Badge>
          <span className="text-lg font-bold tabular-nums">{ugx(inv.total)}</span>
          {inv.apRef && <Badge tone="info">{inv.apRef}</Badge>}
        </div>
        {error && !confirm && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}

        {issues.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">
            {issues.map((m) => (
              <li key={m.id}>
                {m.itemName}:{' '}
                {(m.result === 'price' || m.result === 'both') && `price ${m.priceVariancePct}% above the order (tolerance ${tol?.priceTolerancePct}%)`}
                {m.result === 'both' && '; '}
                {(m.result === 'qty' || m.result === 'both') && `billed ${qtyText(m.invoicedQty)}, accepted ${qtyText(m.receivedQty)}`}
                {` · ${ugx(varianceValue(m))}`}
              </li>
            ))}
          </ul>
        )}
        {inv.disputeReason && <p className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">Disputed: {inv.disputeReason}</p>}

        <Card title="Three-way match" padded={false}>
          <MatchTable matches={matches} />
        </Card>

        <div className="flex flex-wrap gap-2">
          {reviewable && APPROVE.includes(role) && <Button onClick={() => { setNote(''); setError(null); setConfirm('approve') }}>Approve for payment</Button>}
          {inv.status === 'approved' && AP.includes(role) && <Button onClick={() => { setError(null); setConfirm('send') }}>Send to Trademate AP</Button>}
          {reviewable && ENTRY.includes(role) && po && (
            <Button variant="ghost" onClick={() => act((a) => service.rematch(inv.id, poContextOf(po, data?.rejects ?? []), a))}>
              Match again
            </Button>
          )}
          {reviewable && inv.status !== 'disputed' && ENTRY.includes(role) && (
            <Button variant="ghost" onClick={() => { setNote(''); setError(null); setConfirm('dispute') }}>Dispute with supplier</Button>
          )}
          {po && ['owner', 'gm', 'storekeeper', 'procurement'].includes(role) && (
            <Button variant="ghost" onClick={() => setRejecting(true)}>Log a reject</Button>
          )}
        </div>

        <Card title="History" padded={false}>
          <ul className="divide-y divide-ink/8 text-sm">
            {[...inv.history].reverse().map((h, i) => (
              <li key={i} className="px-4 py-2">
                <span className="text-ink/55">{shortDate(h.at)} · {h.by}</span> · {h.text}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {confirm === 'approve' && (
        <ConfirmDialog
          title="Approve for payment?"
          confirmLabel="Approve"
          onCancel={() => setConfirm(null)}
          onConfirm={() => act((a) => service.approveInvoice(inv.id, note, a))}
          message={
            <div className="space-y-3">
              <p>
                {inv.supplierName} · {ugx(inv.total)}. Recorded against your name.
              </p>
              {inv.status !== 'matched' && <p className="font-medium text-bad">This invoice does not match. Say why it is approved.</p>}
              <Field label="Note">{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
      {confirm === 'dispute' && (
        <ConfirmDialog
          title="Dispute this invoice?"
          confirmLabel="Dispute"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => act((a) => service.disputeInvoice(inv.id, note, a))}
          message={
            <div className="space-y-3">
              <Field label="What is wrong" required>{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
      {confirm === 'send' && (
        <ConfirmDialog
          title="Send to Trademate AP?"
          confirmLabel="Send"
          onCancel={() => setConfirm(null)}
          onConfirm={() => act((a) => service.sendToAp(inv.id, a))}
          message={
            <div className="space-y-2">
              <p>
                {inv.supplierName} · {ugx(inv.total)} · due {shortDate(inv.dueDate)}. Payment is made in Trademate.
              </p>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
      {rejecting && <RejectDialog poId={inv.poId} onClose={() => setRejecting(false)} />}
    </Modal>
  )
}

function NewInvoiceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { data, run, service, propertyId } = useProcurement()
  const { orders } = useRequests()
  const list = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const [poId, setPoId] = useState(list.find((o) => o.status !== 'Ordered')?.id ?? list[0]?.id ?? '')
  const po = list.find((o) => o.id === poId)
  const ctx = po ? poContextOf(po, data?.rejects ?? []) : null
  const [invoiceNo, setInvoiceNo] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState(addDaysIso(30))
  const [lines, setLines] = useState<{ qty: string; price: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rows = lines ?? (ctx?.lines.map((l) => ({ qty: String(l.receivedQty || l.qty), price: String(l.unitPrice) })) ?? [])
  const entered = ctx ? ctx.lines.map((l, i) => ({ itemName: l.itemName, qty: Number(rows[i]?.qty) || 0, unitPrice: Number(rows[i]?.price) || 0 })) : []
  const preview = ctx && data ? matchLines('preview', entered.filter((l) => l.qty > 0), ctx, data.settings.priceTolerancePct, data.settings.qtyTolerancePct, '') : []
  const total = entered.reduce((s, l) => s + l.qty * l.unitPrice, 0)

  async function save() {
    if (!ctx) return setError('Pick the purchase order.')
    let id = ''
    const e = await run(async (a) => {
      id = (await service.createInvoice({ propertyId, invoiceNo, invoiceDate, dueDate, lines: entered, po: ctx }, a)).id
    })
    if (e) setError(e)
    else onCreated(id)
  }

  return (
    <Modal
      wide
      title="Enter supplier invoice"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!po}>Save and match</Button>
        </>
      }
    >
      {list.length === 0 ? (
        <EmptyState title="No purchase orders yet" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Purchase order" required>
              {(id) => (
                <Select id={id} value={poId} onChange={(e) => { setPoId(e.target.value); setLines(null) }}>
                  {list.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} · {o.supplier} · {o.status}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Supplier invoice number" required>{(id) => <Input id={id} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. NLH-8850" />}</Field>
            <Field label="Invoice date">{(id) => <Input id={id} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />}</Field>
            <Field label="Due date">{(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
          </div>
          {ctx && (
            <div className="overflow-x-auto rounded-lg border border-ink/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-canvas/50 text-xs text-ink/55">
                    <th className="px-3 py-2 text-left font-semibold">Item</th>
                    <th className="px-3 py-2 text-right font-semibold">Order</th>
                    <th className="px-3 py-2 text-right font-semibold">Accepted</th>
                    <th className="px-3 py-2 text-right font-semibold">Invoiced qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Invoiced price</th>
                    <th className="px-3 py-2 text-left font-semibold">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {ctx.lines.map((l, i) => {
                    const m = preview.find((x) => x.itemName === l.itemName)
                    return (
                      <tr key={l.itemName}>
                        <td className="whitespace-nowrap px-3 py-2">{l.itemName}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {qtyText(l.qty)} @ {ugx(l.unitPrice)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{qtyText(l.receivedQty)}</td>
                        <td className="px-3 py-2 text-right">
                          <Input aria-label={`${l.itemName} quantity`} type="number" min={0} className="w-24 text-right" value={rows[i]?.qty ?? ''} onChange={(e) => setLines(rows.map((r, n) => (n === i ? { ...r, qty: e.target.value } : r)))} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input aria-label={`${l.itemName} price`} type="number" min={0} className="w-32 text-right" value={rows[i]?.price ?? ''} onChange={(e) => setLines(rows.map((r, n) => (n === i ? { ...r, price: e.target.value } : r)))} />
                        </td>
                        <td className="px-3 py-2">{m ? <Badge tone={RESULT[m.result].tone}>{RESULT[m.result].label}</Badge> : <span className="text-ink/40">Not billed</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-right text-sm font-semibold">Total {ugx(total)}</p>
          {error && <p className="text-sm font-medium text-bad">{error}</p>}
        </div>
      )}
    </Modal>
  )
}

function ToleranceDialog({ onClose }: { onClose: () => void }) {
  const { data, run, service, propertyId } = useProcurement()
  const [price, setPrice] = useState(String(data?.settings.priceTolerancePct ?? 2))
  const [qty, setQty] = useState(String(data?.settings.qtyTolerancePct ?? 0))
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title="Match tolerances"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={async () => {
              const e = await run((a) => service.setTolerance(propertyId, Number(price), Number(qty), a))
              if (e) setError(e)
              else onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Price above order (%)">{(id) => <Input id={id} type="number" min={0} max={20} step={0.5} value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
        <Field label="Quantity above accepted (%)">{(id) => <Input id={id} type="number" min={0} max={20} step={0.5} value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
    </Modal>
  )
}
