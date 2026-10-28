import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Badge, Button, Card, Chip, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { dayMonth } from '../../lib/format'
import type { PosOutlet, StockTransfer, TransferInput, WastageEntry, WastageInput, WasteReason } from '../../services/pos/posTypes'
import { useRequests } from '../procurement/requestsContext'
import type { StockItem } from '../procurement/requestsModel'
import { cash, pct } from './posFormat'
import { BASE_PRODUCTS, EXTRA_PRODUCTS } from './posSeed'
import { POS_STORAGE_KEYS } from './posTypes'
import type { Product, Recipes } from './posTypes'
import { calculateRecipeCost, requiredStockQuantity } from './recipeEngine'
import { errorText, usePos } from './usePos'

type Tab = 'costing' | 'usage' | 'wastage' | 'transfers' | 'analytics'
const seed = [...BASE_PRODUCTS, ...EXTRA_PRODUCTS]
const REASONS: WasteReason[] = ['Spoiled', 'Overproduction', 'Dropped', 'Returned by guest', 'Expired']
const qtyText = (n: number, unit: string) => `${Math.round(n * 10) / 10} ${unit}`

export default function FoodCostPage() {
  const navigate = useNavigate()
  const pos = usePos()
  const inventory = useRequests()
  const [products] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, seed)
  const [recipes] = useBrowserSyncedState<Recipes>(POS_STORAGE_KEYS.recipes, {})
  const [target] = useBrowserSyncedState<number>('gastora.pos.foodCostThreshold.v1', 35)
  const [tab, setTab] = useState<Tab>('costing')
  const [outletFilter, setOutletFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [wasteOpen, setWasteOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [pendingWaste, setPendingWaste] = useState<WastageInput | null>(null)
  const [pendingTransfer, setPendingTransfer] = useState<TransferInput | null>(null)
  const [countFor, setCountFor] = useState<StockItem | null>(null)
  const data = pos.data
  if (!data) return <PageHeader title="Food cost" />

  const outlets = data.outlets
  const outletName = (id: string) => outlets.find((o) => o.id === id)?.name ?? '—'
  const own = products.filter((p) => outlets.some((o) => o.name === p.outlet))
  const mixOf = (id: string) => data.salesMix.find((m) => m.productId === id)?.qty ?? 0

  // ---------------------------------------------------------------- costing
  const rows = own.map((p) => ({ product: p, cost: calculateRecipeCost(p, recipes, inventory.stock), sold: mixOf(p.id) }))
  const costed = rows.filter((r) => r.cost && r.product.trackStock !== false)
  const weekRevenue = costed.reduce((s, r) => s + r.sold * r.product.price, 0)
  const weekCost = costed.reduce((s, r) => s + r.sold * (r.cost?.costPerPortion ?? 0), 0)
  const theoreticalPct = weekRevenue ? (weekCost / weekRevenue) * 100 : 0
  const aboveTarget = costed.filter((r) => (r.cost?.foodCostPercent ?? 0) > target)
  const shownRows = rows.filter((r) => outletFilter === 'all' || r.product.outlet === outletName(outletFilter))

  // ---------------------------------------------------------------- usage
  const theoretical = new Map<string, number>()
  for (const p of own) {
    const sold = mixOf(p.id)
    if (!sold || p.trackStock === false) continue
    for (const ing of recipes[p.id] ?? []) {
      const item = inventory.stock.find((s) => s.id === ing.stockId)
      const q = item ? requiredStockQuantity(ing, item) : null
      if (q) theoretical.set(ing.stockId, (theoretical.get(ing.stockId) ?? 0) + q * sold)
    }
  }
  const usageIds = [...new Set([...theoretical.keys(), ...data.counts.map((c) => c.stockItemId)])]
  const usage = usageIds.map((id) => {
    const item = inventory.stock.find((s) => s.id === id)
    const count = data.counts.find((c) => c.stockItemId === id)
    const transfers = data.transfers.flatMap((t) => t.lines).filter((l) => l.stockItemId === id).reduce((s, l) => s + l.qty, 0)
    const waste = data.wastage.filter((w) => w.stockItemId === id).reduce((s, w) => s + w.qty, 0)
    const theo = theoretical.get(id) ?? 0
    const actual = count ? count.opening + transfers - count.closing : theo
    const variance = actual - theo - waste
    return { id, item, count, transfers, waste, theo, actual, variance, value: variance * (item?.unitCost ?? 0) }
  }).filter((u) => u.item)
  const varianceValue = usage.reduce((s, u) => s + Math.max(0, u.value), 0)

  const wasteValue = data.wastage.reduce((s, w) => s + w.cost, 0)
  const transferValue = data.transfers.reduce((s, t) => s + t.value, 0)

  // ---------------------------------------------------------------- analytics
  const days = [...new Set(data.costDays.map((d) => d.date))].sort()
  const trend = days.map((date) => {
    const list = data.costDays.filter((d) => d.date === date && (outletFilter === 'all' || d.outletId === outletFilter))
    const rev = list.reduce((s, d) => s + d.revenue, 0)
    const cost = list.reduce((s, d) => s + d.cost, 0)
    return { label: dayMonth(date), value: rev ? Math.round((cost / rev) * 1000) / 10 : 0 }
  })
  const lastWeek = days.slice(-7)
  const byOutlet = outlets.map((o) => {
    const list = data.costDays.filter((d) => d.outletId === o.id && lastWeek.includes(d.date))
    const rev = list.reduce((s, d) => s + d.revenue, 0)
    const cost = list.reduce((s, d) => s + d.cost, 0)
    return { outlet: o, rev, cost, pct: rev ? (cost / rev) * 100 : 0 }
  })
  const categories = [...new Set(costed.map((r) => r.product.category))].map((category) => {
    const list = costed.filter((r) => r.product.category === category)
    const rev = list.reduce((s, r) => s + r.sold * r.product.price, 0)
    const cost = list.reduce((s, r) => s + r.sold * (r.cost?.costPerPortion ?? 0), 0)
    return { category, rev, pct: rev ? (cost / rev) * 100 : 0 }
  }).sort((a, b) => b.rev - a.rev)
  const ranked = [...costed].filter((r) => r.sold > 0).sort((a, b) => (a.cost?.foodCostPercent ?? 0) - (b.cost?.foodCostPercent ?? 0))

  async function confirmWaste() {
    if (!pendingWaste) return
    const item = inventory.stock.find((s) => s.id === pendingWaste.stockItemId)
    if (!item) return setNotice('That stock item no longer exists.')
    const ref = `WASTE-${Date.now().toString().slice(-7)}`
    const moved = inventory.consumeStockForSale([{ name: item.name, qty: pendingWaste.qty }], ref, outletName(pendingWaste.outletId), ref)
    if (!moved.ok) {
      setPendingWaste(null)
      return setNotice(moved.error)
    }
    try {
      await pos.service.logWastage(pos.pid, pendingWaste, pos.actor)
      setNotice(`${qtyText(pendingWaste.qty, item.unit)} of ${item.name} written off (${cash(pendingWaste.cost)}).`)
    } catch (e) {
      setNotice(errorText(e))
    }
    setPendingWaste(null)
  }

  async function confirmTransfer() {
    if (!pendingTransfer) return
    try {
      const t = await pos.service.createTransfer(pos.pid, pendingTransfer, pos.actor)
      setNotice(`Transfer ${t.id} to ${outletName(t.outletId)} ${t.toLocation.toLowerCase()} recorded: ${cash(t.value)}.`)
    } catch (e) {
      setNotice(errorText(e))
    }
    setPendingTransfer(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Restaurant & bar POS"
        title="Food cost"
        description={`Target ${target}% · last 7 days`}
        actions={<>
          <Button variant="ghost" onClick={() => setTransferOpen(true)}>Transfer stock</Button>
          <Button onClick={() => setWasteOpen(true)}>Log wastage</Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Theoretical food cost" value={pct(theoreticalPct)} icon="money" tone={theoreticalPct > target ? 'warn' : 'good'} hint={`${cash(weekCost)} on ${cash(weekRevenue)}`} />
        <StatCard label="Unexplained usage" value={cash(varianceValue)} icon="alert" tone={varianceValue > 0 ? 'warn' : 'default'} hint="Used beyond recipes and waste" />
        <StatCard label="Wastage logged" value={cash(wasteValue)} icon="list" hint={`${data.wastage.length} entries`} />
        <StatCard label="Items above target" value={aboveTarget.length} icon="sparkles" tone={aboveTarget.length ? 'warn' : 'good'} />
      </div>

      {notice && (
        <div role="status" className="flex justify-between gap-3 rounded-lg border border-brand/20 bg-white px-4 py-3 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="font-bold">×</button>
        </div>
      )}

      <Tabs label="Food cost" value={tab} onChange={setTab} tabs={[
        { key: 'costing', label: 'Recipe costing', count: costed.length },
        { key: 'usage', label: 'Usage vs sales' },
        { key: 'wastage', label: 'Wastage', count: data.wastage.length },
        { key: 'transfers', label: 'Transfers', count: data.transfers.length },
        { key: 'analytics', label: 'Analytics' },
      ]} />

      {(tab === 'costing' || tab === 'analytics') && outlets.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={outletFilter === 'all'} onClick={() => setOutletFilter('all')}>All outlets</Chip>
          {outlets.map((o) => <Chip key={o.id} active={outletFilter === o.id} onClick={() => setOutletFilter(o.id)}>{o.emoji} {o.name}</Chip>)}
        </div>
      )}

      {tab === 'costing' && (
        <Card padded={false}>
          <DataTable
            rows={shownRows}
            rowKey={(r) => r.product.id}
            onRowClick={(r) => navigate('/pos/recipes', { state: { productId: r.product.id } })}
            columns={[
              { key: 'item', header: 'Menu item', cell: (r) => <span className="font-semibold">{r.product.emoji} {r.product.name}<span className="block text-xs font-normal text-ink/50">{r.product.outlet} · {r.product.category}</span></span> },
              { key: 'cost', header: 'Cost / portion', align: 'right', cell: (r) => (r.product.trackStock === false ? 'Not tracked' : r.cost ? cash(r.cost.costPerPortion) : <Badge tone="warn">Recipe needed</Badge>) },
              { key: 'price', header: 'Price', align: 'right', cell: (r) => cash(r.product.price), hideBelow: 'sm' },
              { key: 'pct', header: 'Cost %', align: 'right', cell: (r) => (r.cost && r.product.trackStock !== false ? <Badge tone={r.cost.foodCostPercent > target ? 'warn' : 'good'}>{pct(r.cost.foodCostPercent)}</Badge> : '—') },
              { key: 'margin', header: 'Margin', align: 'right', cell: (r) => (r.cost && r.product.trackStock !== false ? cash(r.cost.grossProfit) : '—'), hideBelow: 'md' },
              { key: 'sold', header: 'Sold (7 days)', align: 'right', cell: (r) => r.sold, hideBelow: 'lg' },
            ]}
          />
        </Card>
      )}

      {tab === 'usage' && (
        <Card title="Theoretical against actual" description="Actual = opening + transfers in − closing count" padded={false}>
          <DataTable
            rows={usage}
            rowKey={(u) => u.id}
            empty={{ title: 'No counts yet' }}
            columns={[
              { key: 'item', header: 'Item', cell: (u) => <span className="font-semibold">{u.item?.name}</span> },
              { key: 'theo', header: 'Recipes say', align: 'right', cell: (u) => qtyText(u.theo, u.item?.unit ?? '') },
              { key: 'waste', header: 'Wastage', align: 'right', cell: (u) => qtyText(u.waste, u.item?.unit ?? ''), hideBelow: 'md' },
              { key: 'actual', header: 'Actually used', align: 'right', cell: (u) => qtyText(u.actual, u.item?.unit ?? '') },
              { key: 'var', header: 'Gap', align: 'right', cell: (u) => <Badge tone={u.value > 1000 ? 'warn' : u.value < -1000 ? 'info' : 'good'}>{u.variance > 0 ? '+' : ''}{qtyText(u.variance, u.item?.unit ?? '')} · {cash(u.value)}</Badge> },
              { key: 'count', header: '', align: 'right', cell: (u) => <Button size="sm" variant="ghost" onClick={() => setCountFor(u.item as StockItem)}>Count</Button> },
            ]}
          />
        </Card>
      )}

      {tab === 'wastage' && (
        <Card padded={false}>
          <DataTable<WastageEntry>
            rows={data.wastage}
            rowKey={(w) => w.id}
            empty={{ title: 'No wastage logged' }}
            columns={[
              { key: 'at', header: 'When', cell: (w) => new Date(w.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
              { key: 'item', header: 'Item', cell: (w) => <span className="font-semibold">{w.itemName}<span className="block text-xs font-normal text-ink/50">{qtyText(w.qty, w.unit)}{w.note ? ` · ${w.note}` : ''}</span></span> },
              { key: 'reason', header: 'Reason', cell: (w) => w.reason },
              { key: 'outlet', header: 'Outlet', cell: (w) => outletName(w.outletId), hideBelow: 'md' },
              { key: 'by', header: 'By', cell: (w) => w.by, hideBelow: 'lg' },
              { key: 'cost', header: 'Cost', align: 'right', cell: (w) => cash(w.cost) },
            ]}
          />
        </Card>
      )}

      {tab === 'transfers' && (
        <Card description={`${cash(transferValue)} moved from the main store`} title="Store to outlet" padded={false}>
          <DataTable<StockTransfer>
            rows={data.transfers}
            rowKey={(t) => t.id}
            empty={{ title: 'No transfers yet' }}
            columns={[
              { key: 'at', header: 'When', cell: (t) => new Date(t.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
              { key: 'to', header: 'To', cell: (t) => `${outletName(t.outletId)} ${t.toLocation.toLowerCase()}` },
              { key: 'lines', header: 'Items', cell: (t) => t.lines.map((l) => `${l.itemName} ${qtyText(l.qty, l.unit)}`).join(', '), className: 'whitespace-normal min-w-[200px]' },
              { key: 'by', header: 'By', cell: (t) => t.by, hideBelow: 'lg' },
              { key: 'value', header: 'Value', align: 'right', cell: (t) => cash(t.value) },
            ]}
          />
        </Card>
      )}

      {tab === 'analytics' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Food cost % by day" description={trend.length ? `${trend[0].value}% on ${trend[0].label}, ${trend[trend.length - 1].value}% on ${trend[trend.length - 1].label}` : undefined}>
            <AreaChart points={trend} suffix="%" />
          </Card>
          <Card title="Cost % by outlet" description="Actual, last 7 days">
            <PctBars target={target} rows={byOutlet.map((r) => ({ label: `${r.outlet.emoji} ${r.outlet.name}`, pct: r.pct, hint: cash(r.rev) }))} />
          </Card>
          <Card title="Cost % by category" description="From recipes and sales mix">
            <PctBars target={target} rows={categories.map((c) => ({ label: c.category, pct: c.pct, hint: cash(c.rev) }))} />
          </Card>
          <Card title="Best and worst items">
            <div className="grid gap-4 sm:grid-cols-2">
              <RankList title="Lowest cost %" rows={ranked.slice(0, 5)} />
              <RankList title="Highest cost %" rows={[...ranked].reverse().slice(0, 5)} />
            </div>
          </Card>
        </div>
      )}

      {wasteOpen && (
        <WasteDialog
          outlets={outlets}
          stock={inventory.stock}
          stockOf={inventory.stockOf}
          onClose={() => setWasteOpen(false)}
          onSave={(input) => { setWasteOpen(false); setPendingWaste(input) }}
        />
      )}
      {pendingWaste && (
        <ConfirmDialog
          title="Write off stock?"
          danger
          confirmLabel="Write off"
          message={<>{qtyText(pendingWaste.qty, pendingWaste.unit)} of {pendingWaste.itemName} ({cash(pendingWaste.cost)}) leaves stock now, recorded as {pendingWaste.reason.toLowerCase()} by {pos.actor.name}.</>}
          onConfirm={() => void confirmWaste()}
          onCancel={() => setPendingWaste(null)}
        />
      )}
      {transferOpen && (
        <TransferDialog
          outlets={outlets}
          stock={inventory.stock}
          stockOf={inventory.stockOf}
          onClose={() => setTransferOpen(false)}
          onSave={(input) => { setTransferOpen(false); setPendingTransfer(input) }}
        />
      )}
      {pendingTransfer && (
        <ConfirmDialog
          title="Record transfer?"
          confirmLabel="Record transfer"
          message={<>{pendingTransfer.lines.map((l) => `${l.itemName} ${qtyText(l.qty, l.unit)}`).join(', ')} to {outletName(pendingTransfer.outletId)} {pendingTransfer.toLocation.toLowerCase()}, by {pos.actor.name}.</>}
          onConfirm={() => void confirmTransfer()}
          onCancel={() => setPendingTransfer(null)}
        />
      )}
      {countFor && (
        <CountDialog
          item={countFor}
          current={data.counts.find((c) => c.stockItemId === countFor.id)?.closing}
          onClose={() => setCountFor(null)}
          onSave={(closing) => pos.service.recordCount(pos.pid, countFor.id, closing, pos.actor).then(() => { setCountFor(null); setNotice(`Count for ${countFor.name} saved.`) })}
        />
      )}
    </div>
  )
}

function PctBars({ rows, target }: { rows: { label: string; pct: number; hint?: string }[]; target: number }) {
  const max = Math.max(target * 1.5, ...rows.map((r) => r.pct), 1)
  if (!rows.length) return <p className="text-sm text-ink/55">Nothing to show yet.</p>
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink/70">{r.label}{r.hint && <span className="text-ink/45"> · {r.hint}</span>}</span>
            <span className={`font-semibold tabular-nums ${r.pct > target ? 'text-warn' : ''}`}>{pct(r.pct)}</span>
          </div>
          <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-ink/8">
            <div className="h-full rounded-full" style={{ width: `${(r.pct / max) * 100}%`, background: r.pct > target ? 'var(--color-warn)' : 'var(--color-brand)' }} />
            <div className="absolute inset-y-0 w-px bg-ink/40" style={{ left: `${(target / max) * 100}%` }} aria-hidden="true" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function RankList({ title, rows }: { title: string; rows: { product: Product; cost: ReturnType<typeof calculateRecipeCost>; sold: number }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{title}</p>
      <ol className="mt-2 space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.product.id} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">{r.product.name}</span>
            <span className="shrink-0 tabular-nums text-ink/70">{pct(r.cost?.foodCostPercent ?? 0)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function WasteDialog({ outlets, stock, stockOf, onSave, onClose }: { outlets: PosOutlet[]; stock: StockItem[]; stockOf: (name: string) => number; onSave: (input: WastageInput) => void; onClose: () => void }) {
  const food = stock.filter((s) => s.id.startsWith('fnb-') || s.category === 'Food' || s.category === 'Beverage')
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? '')
  const [stockItemId, setStockItemId] = useState(food[0]?.id ?? '')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState<WasteReason>('Spoiled')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const item = stock.find((s) => s.id === stockItemId)
  function save() {
    const n = Number(qty)
    if (!item) return setError('Choose the stock item.')
    if (!(n > 0)) return setError('Quantity must be above zero.')
    if (n > stockOf(item.name)) return setError(`Only ${qtyText(stockOf(item.name), item.unit)} in stock.`)
    onSave({ outletId, stockItemId, itemName: item.name, qty: n, unit: item.unit, reason, cost: Math.round(n * item.unitCost), note: note.trim() || undefined })
  }
  return (
    <Modal title="Log wastage" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Continue</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Outlet">{(id) => <Select id={id} value={outletId} onChange={(e) => setOutletId(e.target.value)}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>
        <Field label="Item">{(id) => <Select id={id} value={stockItemId} onChange={(e) => setStockItemId(e.target.value)}>{food.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
        <Field label={`Quantity${item ? ` (${item.unit})` : ''}`} error={error} hint={item ? `${qtyText(stockOf(item.name), item.unit)} in stock` : undefined}>{(id) => <Input id={id} type="number" min={0} value={qty} onChange={(e) => { setQty(e.target.value); setError('') }} />}</Field>
        <Field label="Reason">{(id) => <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as WasteReason)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select>}</Field>
        <div className="sm:col-span-2"><Field label="Note">{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field></div>
      </div>
      {item && Number(qty) > 0 && <p className="mt-3 text-sm text-ink/60">Value {cash(Number(qty) * item.unitCost)}</p>}
    </Modal>
  )
}

function TransferDialog({ outlets, stock, stockOf, onSave, onClose }: { outlets: PosOutlet[]; stock: StockItem[]; stockOf: (name: string) => number; onSave: (input: TransferInput) => void; onClose: () => void }) {
  const food = stock.filter((s) => s.id.startsWith('fnb-') || s.category === 'Food' || s.category === 'Beverage')
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? '')
  const [toLocation, setTo] = useState<'Kitchen' | 'Bar'>('Kitchen')
  const [lines, setLines] = useState([{ stockItemId: food[0]?.id ?? '', qty: '' }])
  const [error, setError] = useState('')
  function save() {
    const out: TransferInput['lines'] = []
    for (const l of lines) {
      const item = stock.find((s) => s.id === l.stockItemId)
      const n = Number(l.qty)
      if (!item) return setError('Choose an item on every line.')
      if (!(n > 0)) return setError(`Enter a quantity for ${item.name}.`)
      if (n > stockOf(item.name)) return setError(`Only ${qtyText(stockOf(item.name), item.unit)} of ${item.name} in the store.`)
      out.push({ stockItemId: item.id, itemName: item.name, qty: n, unit: item.unit, unitCost: item.unitCost })
    }
    if (new Set(out.map((l) => l.stockItemId)).size !== out.length) return setError('Each item once per transfer.')
    onSave({ outletId, toLocation, lines: out })
  }
  return (
    <Modal title="Transfer from main store" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}>Continue</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Outlet">{(id) => <Select id={id} value={outletId} onChange={(e) => setOutletId(e.target.value)}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>
          <Field label="To">{(id) => <Select id={id} value={toLocation} onChange={(e) => setTo(e.target.value as 'Kitchen' | 'Bar')}><option>Kitchen</option><option>Bar</option></Select>}</Field>
        </div>
        {lines.map((l, i) => {
          const item = stock.find((s) => s.id === l.stockItemId)
          return (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-end gap-2">
              <Select aria-label="Item" value={l.stockItemId} onChange={(e) => setLines((old) => old.map((x, j) => (j === i ? { ...x, stockItemId: e.target.value } : x)))}>
                {food.map((s) => <option key={s.id} value={s.id}>{s.name} · {qtyText(stockOf(s.name), s.unit)}</option>)}
              </Select>
              <Input aria-label="Quantity" type="number" min={0} placeholder={item?.unit} value={l.qty} onChange={(e) => { setLines((old) => old.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x))); setError('') }} />
              <Button variant="ghost" disabled={lines.length === 1} onClick={() => setLines((old) => old.filter((_, j) => j !== i))}>×</Button>
            </div>
          )
        })}
        <Button size="sm" variant="ghost" onClick={() => setLines((old) => [...old, { stockItemId: food[0]?.id ?? '', qty: '' }])}>+ Item</Button>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

function CountDialog({ item, current, onSave, onClose }: { item: StockItem; current?: number; onSave: (closing: number) => Promise<unknown>; onClose: () => void }) {
  const [value, setValue] = useState(current === undefined ? '' : String(current))
  const [error, setError] = useState('')
  return (
    <Modal title={`Count · ${item.name}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => (value === '' ? setError('Enter what is on the shelf.') : onSave(Number(value)).catch((e: unknown) => setError(errorText(e))))}>Save count</Button></>}>
      <Field label={`On the outlet shelves now (${item.unit})`} error={error}>{(id) => <Input id={id} type="number" min={0} value={value} onChange={(e) => { setValue(e.target.value); setError('') }} />}</Field>
    </Modal>
  )
}
