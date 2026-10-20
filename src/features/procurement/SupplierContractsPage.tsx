import { useMemo, useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, LoadingState, Modal, PageHeader, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import type { Column, Tone } from '../../components/ui'
import { ugx } from '../../lib/format'
import { contractStatus, daysToEnd } from '../../services/procurement/procurementRules'
import type { ApprovedSupplier, ContractPrice, SupplierContract } from '../../services/procurement/procurementTypes'
import PriceChart from './PriceChart'
import RejectDialog from './RejectDialog'
import { addDaysIso, shortDate, todayIso } from './procurementUi'
import { useRequests } from './requestsContext'
import { STOCK_CATEGORIES, sameName } from './requestsModel'
import { useProcurement } from './useProcurement'

// Area I: the supplier master beyond name and phone: contracts with their price lists, what each item
// has cost over time, which suppliers are approved for what, and how each supplier performs.

type View = 'contracts' | 'prices' | 'approved' | 'scorecard'

const BUYERS = ['owner', 'admin', 'gm', 'procurement']

function statusOf(c: SupplierContract): { label: string; tone: Tone } {
  const s = contractStatus(c)
  if (s === 'ended') return { label: 'Ended', tone: 'neutral' }
  if (s === 'expired') return { label: 'Expired', tone: 'bad' }
  if (s === 'upcoming') return { label: 'Starts later', tone: 'info' }
  const d = daysToEnd(c)
  return d <= 30 ? { label: `Ends in ${d} days`, tone: 'warn' } : { label: 'Active', tone: 'good' }
}

type Score = { supplier: string; deliveries: number; onTime: number; rejectPct: number; priceVar: number | null; score: number }

export default function SupplierContractsPage() {
  const { data, actor } = useProcurement()
  const { suppliers, receipts, orders, stock } = useRequests()
  const [view, setView] = useState<View>('contracts')
  const [editing, setEditing] = useState<SupplierContract | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [item, setItem] = useState('')
  const role = actor?.role ?? ''

  const scores = useMemo<Score[]>(() => {
    if (!data) return []
    const lead = (supplier: string) => data.contracts.find((c) => sameName(c.supplierName, supplier) && contractStatus(c) === 'active')?.leadTimeDays ?? 3
    // Past deliveries, plus deliveries received in the store against an order.
    const live = receipts
      .filter((r) => r.kind === 'GRN' && r.supplier && r.poId)
      .map((r) => {
        const po = orders.find((o) => o.id === r.poId)
        const expected = po ? new Date(Date.parse(po.createdAt) + lead(r.supplier ?? '') * 86_400_000).toISOString().slice(0, 10) : r.at.slice(0, 10)
        return {
          supplierName: r.supplier ?? '',
          expectedOn: expected,
          receivedOn: r.at.slice(0, 10),
          qty: r.lines.reduce((s, l) => s + l.qty, 0),
          rejected: data.rejects.filter((x) => x.grnId === r.id).reduce((s, x) => s + x.qty, 0),
        }
      })
    const past = data.receipts.map((g) => ({
      supplierName: g.supplierName,
      expectedOn: g.expectedOn,
      receivedOn: g.receivedOn,
      qty: g.lines.reduce((s, l) => s + l.qty, 0),
      rejected: g.lines.reduce((s, l) => s + l.rejectedQty, 0),
    }))
    const all = [...past, ...live]
    const names = [...new Set([...all.map((d) => d.supplierName), ...data.contracts.map((c) => c.supplierName)])]
    return names
      .map((supplier) => {
        const mine = all.filter((d) => d.supplierName === supplier)
        const onTime = mine.length ? (mine.filter((d) => d.receivedOn <= d.expectedOn).length / mine.length) * 100 : 0
        const qty = mine.reduce((s, d) => s + d.qty, 0)
        const rejectPct = qty ? (mine.reduce((s, d) => s + d.rejected, 0) / qty) * 100 : 0
        // Price paid against the contract price for the same item.
        const vs = data.prices
          .filter((p) => (p.source === 'PO' || p.source === 'Invoice') && p.supplierName === supplier)
          .map((p) => {
            const c = data.contracts.find((k) => k.supplierName === supplier && k.startsOn <= p.at.slice(0, 10) && p.at.slice(0, 10) <= k.endsOn)
            const cp = c?.prices.find((x) => sameName(x.itemName, p.itemName))?.unitPrice
            return cp ? ((p.unitPrice - cp) / cp) * 100 : null
          })
          .filter((x): x is number => x !== null)
        const priceVar = vs.length ? vs.reduce((s, x) => s + x, 0) / vs.length : null
        const score = Math.round(onTime * 0.5 + Math.max(0, 100 - rejectPct * 10) * 0.3 + Math.max(0, 100 - Math.max(0, priceVar ?? 0) * 10) * 0.2)
        return { supplier, deliveries: mine.length, onTime, rejectPct, priceVar, score }
      })
      .filter((s) => s.deliveries > 0)
      .sort((a, b) => b.score - a.score)
  }, [data, receipts, orders])

  if (!data) return <LoadingState />

  const contracts = [...data.contracts].sort((a, b) => a.endsOn.localeCompare(b.endsOn))
  const active = contracts.filter((c) => contractStatus(c) === 'active')
  const ending = active.filter((c) => daysToEnd(c) <= 30)
  const avgOnTime = scores.length ? Math.round(scores.reduce((s, x) => s + x.onTime, 0) / scores.length) : 0
  const buyer = BUYERS.includes(role)
  const approver = role === 'owner' || role === 'gm'

  const contractCols: Column<SupplierContract>[] = [
    {
      key: 'supplier',
      header: 'Supplier',
      cell: (c) => (
        <div>
          <p className="font-semibold">{c.supplierName}</p>
          <p className="text-xs text-ink/55">{c.title}</p>
        </div>
      ),
    },
    { key: 'period', header: 'Period', cell: (c) => `${shortDate(c.startsOn)} to ${shortDate(c.endsOn)}`, hideBelow: 'md' },
    { key: 'terms', header: 'Terms', cell: (c) => `${c.paymentTerms} · ${c.leadTimeDays} d lead`, hideBelow: 'lg' },
    { key: 'items', header: 'Items', cell: (c) => c.prices.length, align: 'right', hideBelow: 'sm' },
    { key: 'status', header: 'Status', cell: (c) => <Badge tone={statusOf(c).tone}>{statusOf(c).label}</Badge> },
  ]

  // Price history: the chosen item, or the first with history.
  const priced = [...new Set(data.prices.filter((p) => p.source === 'PO' || p.source === 'Invoice').map((p) => p.itemName))].sort()
  const chosen = item || priced.find((n) => active.some((c) => c.prices.some((p) => p.itemName === n))) || priced[0] || ''
  const history = data.prices.filter((p) => p.itemName === chosen).sort((a, b) => a.at.localeCompare(b.at))
  const paid = history.filter((p) => p.source === 'PO' || p.source === 'Invoice')
  const contractPrice = active.flatMap((c) => c.prices.filter((p) => p.itemName === chosen).map((p) => ({ ...p, supplier: c.supplierName })))[0]
  const first = paid[0]?.unitPrice ?? 0
  const last = paid[paid.length - 1]?.unitPrice ?? 0
  const change = first ? ((last - first) / first) * 100 : 0
  const unit = stock.find((s) => s.name === chosen)?.unit ?? ''

  const approvedRows = [...data.approved].sort((a, b) => (a.itemName ?? a.category ?? '').localeCompare(b.itemName ?? b.category ?? ''))
  const approvedCols: Column<ApprovedSupplier>[] = [
    { key: 'scope', header: 'For', cell: (a) => (a.itemName ? <span>{a.itemName} <span className="text-xs text-ink/50">item</span></span> : <span>{a.category} <span className="text-xs text-ink/50">category</span></span>) },
    { key: 'supplier', header: 'Supplier', cell: (a) => <span className="font-medium">{a.supplierName}</span> },
    { key: 'pref', header: '', cell: (a) => (a.preferred ? <Badge tone="good">Preferred</Badge> : <Badge>Approved</Badge>) },
    { key: 'by', header: 'Approved', cell: (a) => `${a.approvedBy} · ${shortDate(a.approvedAt)}`, hideBelow: 'md' },
    { key: 'x', header: '', cell: (a) => (approver ? <RemoveApproved id={a.id} /> : null), align: 'right' },
  ]

  const scoreCols: Column<Score>[] = [
    { key: 's', header: 'Supplier', cell: (s) => <span className="font-semibold">{s.supplier}</span> },
    { key: 'd', header: 'Deliveries', cell: (s) => s.deliveries, align: 'right', hideBelow: 'sm' },
    { key: 'o', header: 'On time', cell: (s) => <span className={s.onTime < 80 ? 'font-semibold text-warn' : ''}>{Math.round(s.onTime)}%</span>, align: 'right' },
    { key: 'r', header: 'Rejects', cell: (s) => <span className={s.rejectPct > 2 ? 'font-semibold text-bad' : ''}>{s.rejectPct.toFixed(1)}%</span>, align: 'right' },
    {
      key: 'p',
      header: 'Price vs contract',
      cell: (s) => (s.priceVar === null ? <span className="text-ink/40">No contract</span> : <span className={s.priceVar > 1 ? 'font-semibold text-bad' : ''}>{s.priceVar > 0 ? '+' : ''}{s.priceVar.toFixed(1)}%</span>),
      align: 'right',
      hideBelow: 'md',
    },
    { key: 'sc', header: 'Score', cell: (s) => <Badge tone={s.score >= 85 ? 'good' : s.score >= 70 ? 'warn' : 'bad'}>{s.score}</Badge>, align: 'right' },
  ]

  const current = data.contracts.find((c) => c.id === openId)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Procurement"
        title="Supplier contracts"
        description="Contracts, price history, approved suppliers and supplier scorecards."
        actions={
          <>
            {view === 'contracts' && buyer && <Button onClick={() => setEditing('new')}>New contract</Button>}
            {view === 'approved' && approver && <Button onClick={() => setAdding(true)}>Approve a supplier</Button>}
            {view === 'scorecard' && ['owner', 'gm', 'storekeeper', 'procurement'].includes(role) && <Button onClick={() => setRejecting(true)}>Log a reject</Button>}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active" value={active.length} icon="list" onClick={() => setView('contracts')} active={view === 'contracts'} />
        <StatCard label="Ending soon" value={ending.length} icon="calendar" tone={ending.length ? 'warn' : 'default'} hint={ending.map((c) => c.supplierName).join(', ') || undefined} />
        <StatCard label="Approved" value={data.approved.length} icon="check" onClick={() => setView('approved')} active={view === 'approved'} />
        <StatCard label="On time" value={`${avgOnTime}%`} icon="tasks" tone={avgOnTime < 80 ? 'warn' : 'good'} onClick={() => setView('scorecard')} active={view === 'scorecard'} />
      </div>

      <Tabs
        label="Supplier master"
        value={view}
        onChange={setView}
        tabs={[
          { key: 'contracts', label: 'Contracts', count: contracts.length, alert: ending.length > 0 },
          { key: 'prices', label: 'Price history' },
          { key: 'approved', label: 'Approved suppliers', count: data.approved.length },
          { key: 'scorecard', label: 'Scorecard', count: scores.length },
        ]}
      />

      {view === 'contracts' && (
        <Card padded={false}>
          <DataTable columns={contractCols} rows={contracts} rowKey={(c) => c.id} onRowClick={(c) => setOpenId(c.id)} empty={{ title: 'No contracts yet' }} />
        </Card>
      )}

      {view === 'prices' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select aria-label="Item" value={chosen} onChange={(e) => setItem(e.target.value)} className="max-w-xs">
              {priced.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </div>
          {paid.length === 0 ? (
            <Card>
              <EmptyState title="No prices recorded for this item" />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Last paid" value={ugx(last)} hint={`per ${unit} · ${paid[paid.length - 1].supplierName}`} />
                <StatCard label="Lowest" value={ugx(Math.min(...paid.map((p) => p.unitPrice)))} />
                <StatCard label="Change over the period" value={`${change > 0 ? '+' : ''}${change.toFixed(1)}%`} tone={change > 3 ? 'bad' : change > 0 ? 'warn' : 'good'} />
                <StatCard label="Contract price" value={contractPrice ? ugx(contractPrice.unitPrice) : 'None'} hint={contractPrice?.supplier} tone={contractPrice && last > contractPrice.unitPrice ? 'warn' : 'default'} />
              </div>
              <Card title={`${chosen} · price per ${unit}`}>
                <PriceChart points={paid.map((p) => ({ label: shortDate(p.at), value: p.unitPrice, hint: p.supplierName }))} reference={contractPrice?.unitPrice} />
              </Card>
              <Card padded={false} title="Every price" count={history.length}>
                <DataTable
                  columns={[
                    { key: 'at', header: 'Date', cell: (p) => shortDate(p.at) },
                    { key: 'sup', header: 'Supplier', cell: (p) => p.supplierName },
                    { key: 'price', header: 'Price', cell: (p) => <span className="tabular-nums">{ugx(p.unitPrice)}</span>, align: 'right' },
                    { key: 'qty', header: 'Qty', cell: (p) => (p.qty ? p.qty.toLocaleString('en-US') : ''), align: 'right', hideBelow: 'sm' },
                    { key: 'src', header: 'From', cell: (p) => <Badge tone={p.source === 'Quote' ? 'info' : p.source === 'Contract' ? 'accent' : 'neutral'}>{p.source}</Badge> },
                    { key: 'ref', header: 'Reference', cell: (p) => p.reference, hideBelow: 'md' },
                  ]}
                  rows={[...history].reverse()}
                  rowKey={(p) => p.id}
                />
              </Card>
            </>
          )}
        </div>
      )}

      {view === 'approved' && (
        <Card padded={false}>
          <DataTable columns={approvedCols} rows={approvedRows} rowKey={(a) => a.id} empty={{ title: 'No approved suppliers yet' }} />
        </Card>
      )}

      {view === 'scorecard' && (
        <Card padded={false} title="Last six months" description="On time 50%, rejects 30%, price against contract 20%.">
          <DataTable columns={scoreCols} rows={scores} rowKey={(s) => s.supplier} empty={{ title: 'No deliveries yet' }} />
        </Card>
      )}

      {editing && <ContractDialog contract={editing === 'new' ? undefined : editing} suppliers={suppliers.filter((s) => s.active).map((s) => s.name)} onClose={() => setEditing(null)} />}
      {current && (
        <ContractDetail
          contract={current}
          canEdit={buyer}
          onEdit={() => { setOpenId(null); setEditing(current) }}
          onClose={() => setOpenId(null)}
        />
      )}
      {adding && <ApproveDialog suppliers={suppliers.filter((s) => s.active).map((s) => s.name)} onClose={() => setAdding(false)} />}
      {rejecting && <RejectDialog onClose={() => setRejecting(false)} />}
    </div>
  )
}

function RemoveApproved({ id }: { id: string }) {
  const { run, service } = useProcurement()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>Remove</Button>
      {asking && (
        <ConfirmDialog
          title="Remove from the approved list?"
          message="The supplier stays in the supplier list."
          danger
          confirmLabel="Remove"
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            await run((a) => service.removeApproved(id, a))
            setAsking(false)
          }}
        />
      )}
    </>
  )
}

function ContractDetail({ contract: c, canEdit, onEdit, onClose }: { contract: SupplierContract; canEdit: boolean; onEdit: () => void; onClose: () => void }) {
  const { data, run, service, actor } = useProcurement()
  const [ending, setEnding] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const s = statusOf(c)
  const lastPaid = (item: string) =>
    (data?.prices ?? []).filter((p) => p.itemName === item && p.supplierName === c.supplierName && (p.source === 'PO' || p.source === 'Invoice')).sort((a, b) => b.at.localeCompare(a.at))[0]
  const live = contractStatus(c) !== 'ended'
  return (
    <Modal side title={c.supplierName} description={c.title} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink/55">Period</dt>
            <dd>{shortDate(c.startsOn)} to {shortDate(c.endsOn)}</dd>
          </div>
          <div>
            <dt className="text-ink/55">Payment terms</dt>
            <dd>{c.paymentTerms}</dd>
          </div>
          <div>
            <dt className="text-ink/55">Lead time</dt>
            <dd>{c.leadTimeDays} days</dd>
          </div>
          <div>
            <dt className="text-ink/55">Recorded by</dt>
            <dd>{c.createdBy}</dd>
          </div>
        </dl>
        {c.endedAt && (
          <p className="rounded-lg bg-ink/5 px-3 py-2 text-sm">
            Ended by {c.endedBy} on {shortDate(c.endedAt)}: {c.endReason}
          </p>
        )}
        <Card title="Price list" padded={false} count={c.prices.length}>
          <DataTable
            columns={[
              { key: 'i', header: 'Item', cell: (p: ContractPrice) => p.itemName },
              { key: 'p', header: 'Contract', cell: (p: ContractPrice) => `${ugx(p.unitPrice)} / ${p.unit}`, align: 'right' },
              {
                key: 'l',
                header: 'Last paid',
                cell: (p: ContractPrice) => {
                  const lp = lastPaid(p.itemName)
                  if (!lp) return <span className="text-ink/40">None</span>
                  return <span className={lp.unitPrice > p.unitPrice ? 'font-semibold text-bad' : 'text-good'}>{ugx(lp.unitPrice)}</span>
                },
                align: 'right',
              },
            ]}
            rows={c.prices}
            rowKey={(p) => p.itemName}
            empty={{ title: 'No prices on this contract' }}
          />
        </Card>
        {canEdit && live && (
          <div className="flex flex-wrap justify-end gap-2">
            {['owner', 'gm', 'procurement'].includes(actor?.role ?? '') && <Button variant="ghost" onClick={() => setEnding(true)}>End contract</Button>}
            <Button onClick={onEdit}>Edit</Button>
          </div>
        )}
      </div>
      {ending && (
        <ConfirmDialog
          title="End this contract now?"
          danger
          confirmLabel="End contract"
          onCancel={() => setEnding(false)}
          onConfirm={async () => {
            const e = await run((a) => service.endContract(c.id, reason, a))
            setError(e)
            if (!e) setEnding(false)
          }}
          message={
            <div className="space-y-2">
              <Field label="Reason" required>{(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
    </Modal>
  )
}

function ContractDialog({ contract, suppliers, onClose }: { contract?: SupplierContract; suppliers: string[]; onClose: () => void }) {
  const { run, service, propertyId } = useProcurement()
  const { stock } = useRequests()
  const [supplierName, setSupplier] = useState(contract?.supplierName ?? suppliers[0] ?? '')
  const [title, setTitle] = useState(contract?.title ?? '')
  const [startsOn, setStartsOn] = useState(contract?.startsOn ?? todayIso())
  const [endsOn, setEndsOn] = useState(contract?.endsOn ?? addDaysIso(365))
  const [terms, setTerms] = useState(contract?.paymentTerms ?? '30 days')
  const [lead, setLead] = useState(String(contract?.leadTimeDays ?? 3))
  const [prices, setPrices] = useState<{ itemName: string; price: string }[]>(contract?.prices.map((p) => ({ itemName: p.itemName, price: String(p.unitPrice) })) ?? [{ itemName: '', price: '' }])
  const [error, setError] = useState<string | null>(null)
  const unitOf = (n: string) => stock.find((s) => s.name === n)?.unit ?? 'piece'

  async function save() {
    const e = await run((a) =>
      service.saveContract(
        {
          id: contract?.id,
          propertyId,
          supplierName,
          title,
          startsOn,
          endsOn,
          paymentTerms: terms,
          leadTimeDays: Number(lead),
          prices: prices.filter((p) => p.itemName).map((p) => ({ itemName: p.itemName, unit: unitOf(p.itemName), unitPrice: Number(p.price) || 0 })),
        },
        a,
      ),
    )
    if (e) setError(e)
    else onClose()
  }

  return (
    <Modal
      wide
      title={contract ? 'Edit contract' : 'New contract'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save contract</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier" required>
            {(id) => (
              <Select id={id} value={supplierName} onChange={(e) => setSupplier(e.target.value)} disabled={!!contract}>
                {suppliers.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Title" required>{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cleaning chemicals 2027" />}</Field>
          <Field label="Starts">{(id) => <Input id={id} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />}</Field>
          <Field label="Ends">{(id) => <Input id={id} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />}</Field>
          <Field label="Payment terms">{(id) => <Input id={id} value={terms} onChange={(e) => setTerms(e.target.value)} />}</Field>
          <Field label="Lead time (days)">{(id) => <Input id={id} type="number" min={0} value={lead} onChange={(e) => setLead(e.target.value)} />}</Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink/80">Price list</p>
          <div className="space-y-2">
            {prices.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select aria-label="Item" value={p.itemName} onChange={(e) => setPrices(prices.map((x, n) => (n === i ? { ...x, itemName: e.target.value } : x)))} className="min-w-0 flex-1">
                  <option value="">Pick an item…</option>
                  {stock.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Input aria-label="Price" type="number" min={0} placeholder={`UGX per ${p.itemName ? unitOf(p.itemName) : 'unit'}`} value={p.price} onChange={(e) => setPrices(prices.map((x, n) => (n === i ? { ...x, price: e.target.value } : x)))} className="w-40" />
                <Button size="sm" variant="ghost" onClick={() => setPrices(prices.filter((_, n) => n !== i))} aria-label="Remove line">
                  ×
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setPrices([...prices, { itemName: '', price: '' }])}>
              Add item
            </Button>
          </div>
        </div>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

function ApproveDialog({ suppliers, onClose }: { suppliers: string[]; onClose: () => void }) {
  const { run, service, propertyId } = useProcurement()
  const { stock } = useRequests()
  const [supplierName, setSupplier] = useState(suppliers[0] ?? '')
  const [scope, setScope] = useState<'category' | 'item'>('category')
  const [category, setCategory] = useState(STOCK_CATEGORIES[0])
  const [itemName, setItemName] = useState(stock[0]?.name ?? '')
  const [preferred, setPreferred] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const categories = [...new Set([...STOCK_CATEGORIES, ...stock.map((s) => s.category ?? 'Other')])]

  async function save() {
    const e = await run((a) =>
      service.addApproved({ propertyId, supplierName, preferred, ...(scope === 'item' ? { itemName } : { category }) }, a),
    )
    if (e) setError(e)
    else onClose()
  }

  return (
    <Modal
      title="Approve a supplier"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Approve</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Supplier">
          {(id) => (
            <Select id={id} value={supplierName} onChange={(e) => setSupplier(e.target.value)}>
              {suppliers.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Approved for">
          {(id) => (
            <Select id={id} value={scope} onChange={(e) => setScope(e.target.value as 'category' | 'item')}>
              <option value="category">A whole category</option>
              <option value="item">One item</option>
            </Select>
          )}
        </Field>
        {scope === 'category' ? (
          <Field label="Category">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field label="Item">
            {(id) => (
              <Select id={id} value={itemName} onChange={(e) => setItemName(e.target.value)}>
                {stock.map((s) => (
                  <option key={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={preferred} onChange={(e) => setPreferred(e.target.checked)} />
          Preferred supplier
        </label>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
