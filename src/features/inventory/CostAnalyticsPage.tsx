import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, DataTable, Donut, LoadingState, MoneyBars, PageHeader, Segmented, StackedBars, StatCard, Tabs } from '../../components/ui'
import { buttonClass } from '../../components/ui'
import { ugx } from '../../lib/format'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { daysLeft, expiryState, formatExpiry } from '../procurement/batches'
import { CONSUMER_COLOUR, consumerOf, consumerOfDepartment, daysSince, qtyText } from '../procurement/procurementUi'
import { useRequests } from '../procurement/requestsContext'
import { sameName } from '../procurement/requestsModel'
import type { ConsumerGroup } from '../../services/procurement/procurementTypes'
import { useProcurement } from '../procurement/useProcurement'

// Area I: cost control in one place. Reorder and expiry alerts, slow-moving stock, wastage, spend and
// consumption by department. Live stock, batches, write-offs, orders and issues come from the supply
// chain; past months come from the procurement service.

type View = 'alerts' | 'slow' | 'wastage' | 'spend' | 'consumption'
type Period = '30' | '90' | '180'

const DAY = 86_400_000
const GROUPS: ConsumerGroup[] = ['Housekeeping consumables', 'Maintenance spares', 'Food and beverage', 'Other']
const monthLabel = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
const money = (n: number) => ugx(Math.round(n))
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)))

export default function CostAnalyticsPage() {
  const { data } = useProcurement()
  const { stock, batches, losses, movements, orders, stockOf, onOrderOf, expiryWarn, topUp, storeName } = useRequests()
  const { features } = useFeatures()
  const { can } = useAuth()
  const [view, setView] = useState<View>('alerts')
  const [period, setPeriod] = useState<Period>('90')
  const [spendBy, setSpendBy] = useState<'supplier' | 'category'>('supplier')
  const [now] = useState(() => Date.now())
  const [topUpMsg, setTopUpMsg] = useState<string | null>(null)

  const categories = useMemo(() => data?.categories ?? [], [data])
  const itemOf = (name: string) => stock.find((s) => sameName(s.name, name))
  const deptOfStore = (storeId?: string) => data?.stores.find((s) => s.legacyStoreId === (storeId ?? 'main'))?.department ?? 'Store'

  // Every issue and sale: the service's history plus today's movements from the store.
  const usage = useMemo(() => {
    const past = (data?.movements ?? []).map((m) => ({ at: m.at, item: m.itemName, qty: m.qty, value: m.qty * m.unitCost, department: m.department }))
    const live = movements
      .filter((m) => m.kind === 'Issued' && m.to)
      .map((m) => {
        const to = m.to ?? ''
        const department = to.endsWith(' POS') ? (to.includes('Bar') ? 'Bar' : 'Kitchen') : to
        return { at: m.at, item: m.item, qty: m.qty, value: m.qty * (m.cost ?? 0), department }
      })
    return [...past, ...live]
  }, [data, movements])

  if (!data) return <LoadingState />

  const since = (days: number) => new Date(now - days * DAY).toISOString()
  const days = Number(period)

  // ---- alerts ----
  const reorder = stock
    .filter((s) => s.reorderAt > 0 && stockOf(s.name) <= s.reorderAt)
    .map((s) => ({ s, have: stockOf(s.name), onOrder: onOrderOf(s.name), suggest: Math.max(0, (s.par ?? s.reorderAt * 2) - stockOf(s.name) - onOrderOf(s.name)) }))
  const toRaise = reorder.filter((r) => r.suggest > 0)
  const balanceOf = (storeId: string, item: string) => data.balances.find((b) => b.storeId === storeId && sameName(b.itemName, item))?.qty ?? 0
  const outletLow = features.storeTransfers ? data.reorderRules.filter((r) => balanceOf(r.storeId, r.itemName) <= r.reorderAt) : []
  const live = batches.filter((b) => b.qty > 0)
  const expired = live.filter((b) => expiryState(b.expiry, expiryWarn, now) === 'expired')
  const soon = live.filter((b) => expiryState(b.expiry, expiryWarn, now) === 'soon')
  const expiryRows = [...expired, ...soon].sort((a, b) => a.expiry.localeCompare(b.expiry))
  const atRisk = expiryRows.reduce((s, b) => s + b.qty * b.unitCost, 0)

  // ---- slow-moving ----
  const slow = stock
    .filter((s) => s.onHand > 0)
    .map((s) => {
      const mine = usage.filter((u) => sameName(u.item, s.name))
      const last = mine.reduce((m, u) => (u.at > m ? u.at : m), '')
      const used90 = mine.filter((u) => u.at >= since(90)).reduce((n, u) => n + u.qty, 0)
      const perDay = used90 / 90
      const cover = perDay > 0 ? Math.round(s.onHand / perDay) : Infinity
      const idle = last ? daysSince(last, now) : Infinity
      return { s, last, idle, used90, cover, value: s.onHand * s.unitCost }
    })
    .filter((x) => x.idle >= 45 || x.cover > 120)
    .sort((a, b) => b.value - a.value)
  const tiedUp = slow.reduce((s, x) => s + x.value, 0)

  // ---- wastage ----
  const writeOffs = losses
    .filter((l) => l.status === 'Posted' || l.status === 'Waiting approval')
    .map((l) => ({ at: l.at, item: l.item, value: l.qty * l.unitCost, reason: l.reason, department: deptOfStore(itemOf(l.item)?.store) }))
  const wasted = [
    ...writeOffs,
    ...data.wastage.map((w) => ({ at: w.at, item: w.itemName, value: w.qty * (w.unitCost || itemOf(w.itemName)?.unitCost || 0), reason: w.reason, department: w.department })),
  ].filter((w) => w.at >= since(days))
  const wasteTotal = wasted.reduce((s, w) => s + w.value, 0)
  const wasted30 = [...writeOffs, ...data.wastage.map((w) => ({ at: w.at, value: w.qty * (w.unitCost || itemOf(w.itemName)?.unitCost || 0) }))]
    .filter((w) => w.at >= since(30))
    .reduce((s, w) => s + w.value, 0)
  const groupBy = <T,>(rows: T[], key: (r: T) => string, val: (r: T) => number) => {
    const m = new Map<string, { label: string; amount: number; count: number }>()
    rows.forEach((r) => {
      const k = key(r)
      const e = m.get(k) ?? { label: k, amount: 0, count: 0 }
      e.amount += val(r)
      e.count += 1
      m.set(k, e)
    })
    return [...m.values()].sort((a, b) => b.amount - a.amount)
  }

  // ---- spend ----
  const historic = data.prices.filter((p) => p.source === 'PO')
  const known = new Set(historic.map((p) => p.reference))
  const spendRows = [
    ...historic.map((p) => ({ at: p.at, supplier: p.supplierName, item: p.itemName, value: p.qty * p.unitPrice })),
    ...orders.filter((o) => !known.has(o.id)).flatMap((o) => o.items.map((i, n) => ({ at: o.createdAt, supplier: o.supplier, item: i.name, value: (o.closedShort ? (o.got?.[n] ?? 0) : i.qty) * i.unitCost }))),
  ]
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now)
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return d
  })
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const thisMonth = monthKey(new Date(now))
  const spendMonth = spendRows.filter((r) => r.at.slice(0, 7) === thisMonth).reduce((s, r) => s + r.value, 0)
  const spendSix = spendRows.filter((r) => r.at >= months[0].toISOString())
  const bars = months.map((m) => ({ label: monthLabel(m), parts: [{ key: 'Spend', value: spendRows.filter((r) => r.at.slice(0, 7) === monthKey(m)).reduce((s, r) => s + r.value, 0) }] }))
  const spendGroups = groupBy(spendSix, (r) => (spendBy === 'supplier' ? r.supplier : (itemOf(r.item)?.category ?? 'Other')), (r) => r.value)

  // ---- consumption ----
  const used = usage.filter((u) => u.at >= since(days))
  const groupOf = (u: { item: string; department: string }) => {
    const byDept = consumerOfDepartment(u.department)
    return byDept !== 'Other' ? byDept : consumerOf(itemOf(u.item)?.category, categories)
  }
  const byGroup = GROUPS.map((g) => ({ g, value: used.filter((u) => groupOf(u) === g).reduce((s, u) => s + u.value, 0) })).filter((x) => x.value > 0)
  const byDept = groupBy(used, (u) => u.department, (u) => u.value)
  const topItems = groupBy(used, (u) => u.item, (u) => u.value).slice(0, 8)

  function raiseTopUp() {
    const r = topUp(toRaise.map((x) => ({ itemId: x.s.id, qty: x.suggest })))
    setTopUpMsg(r.ok ? `${r.value} raised for ${toRaise.length} items.` : r.error)
  }

  const storeLabel = (id?: string) => (features.stores ? storeName(id) : 'Store')
  const outletName = (id: string) => {
    const s = data.stores.find((x) => x.id === id)
    return s ? (s.legacyStoreId ? storeName(s.legacyStoreId) : s.name) : id
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Inventory" title="Cost control" description="Reorder, expiry, slow stock, wastage, spend and consumption." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Below reorder" value={reorder.length + outletLow.length} icon="alert" tone={reorder.length ? 'bad' : 'default'} onClick={() => setView('alerts')} active={view === 'alerts'} />
        <StatCard label="Expiry risk" value={expiryRows.length} hint={money(atRisk)} icon="calendar" tone={expired.length ? 'bad' : soon.length ? 'warn' : 'default'} onClick={() => setView('alerts')} />
        <StatCard label="Waste, 30 days" value={money(wasted30)} icon="money" tone={wasted30 > 0 ? 'warn' : 'default'} onClick={() => setView('wastage')} active={view === 'wastage'} />
        <StatCard label="Month spend" value={money(spendMonth)} icon="list" onClick={() => setView('spend')} active={view === 'spend'} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Cost control"
          value={view}
          onChange={setView}
          tabs={[
            { key: 'alerts', label: 'Alerts', count: reorder.length + outletLow.length + expiryRows.length, alert: expired.length > 0 },
            { key: 'slow', label: 'Slow-moving', count: slow.length },
            { key: 'wastage', label: 'Wastage' },
            { key: 'spend', label: 'Spend' },
            { key: 'consumption', label: 'Consumption' },
          ]}
        />
        {(view === 'wastage' || view === 'consumption') && (
          <Segmented
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { key: '30', label: '30 days' },
              { key: '90', label: '90 days' },
              { key: '180', label: '6 months' },
            ]}
          />
        )}
      </div>

      {view === 'alerts' && (
        <div className="space-y-4">
          <Card
            title="Reorder"
            icon="alert"
            count={reorder.length}
            padded={false}
            actions={can('manageStock') && toRaise.length > 0 && <Button size="sm" onClick={raiseTopUp}>Raise top-up for {toRaise.length}</Button>}
          >
            {topUpMsg && <p className="border-b border-ink/10 px-4 py-2 text-sm text-ink/70">{topUpMsg}</p>}
            <DataTable
              columns={[
                { key: 'i', header: 'Item', cell: (r) => <span className="font-medium">{r.s.name}</span> },
                { key: 's', header: 'Store', cell: (r) => storeLabel(r.s.store), hideBelow: 'md' },
                { key: 'h', header: 'On hand', cell: (r) => <span className="font-semibold text-bad">{qtyText(r.have)}</span>, align: 'right' },
                { key: 'l', header: 'Reorder / par', cell: (r) => `${qtyText(r.s.reorderAt)} / ${qtyText(r.s.par ?? 0)}`, align: 'right', hideBelow: 'sm' },
                { key: 'o', header: 'On order', cell: (r) => qtyText(r.onOrder), align: 'right', hideBelow: 'sm' },
                { key: 'g', header: 'Suggest', cell: (r) => (r.suggest > 0 ? `${qtyText(r.suggest)} ${r.s.unit}` : <Badge tone="good">Covered</Badge>), align: 'right' },
              ]}
              rows={reorder}
              rowKey={(r) => r.s.id}
              empty={{ title: 'Everything is above its reorder level' }}
            />
          </Card>

          {features.storeTransfers && (
            <Card
              title="Outlet levels"
              count={outletLow.length}
              padded={false}
              actions={<Link to="/inventory/transfers" className={buttonClass('ghost', 'sm')}>Transfers</Link>}
            >
              <DataTable
                columns={[
                  { key: 's', header: 'Outlet', cell: (r) => outletName(r.storeId) },
                  { key: 'i', header: 'Item', cell: (r) => r.itemName },
                  { key: 'b', header: 'In outlet', cell: (r) => <span className="font-semibold text-bad">{qtyText(balanceOf(r.storeId, r.itemName))}</span>, align: 'right' },
                  { key: 'p', header: 'Refill to', cell: (r) => qtyText(r.par), align: 'right' },
                ]}
                rows={outletLow}
                rowKey={(r) => r.id}
                empty={{ title: 'Every outlet is above its level' }}
              />
            </Card>
          )}

          <Card
            title="Expiry"
            count={expiryRows.length}
            padded={false}
            actions={features.lossReports && expired.length > 0 && <Link to="/inventory/losses" className={buttonClass('ghost', 'sm')}>Write off</Link>}
          >
            <DataTable
              columns={[
                { key: 'i', header: 'Item', cell: (b) => <span className="font-medium">{b.item}</span> },
                { key: 'b', header: 'Batch', cell: (b) => b.batchNo ?? b.id, hideBelow: 'md' },
                { key: 'e', header: 'Expiry', cell: (b) => formatExpiry(b.expiry), hideBelow: 'sm' },
                { key: 'q', header: 'Qty', cell: (b) => `${qtyText(b.qty)} ${itemOf(b.item)?.unit ?? ''}`, align: 'right' },
                { key: 'v', header: 'Value', cell: (b) => money(b.qty * b.unitCost), align: 'right', hideBelow: 'sm' },
                {
                  key: 's',
                  header: '',
                  cell: (b) => {
                    const d = daysLeft(b.expiry, now)
                    return d < 0 ? <Badge tone="bad">Expired</Badge> : <Badge tone="warn">{d === 0 ? 'Today' : `${d} days`}</Badge>
                  },
                  align: 'right',
                },
              ]}
              rows={expiryRows}
              rowKey={(b) => b.id}
              empty={{ title: features.batchExpiry ? 'Nothing expired or expiring soon' : 'Expiry dates are not tracked on this plan' }}
            />
          </Card>
        </div>
      )}

      {view === 'slow' && (
        <Card title="Slow-moving stock" description={`${money(tiedUp)} tied up`} padded={false}>
          <DataTable
            columns={[
              { key: 'i', header: 'Item', cell: (x) => <span className="font-medium">{x.s.name}</span> },
              { key: 's', header: 'Store', cell: (x) => storeLabel(x.s.store), hideBelow: 'lg' },
              { key: 'h', header: 'On hand', cell: (x) => `${qtyText(x.s.onHand)} ${x.s.unit}`, align: 'right' },
              { key: 'v', header: 'Value', cell: (x) => money(x.value), align: 'right' },
              { key: 'l', header: 'Last used', cell: (x) => (x.last ? `${x.idle} days ago` : 'Never'), align: 'right', hideBelow: 'sm' },
              { key: 'c', header: 'Cover', cell: (x) => (x.cover === Infinity ? 'No use' : `${x.cover} days`), align: 'right', hideBelow: 'md' },
              { key: 'b', header: '', cell: (x) => (x.idle >= 45 ? <Badge tone="bad">Not moving</Badge> : <Badge tone="warn">Overstocked</Badge>), align: 'right' },
            ]}
            rows={slow}
            rowKey={(x) => x.s.id}
            empty={{ title: 'No slow-moving stock' }}
          />
        </Card>
      )}

      {view === 'wastage' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="By reason" description={money(wasteTotal)}>
              {wasted.length ? <MoneyBars rows={groupBy(wasted, (w) => w.reason, (w) => w.value).map((r) => ({ ...r, tone: 'bad' as const }))} /> : <p className="text-sm text-ink/55">No wastage in this period.</p>}
            </Card>
            <Card title="By department">
              {wasted.length ? <MoneyBars rows={groupBy(wasted, (w) => w.department, (w) => w.value).map((r) => ({ ...r, tone: 'warn' as const }))} /> : <p className="text-sm text-ink/55">No wastage in this period.</p>}
            </Card>
          </div>
          <Card title="Most wasted items" padded={false}>
            <DataTable
              columns={[
                { key: 'i', header: 'Item', cell: (r) => r.label },
                { key: 'c', header: 'Times', cell: (r) => r.count, align: 'right' },
                { key: 'v', header: 'Value', cell: (r) => money(r.amount), align: 'right' },
              ]}
              rows={groupBy(wasted, (w) => w.item, (w) => w.value).slice(0, 8)}
              rowKey={(r) => r.label}
              empty={{ title: 'No wastage in this period' }}
            />
          </Card>
        </div>
      )}

      {view === 'spend' && (
        <div className="space-y-4">
          <Card title="Spend by month" description={`${money(spendSix.reduce((s, r) => s + r.value, 0))} over six months`}>
            <StackedBars bars={bars} keys={['Spend']} />
          </Card>
          <Card
            title={spendBy === 'supplier' ? 'By supplier' : 'By category'}
            actions={
              <Segmented
                label="Group spend"
                value={spendBy}
                onChange={setSpendBy}
                options={[
                  { key: 'supplier', label: 'Supplier' },
                  { key: 'category', label: 'Category' },
                ]}
              />
            }
          >
            <MoneyBars rows={spendGroups} />
          </Card>
        </div>
      )}

      {view === 'consumption' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="By area">
              {byGroup.length ? (
                <Donut
                  centre={compact(byGroup.reduce((s, x) => s + x.value, 0))}
                  caption="Consumption by area"
                  slices={byGroup.map((x) => ({ label: `${x.g} (%)`, value: Math.round((x.value / Math.max(1, byGroup.reduce((s, y) => s + y.value, 0))) * 100), colour: CONSUMER_COLOUR[x.g] }))}
                />
              ) : (
                <p className="text-sm text-ink/55">Nothing used in this period.</p>
              )}
            </Card>
            <Card title="By department">
              <MoneyBars rows={byDept} />
            </Card>
          </div>
          <Card title="Top items used" padded={false}>
            <DataTable
              columns={[
                { key: 'i', header: 'Item', cell: (r) => r.label },
                { key: 'g', header: 'Area', cell: (r) => groupOf({ item: r.label, department: '' }), hideBelow: 'md' },
                { key: 'v', header: 'Value', cell: (r) => money(r.amount), align: 'right' },
              ]}
              rows={topItems}
              rowKey={(r) => r.label}
              empty={{ title: 'Nothing used in this period' }}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
