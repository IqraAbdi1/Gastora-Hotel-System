import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Input, LoadingState, Modal, PageHeader, Select, StatCard, Tabs } from '../../components/ui'
import type { Column } from '../../components/ui'
import { ugx } from '../../lib/format'
import type { StoreRecord, Transfer, TransferLine } from '../../services/procurement/procurementTypes'
import { useFeatures } from '../platform/featuresContext'
import { LEVEL_LABEL, TRANSFER_STATUS, qtyText, shortDate, toStockQty, unitsFor } from '../procurement/procurementUi'
import { useRequests } from '../procurement/requestsContext'
import { departments, sameName } from '../procurement/requestsModel'
import type { Department } from '../procurement/requestsModel'
import { useProcurement } from '../procurement/useProcurement'

// Area I: central, property and outlet stores, transfers between them (send, then receive), and the
// pack sizes stock is counted in. Stock in an item's own store stays on the stock list; a transfer out
// of it is an issue there, and a transfer back into it is a return.

type View = 'transfers' | 'stores' | 'units'

const STAFF = ['owner', 'admin', 'gm', 'storekeeper']
const SETUP = ['owner', 'admin']

const asDepartment = (d?: string): Department => ((departments as readonly string[]).includes(d ?? '') ? (d as Department) : 'Store')

export default function TransfersPage() {
  const { data, actor } = useProcurement()
  const { storeName } = useRequests()
  const { features } = useFeatures()
  const [view, setView] = useState<View>('transfers')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ from?: string; to?: string; item?: string; qty?: number } | null>(null)
  const role = actor?.role ?? ''

  if (!data) return <LoadingState />

  const nameOf = (s?: StoreRecord) => (s ? (s.legacyStoreId ? storeName(s.legacyStoreId) : s.name) : 'Unknown store')
  const store = (id: string) => data.stores.find((s) => s.id === id)
  const inTransit = data.transfers.filter((t) => t.status === 'sent')
  const drafts = data.transfers.filter((t) => t.status === 'draft')
  const balanceOf = (storeId: string, item: string) => data.balances.find((b) => b.storeId === storeId && sameName(b.itemName, item))?.qty ?? 0
  const low = data.reorderRules.filter((r) => balanceOf(r.storeId, r.itemName) <= r.reorderAt)

  const columns: Column<Transfer>[] = [
    { key: 'id', header: 'Transfer', cell: (t) => <span className="font-semibold">{t.id.replace(`${t.propertyId}-`, '')}</span> },
    {
      key: 'route',
      header: 'From → to',
      cell: (t) => (
        <span>
          {nameOf(store(t.fromStoreId))} → {nameOf(store(t.toStoreId))}
        </span>
      ),
    },
    { key: 'items', header: 'Items', cell: (t) => <span className="block max-w-64 truncate">{t.lines.map((l) => `${qtyText(l.enteredQty)} ${l.enteredUnit} ${l.itemName}`).join(', ')}</span>, hideBelow: 'md' },
    { key: 'when', header: 'Raised', cell: (t) => `${shortDate(t.createdAt)} · ${t.createdBy}`, hideBelow: 'lg' },
    { key: 'status', header: 'Status', cell: (t) => <Badge tone={TRANSFER_STATUS[t.status].tone} dot>{TRANSFER_STATUS[t.status].label}</Badge> },
  ]

  const current = data.transfers.find((t) => t.id === openId)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventory"
        title="Store transfers"
        description={features.crossProperty ? 'Move stock between central, property and outlet stores.' : 'Move stock between the main store and its outlets.'}
        actions={STAFF.includes(role) && <Button onClick={() => setCreating({})}>New transfer</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In transit" value={inTransit.length} icon="tasks" tone={inTransit.length ? 'warn' : 'default'} onClick={() => setView('transfers')} active={view === 'transfers'} />
        <StatCard label="Drafts" value={drafts.length} icon="list" />
        <StatCard label="Outlets low" value={low.length} icon="alert" tone={low.length ? 'bad' : 'default'} onClick={() => setView('stores')} active={view === 'stores'} />
        <StatCard label="Stores" value={data.stores.filter((s) => s.active).length} icon="occupancy" hint={`${data.conversions.length} pack sizes`} />
      </div>

      <Tabs
        label="Stores"
        value={view}
        onChange={setView}
        tabs={[
          { key: 'transfers', label: 'Transfers', count: data.transfers.length, alert: inTransit.length > 0 },
          { key: 'stores', label: 'Stores and levels', count: data.stores.length, alert: low.length > 0 },
          { key: 'units', label: 'Units', count: data.conversions.length },
        ]}
      />

      {view === 'transfers' && (
        <Card padded={false}>
          <DataTable columns={columns} rows={data.transfers} rowKey={(t) => t.id} onRowClick={(t) => setOpenId(t.id)} empty={{ title: 'No transfers yet' }} />
        </Card>
      )}

      {view === 'stores' && (
        <StoresTab
          nameOf={nameOf}
          canSetup={SETUP.includes(role)}
          canStaff={STAFF.includes(role)}
          onRefill={(storeId, item, qty) => {
            const to = store(storeId)
            const from = to?.parentId
            setCreating({ from, to: storeId, item, qty })
            setView('transfers')
          }}
        />
      )}

      {view === 'units' && <UnitsTab canEdit={STAFF.includes(role)} />}

      {creating && <NewTransferDialog preset={creating} nameOf={nameOf} onClose={() => setCreating(null)} onCreated={(id) => { setCreating(null); setOpenId(id) }} />}
      {current && <TransferDetail transfer={current} nameOf={nameOf} canAct={STAFF.includes(role)} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function StoresTab({ nameOf, canSetup, canStaff, onRefill }: { nameOf: (s?: StoreRecord) => string; canSetup: boolean; canStaff: boolean; onRefill: (storeId: string, item: string, qty: number) => void }) {
  const { data } = useProcurement()
  const { stock, stores: legacy } = useRequests()
  const [editing, setEditing] = useState<StoreRecord | 'new' | null>(null)
  const [level, setLevel] = useState<{ storeId: string; itemName?: string } | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const { run, service, propertyId } = useProcurement()
  if (!data) return null

  const balanceOf = (storeId: string, item: string) => data.balances.find((b) => b.storeId === storeId && sameName(b.itemName, item))?.qty ?? 0
  const costOf = (item: string) => stock.find((s) => sameName(s.name, item))?.unitCost ?? 0
  const valueOf = (s: StoreRecord) => {
    const own = s.legacyStoreId ? stock.filter((i) => (i.store ?? 'main') === s.legacyStoreId).reduce((n, i) => n + i.onHand * i.unitCost, 0) : 0
    return own + data.balances.filter((b) => b.storeId === s.id).reduce((n, b) => n + b.qty * costOf(b.itemName), 0)
  }
  const itemsIn = (s: StoreRecord) =>
    (s.legacyStoreId ? stock.filter((i) => (i.store ?? 'main') === s.legacyStoreId).length : 0) + data.balances.filter((b) => b.storeId === s.id && b.qty > 0).length
  const unlinked = legacy.filter((l) => !data.stores.some((s) => s.legacyStoreId === l.id))
  const main = data.stores.find((s) => s.legacyStoreId === 'main')

  // Depth-first, so each store sits under the one it draws from.
  const ordered: { s: StoreRecord; depth: number }[] = []
  const walk = (parent: string | undefined, depth: number) =>
    data.stores
      .filter((s) => s.parentId === parent)
      .forEach((s) => {
        ordered.push({ s, depth })
        walk(s.id, depth + 1)
      })
  walk(undefined, 0)
  data.stores.filter((s) => !ordered.some((o) => o.s.id === s.id)).forEach((s) => ordered.push({ s, depth: 0 }))

  const outletsWithRules = data.stores.filter((s) => data.reorderRules.some((r) => r.storeId === s.id))

  return (
    <div className="space-y-4">
      <Card title="Store hierarchy" padded={false} actions={canSetup && <Button size="sm" onClick={() => setEditing('new')}>Add store</Button>}>
        <ul className="divide-y divide-ink/8">
          {ordered.map(({ s, depth }) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5 pr-4 text-sm" style={{ paddingLeft: `${16 + depth * 20}px` }}>
              {depth > 0 && <span className="text-ink/30">└</span>}
              <span className={`font-medium ${s.active ? '' : 'text-ink/40 line-through'}`}>{nameOf(s)}</span>
              <Badge tone={s.level === 'central' ? 'accent' : s.level === 'property' ? 'brand' : 'info'}>{LEVEL_LABEL[s.level]}</Badge>
              {s.department && s.department !== 'Store' && <span className="text-xs text-ink/50">{s.department}</span>}
              <span className="flex-1" />
              <span className="text-xs text-ink/55">{itemsIn(s)} items</span>
              <span className="w-32 text-right tabular-nums">{ugx(Math.round(valueOf(s)))}</span>
              {canSetup && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                  Edit
                </Button>
              )}
            </li>
          ))}
        </ul>
        {canSetup && unlinked.length > 0 && main && (
          <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 px-4 py-3 text-sm">
            <span className="text-ink/60">Not placed yet:</span>
            {unlinked.map((l) => (
              <Button
                key={l.id}
                size="sm"
                variant="secondary"
                onClick={async () => setLinkError(await run((a) => service.saveStore({ propertyId, name: l.name, level: 'property', parentId: main.id, legacyStoreId: l.id }, a)))}
              >
                Add {l.name}
              </Button>
            ))}
            {linkError && <span className="text-bad">{linkError}</span>}
          </div>
        )}
      </Card>

      <Card title="Outlet levels" padded={false} actions={canStaff && <Button size="sm" variant="secondary" onClick={() => setLevel({ storeId: '' })}>Set a level</Button>}>
        {outletsWithRules.length === 0 ? (
          <EmptyState title="No outlet levels set" />
        ) : (
          <DataTable
            columns={[
              { key: 'store', header: 'Store', cell: (r) => nameOf(data.stores.find((s) => s.id === r.storeId)) },
              { key: 'item', header: 'Item', cell: (r) => r.itemName },
              {
                key: 'bal',
                header: 'In store',
                cell: (r) => <span className={balanceOf(r.storeId, r.itemName) <= r.reorderAt ? 'font-semibold text-bad' : ''}>{qtyText(balanceOf(r.storeId, r.itemName))}</span>,
                align: 'right',
              },
              { key: 'lvl', header: 'Reorder / par', cell: (r) => `${r.reorderAt} / ${r.par}`, align: 'right', hideBelow: 'sm' },
              {
                key: 'act',
                header: '',
                align: 'right',
                cell: (r) => (
                  <span className="flex justify-end gap-2">
                    {canStaff && balanceOf(r.storeId, r.itemName) <= r.reorderAt && (
                      <Button size="sm" onClick={() => onRefill(r.storeId, r.itemName, r.par - balanceOf(r.storeId, r.itemName))}>
                        Refill
                      </Button>
                    )}
                    {canStaff && (
                      <Button size="sm" variant="ghost" onClick={() => setLevel({ storeId: r.storeId, itemName: r.itemName })}>
                        Edit
                      </Button>
                    )}
                  </span>
                ),
              },
            ]}
            rows={data.reorderRules}
            rowKey={(r) => r.id}
          />
        )}
      </Card>

      {editing && <StoreDialog store={editing === 'new' ? undefined : editing} nameOf={nameOf} onClose={() => setEditing(null)} />}
      {level && <LevelDialog preset={level} nameOf={nameOf} onClose={() => setLevel(null)} />}
    </div>
  )
}

function StoreDialog({ store, nameOf, onClose }: { store?: StoreRecord; nameOf: (s?: StoreRecord) => string; onClose: () => void }) {
  const { data, run, service, propertyId } = useProcurement()
  const { features } = useFeatures()
  const [name, setName] = useState(store ? nameOf(store) : '')
  const [level, setLevel] = useState<StoreRecord['level']>(store?.level ?? 'outlet')
  const [parentId, setParentId] = useState(store?.parentId ?? data?.stores.find((s) => s.legacyStoreId === 'main')?.id ?? '')
  const [department, setDepartment] = useState(store?.department ?? 'Bar')
  const [active, setActive] = useState(store?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const linked = !!store?.legacyStoreId
  const levels: StoreRecord['level'][] = features.crossProperty ? ['central', 'property', 'outlet'] : ['property', 'outlet']

  async function save() {
    const e = await run((a) => service.saveStore({ id: store?.id, propertyId, name: linked ? store?.name ?? name : name, level, parentId: level === 'central' ? undefined : parentId, department, active }, a))
    if (e) setError(e)
    else onClose()
  }

  return (
    <Modal
      title={store ? `Edit ${nameOf(store)}` : 'Add store'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" hint={linked ? 'Renamed from Stock > Stores.' : undefined}>
          {(id) => <Input id={id} value={name} disabled={linked} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pool bar" />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Level">
            {(id) => (
              <Select id={id} value={level} onChange={(e) => setLevel(e.target.value as StoreRecord['level'])}>
                {levels.map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Used by">
            {(id) => (
              <Select id={id} value={department} onChange={(e) => setDepartment(e.target.value)}>
                {['Store', ...departments].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {level !== 'central' && (
          <Field label="Draws from">
            {(id) => (
              <Select id={id} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                {(data?.stores ?? [])
                  .filter((s) => s.id !== store?.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {nameOf(s)}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}
        {store && !linked && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            In use
          </label>
        )}
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

function LevelDialog({ preset, nameOf, onClose }: { preset: { storeId: string; itemName?: string }; nameOf: (s?: StoreRecord) => string; onClose: () => void }) {
  const { data, run, service, propertyId } = useProcurement()
  const { stock } = useRequests()
  const outlets = (data?.stores ?? []).filter((s) => !s.legacyStoreId || s.level === 'outlet')
  const existing = data?.reorderRules.find((r) => r.storeId === preset.storeId && r.itemName === preset.itemName)
  const [storeId, setStoreId] = useState(preset.storeId || outlets[0]?.id || '')
  const [itemName, setItemName] = useState(preset.itemName ?? stock[0]?.name ?? '')
  const [reorderAt, setReorderAt] = useState(String(existing?.reorderAt ?? ''))
  const [par, setPar] = useState(String(existing?.par ?? ''))
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      title="Outlet level"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={async () => {
              const e = await run((a) => service.saveReorderRule({ propertyId, storeId, itemName, reorderAt: Number(reorderAt), par: Number(par) }, a))
              if (e) setError(e)
              else onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Store">
            {(id) => (
              <Select id={id} value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={!!preset.itemName}>
                {outlets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {nameOf(s)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Item">
            {(id) => (
              <Select id={id} value={itemName} onChange={(e) => setItemName(e.target.value)} disabled={!!preset.itemName}>
                {stock.map((s) => (
                  <option key={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reorder at">{(id) => <Input id={id} type="number" min={0} value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} />}</Field>
          <Field label="Fill up to (par)">{(id) => <Input id={id} type="number" min={1} value={par} onChange={(e) => setPar(e.target.value)} />}</Field>
        </div>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

function UnitsTab({ canEdit }: { canEdit: boolean }) {
  const { data, run, service, propertyId } = useProcurement()
  const { stock } = useRequests()
  const [adding, setAdding] = useState(false)
  const [itemName, setItemName] = useState('')
  const [fromUnit, setFromUnit] = useState('crate')
  const [toUnit, setToUnit] = useState('bottle')
  const [factor, setFactor] = useState('24')
  const [error, setError] = useState<string | null>(null)
  const [calcItem, setCalcItem] = useState('Soda bottle')
  const [calcQty, setCalcQty] = useState('2')
  const [calcUnit, setCalcUnit] = useState('crate')
  if (!data) return null
  const item = stock.find((s) => s.name === calcItem)
  const options = unitsFor(item, data.conversions)
  const result = toStockQty(Number(calcQty) || 0, calcUnit, item, data.conversions)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2" title="Pack sizes" padded={false} actions={canEdit && <Button size="sm" onClick={() => setAdding(true)}>Add</Button>}>
        <DataTable
          columns={[
            { key: 'f', header: 'One', cell: (c) => <span className="font-medium">{c.fromUnit}</span> },
            { key: 'x', header: 'Holds', cell: (c) => `${c.factor} ${c.toUnit}`, align: 'right' },
            { key: 'i', header: 'For', cell: (c) => c.itemName ?? <span className="text-ink/50">Any item</span> },
            { key: 'r', header: '', cell: (c) => (canEdit ? <Button size="sm" variant="ghost" onClick={() => run((a) => service.removeConversion(c.id, a))}>Remove</Button> : null), align: 'right' },
          ]}
          rows={data.conversions}
          rowKey={(c) => c.id}
          empty={{ title: 'No pack sizes yet' }}
        />
      </Card>
      <Card title="Convert">
        <div className="space-y-3">
          <Select aria-label="Item" value={calcItem} onChange={(e) => { setCalcItem(e.target.value); setCalcUnit(stock.find((s) => s.name === e.target.value)?.unit ?? '') }}>
            {stock.map((s) => (
              <option key={s.id}>{s.name}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Input aria-label="Quantity" type="number" min={0} value={calcQty} onChange={(e) => setCalcQty(e.target.value)} className="w-24" />
            <Select aria-label="Unit" value={calcUnit} onChange={(e) => setCalcUnit(e.target.value)}>
              {options.map((o) => (
                <option key={o.unit}>{o.unit}</option>
              ))}
            </Select>
          </div>
          <p className="text-lg font-semibold">
            = {qtyText(result)} {item?.unit}
          </p>
        </div>
      </Card>
      {adding && (
        <Modal
          title="Add a pack size"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  const e = await run((a) => service.addConversion({ propertyId, itemName: itemName || undefined, fromUnit, toUnit, factor: Number(factor) }, a))
                  setError(e)
                  if (!e) setAdding(false)
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="One">
                {(id) => (
                  <Select id={id} value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
                    {data.units.map((u) => (
                      <option key={u.id}>{u.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Holds">{(id) => <Input id={id} type="number" min={0} value={factor} onChange={(e) => setFactor(e.target.value)} />}</Field>
              <Field label="Of">
                {(id) => (
                  <Select id={id} value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
                    {data.units.map((u) => (
                      <option key={u.id}>{u.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Only for this item">
              {(id) => (
                <Select id={id} value={itemName} onChange={(e) => setItemName(e.target.value)}>
                  <option value="">Any item</option>
                  {stock.map((s) => (
                    <option key={s.id}>{s.name}</option>
                  ))}
                </Select>
              )}
            </Field>
            {error && <p className="text-sm font-medium text-bad">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}

type DraftLine = { itemName: string; qty: string; unit: string }

function NewTransferDialog({
  preset,
  nameOf,
  onClose,
  onCreated,
}: {
  preset: { from?: string; to?: string; item?: string; qty?: number }
  nameOf: (s?: StoreRecord) => string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { data, run, service, propertyId } = useProcurement()
  const { stock, stockOf } = useRequests()
  const stores = (data?.stores ?? []).filter((s) => s.active)
  const [fromId, setFromId] = useState(preset.from ?? stores.find((s) => s.legacyStoreId === 'main')?.id ?? stores[0]?.id ?? '')
  const [toId, setToId] = useState(preset.to ?? stores.find((s) => s.id !== fromId)?.id ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const from = stores.find((s) => s.id === fromId)
  const to = stores.find((s) => s.id === toId)
  const itemOf = (n: string) => stock.find((s) => sameName(s.name, n))
  const isHome = (store: StoreRecord | undefined, name: string) => !!store?.legacyStoreId && (itemOf(name)?.store ?? 'main') === store.legacyStoreId

  // What the sending store holds: its own items from the stock list, and anything moved into it before.
  const available = (store: StoreRecord | undefined) => {
    if (!store || !data) return [] as { name: string; qty: number }[]
    const own = store.legacyStoreId ? stock.filter((i) => (i.store ?? 'main') === store.legacyStoreId).map((i) => ({ name: i.name, qty: stockOf(i.name) })) : []
    const moved = data.balances.filter((b) => b.storeId === store.id && b.qty > 0 && !own.some((o) => sameName(o.name, b.itemName))).map((b) => ({ name: b.itemName, qty: b.qty }))
    return [...own, ...moved].sort((a, b) => a.name.localeCompare(b.name))
  }
  const choices = available(from)
  const presetItem = preset.item && choices.some((c) => c.name === preset.item) ? preset.item : ''
  const [lines, setLines] = useState<DraftLine[]>([
    presetItem ? { itemName: presetItem, qty: String(preset.qty ?? 1), unit: itemOf(presetItem)?.unit ?? '' } : { itemName: '', qty: '', unit: '' },
  ])

  const resolved: TransferLine[] = lines
    .filter((l) => l.itemName && Number(l.qty) > 0)
    .map((l) => {
      const item = itemOf(l.itemName)
      return {
        itemName: l.itemName,
        enteredQty: Number(l.qty),
        enteredUnit: l.unit || item?.unit || '',
        qty: toStockQty(Number(l.qty), l.unit || item?.unit || '', item, data?.conversions ?? []),
        unitCost: item?.unitCost ?? 0,
        fromHome: isHome(from, l.itemName) || undefined,
        toHome: isHome(to, l.itemName) || undefined,
      }
    })

  async function save() {
    const avail: Record<string, number> = {}
    for (const l of resolved) if (l.fromHome) avail[l.itemName] = stockOf(l.itemName)
    let id = ''
    const e = await run(async (a) => {
      id = (await service.createTransfer({ propertyId, fromStoreId: fromId, toStoreId: toId, note, lines: resolved }, avail, a)).id
    })
    if (e) setError(e)
    else onCreated(id)
  }

  return (
    <Modal
      wide
      title="New transfer"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save draft</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            {(id) => (
              <Select id={id} value={fromId} onChange={(e) => { setFromId(e.target.value); setLines([{ itemName: '', qty: '', unit: '' }]) }}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {nameOf(s)} · {LEVEL_LABEL[s.level]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="To">
            {(id) => (
              <Select id={id} value={toId} onChange={(e) => setToId(e.target.value)}>
                {stores
                  .filter((s) => s.id !== fromId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {nameOf(s)} · {LEVEL_LABEL[s.level]}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink/80">Items</p>
          {choices.length === 0 && <p className="text-sm text-ink/55">Nothing in this store to send.</p>}
          {lines.map((l, i) => {
            const item = itemOf(l.itemName)
            const units = unitsFor(item, data?.conversions ?? [])
            const have = choices.find((c) => c.name === l.itemName)?.qty
            const stockQty = toStockQty(Number(l.qty) || 0, l.unit || item?.unit || '', item, data?.conversions ?? [])
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select aria-label="Item" value={l.itemName} onChange={(e) => setLines(lines.map((x, n) => (n === i ? { itemName: e.target.value, qty: x.qty, unit: itemOf(e.target.value)?.unit ?? '' } : x)))} className="min-w-0 flex-1">
                  <option value="">Pick an item…</option>
                  {choices.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({qtyText(c.qty)} {itemOf(c.name)?.unit})
                    </option>
                  ))}
                </Select>
                <Input aria-label="Quantity" type="number" min={0} value={l.qty} onChange={(e) => setLines(lines.map((x, n) => (n === i ? { ...x, qty: e.target.value } : x)))} className="w-24" />
                <Select aria-label="Unit" value={l.unit} onChange={(e) => setLines(lines.map((x, n) => (n === i ? { ...x, unit: e.target.value } : x)))} className="w-28">
                  {units.map((u) => (
                    <option key={u.unit}>{u.unit}</option>
                  ))}
                </Select>
                <span className={`w-36 text-xs ${have !== undefined && stockQty > have ? 'font-semibold text-bad' : 'text-ink/55'}`}>
                  {l.unit && item && l.unit !== item.unit ? `= ${qtyText(stockQty)} ${item.unit}` : have !== undefined ? `${qtyText(have)} in store` : ''}
                </span>
                <Button size="sm" variant="ghost" aria-label="Remove line" onClick={() => setLines(lines.filter((_, n) => n !== i))}>
                  ×
                </Button>
              </div>
            )
          })}
          <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { itemName: '', qty: '', unit: '' }])}>
            Add item
          </Button>
        </div>
        <Field label="Note">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Weekend pool service" />}</Field>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

function TransferDetail({ transfer: t, nameOf, canAct, onClose }: { transfer: Transfer; nameOf: (s?: StoreRecord) => string; canAct: boolean; onClose: () => void }) {
  const { data, run, service } = useProcurement()
  const { issueStock, returnStock, recordPurchase } = useRequests()
  const [step, setStep] = useState<'send' | 'receive' | 'cancel' | null>(null)
  const [received, setReceived] = useState(t.lines.map((l) => String(l.qty)))
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const from = data?.stores.find((s) => s.id === t.fromStoreId)
  const to = data?.stores.find((s) => s.id === t.toStoreId)

  async function send() {
    let issueRef: string | undefined
    const home = t.lines.filter((l) => l.fromHome)
    if (home.length) {
      const r = issueStock({
        department: asDepartment(to?.department),
        note: `Transfer ${t.id} to ${nameOf(to)}`,
        lines: home.map((l) => ({ name: l.itemName, qty: l.qty, unitCost: l.unitCost ?? 0 })),
      })
      if (!r.ok) return setError(r.error)
      issueRef = r.value.id
    }
    const e = await run((a) => service.sendTransfer(t.id, issueRef, a))
    setError(e)
    if (!e) setStep(null)
  }

  async function receive() {
    const got = received.map((x) => Number(x))
    if (got.some((g, i) => !(g >= 0) || g > t.lines[i].qty)) return setError('Enter what arrived, no more than was sent.')
    if (got.some((g, i) => g < t.lines[i].qty) && !note.trim()) return setError('Less arrived than was sent. Say what happened.')
    const home = t.lines.map((l, i) => ({ l, qty: got[i] })).filter((x) => x.l.toHome && x.qty > 0)
    if (home.length) {
      const lines = home.map((x) => ({ name: x.l.itemName, qty: x.qty, unitCost: x.l.unitCost ?? 0 }))
      const r = from?.legacyStoreId || from?.level !== 'central'
        ? returnStock({ department: asDepartment(from?.department), note: `Transfer ${t.id} from ${nameOf(from)}`, lines, aboveReason: `Store transfer ${t.id}` })
        : recordPurchase({ supplier: nameOf(from), reference: t.id, note: `Transfer from ${nameOf(from)}`, lines })
      if (!r.ok) return setError(r.error)
    }
    const e = await run((a) => service.receiveTransfer(t.id, got, note, a))
    setError(e)
    if (!e) setStep(null)
  }

  return (
    <Modal side title={t.id.replace(`${t.propertyId}-`, '')} description={`${nameOf(from)} → ${nameOf(to)}`} onClose={onClose}>
      <div className="space-y-4">
        <Badge tone={TRANSFER_STATUS[t.status].tone} dot>{TRANSFER_STATUS[t.status].label}</Badge>
        {error && !step && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>}
        <Card padded={false}>
          <DataTable
            columns={[
              { key: 'i', header: 'Item', cell: (l: TransferLine) => l.itemName },
              { key: 'e', header: 'Sent', cell: (l: TransferLine) => `${qtyText(l.enteredQty)} ${l.enteredUnit}`, align: 'right' },
              { key: 'q', header: 'Stock units', cell: (l: TransferLine) => qtyText(l.qty), align: 'right', hideBelow: 'sm' },
              { key: 'r', header: 'Received', cell: (l: TransferLine) => (l.receivedQty === undefined ? '' : <span className={l.receivedQty < l.qty ? 'font-semibold text-bad' : ''}>{qtyText(l.receivedQty)}</span>), align: 'right' },
            ]}
            rows={t.lines}
            rowKey={(l) => l.itemName}
          />
        </Card>
        <ul className="space-y-1 text-sm text-ink/70">
          <li>Raised by {t.createdBy}, {shortDate(t.createdAt)}{t.note ? ` · ${t.note}` : ''}</li>
          {t.sentBy && <li>Sent by {t.sentBy}, {shortDate(t.sentAt ?? '')}{t.issueRef ? ` · ${t.issueRef}` : ''}</li>}
          {t.receivedBy && <li>Received by {t.receivedBy}, {shortDate(t.receivedAt ?? '')}{t.receiveNote ? ` · ${t.receiveNote}` : ''}</li>}
          {t.cancelReason && <li>Cancelled: {t.cancelReason}</li>}
        </ul>
        {canAct && (
          <div className="flex flex-wrap justify-end gap-2">
            {t.status === 'draft' && <Button variant="ghost" onClick={() => { setNote(''); setError(null); setStep('cancel') }}>Cancel</Button>}
            {t.status === 'draft' && <Button onClick={() => { setError(null); setStep('send') }}>Send</Button>}
            {t.status === 'sent' && <Button onClick={() => { setNote(''); setError(null); setStep('receive') }}>Receive</Button>}
          </div>
        )}
      </div>
      {step === 'send' && (
        <ConfirmDialog
          title="Send this transfer?"
          confirmLabel="Send"
          onCancel={() => setStep(null)}
          onConfirm={send}
          message={
            <div className="space-y-2">
              <p>The stock leaves {nameOf(from)} now and is on its way to {nameOf(to)}.</p>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
      {step === 'receive' && (
        <Modal
          title={`Receive at ${nameOf(to)}`}
          onClose={() => setStep(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setStep(null)}>Cancel</Button>
              <Button onClick={receive}>Confirm received</Button>
            </>
          }
        >
          <div className="space-y-3">
            {t.lines.map((l, i) => (
              <Field key={l.itemName} label={`${l.itemName} · sent ${qtyText(l.qty)}`}>
                {(id) => <Input id={id} type="number" min={0} max={l.qty} value={received[i]} onChange={(e) => setReceived(received.map((x, n) => (n === i ? e.target.value : x)))} />}
              </Field>
            ))}
            <Field label="Note (needed if anything is short)">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            {error && <p className="text-sm font-medium text-bad">{error}</p>}
          </div>
        </Modal>
      )}
      {step === 'cancel' && (
        <ConfirmDialog
          title="Cancel this transfer?"
          danger
          confirmLabel="Cancel transfer"
          onCancel={() => setStep(null)}
          onConfirm={async () => {
            const e = await run((a) => service.cancelTransfer(t.id, note, a))
            setError(e)
            if (!e) setStep(null)
          }}
          message={
            <div className="space-y-2">
              <Field label="Reason" required>{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              {error && <p className="text-sm font-medium text-bad">{error}</p>}
            </div>
          }
        />
      )}
    </Modal>
  )
}
