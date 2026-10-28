import { useState } from 'react'
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Tabs } from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { chargeCategories } from '../../lib/folio'
import { useNow } from '../../lib/useNow'
import { OUTLET_TYPE_LABEL } from '../../services/pos/posTypes'
import type { Combo, ModifierGroup, OutletInput, OutletType, PosOutlet } from '../../services/pos/posTypes'
import { cash } from './posFormat'
import { hhmmOf, hoursLabel, withinHours } from './posRules'
import { BASE_PRODUCTS, EXTRA_PRODUCTS } from './posSeed'
import { POS_STORAGE_KEYS } from './posTypes'
import type { Product } from './posTypes'
import { errorText, usePos } from './usePos'

type Tab = 'outlets' | 'modifiers' | 'combos' | 'stations'
const seed = [...BASE_PRODUCTS, ...EXTRA_PRODUCTS]
const EMOJI: Record<OutletType, string> = { restaurant: '🍽️', bar: '🍸', roomService: '🛎️', minibar: '🧊', poolSpa: '🏊', retail: '🛍️' }

export default function OutletsPage() {
  const pos = usePos()
  const now = useNow()
  const [products] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, seed)
  const [tab, setTab] = useState<Tab>('outlets')
  const [editOutlet, setEditOutlet] = useState<PosOutlet | 'new' | null>(null)
  const [editGroup, setEditGroup] = useState<ModifierGroup | 'new' | null>(null)
  const [editCombo, setEditCombo] = useState<Combo | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const data = pos.data
  if (!data) return <PageHeader title="Outlets and add-ons" />

  const multi = pos.features.posMultiOutlet
  const outlets = multi ? data.outlets : data.outlets.filter((o) => pos.outlets.some((x) => x.id === o.id))
  const outletNames = outlets.map((o) => o.name)
  const sellable = products.filter((p) => outletNames.includes(p.outlet))
  const nowHhmm = hhmmOf(now)
  const canEdit = pos.isManager

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Restaurant & bar POS"
        title="Outlets and add-ons"
        description="Where the hotel sells, and the choices and deals on its menus."
        actions={canEdit && tab === 'outlets' && multi ? <Button onClick={() => setEditOutlet('new')}>Add outlet</Button>
          : canEdit && tab === 'modifiers' ? <Button onClick={() => setEditGroup('new')}>Add option group</Button>
            : canEdit && tab === 'combos' ? <Button onClick={() => setEditCombo('new')}>Add combo</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outlets" value={outlets.filter((o) => o.active).length} icon="list" />
        <StatCard label="Open now" value={outlets.filter((o) => o.active && withinHours(o, nowHhmm)).length} icon="check" tone="good" />
        <StatCard label="Option groups" value={data.modifierGroups.length} icon="tasks" />
        <StatCard label="Combos" value={data.combos.filter((c) => outlets.some((o) => o.id === c.outletId)).length} icon="sparkles" />
      </div>

      {notice && (
        <div role="status" className="flex justify-between gap-3 rounded-lg border border-brand/20 bg-white px-4 py-3 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="font-bold">×</button>
        </div>
      )}

      <Tabs label="Set-up" value={tab} onChange={setTab} tabs={[
        { key: 'outlets', label: 'Outlets', count: outlets.length },
        { key: 'modifiers', label: 'Options', count: data.modifierGroups.length },
        { key: 'combos', label: 'Combos' },
        { key: 'stations', label: 'Kitchen stations', count: data.stations.length },
      ]} />

      {tab === 'outlets' && (
        <Card padded={false}>
          <DataTable<PosOutlet>
            rows={outlets}
            rowKey={(o) => o.id}
            onRowClick={canEdit ? (o) => setEditOutlet(o) : undefined}
            columns={[
              { key: 'name', header: 'Outlet', cell: (o) => <span className="font-semibold">{o.emoji} {o.name}<span className="block text-xs font-normal text-ink/50">{OUTLET_TYPE_LABEL[o.type]}</span></span> },
              { key: 'hours', header: 'Hours', cell: (o) => <span>{hoursLabel(o)} {o.active && <Badge tone={withinHours(o, nowHhmm) ? 'good' : 'neutral'}>{withinHours(o, nowHhmm) ? 'Open' : 'Closed'}</Badge>}</span> },
              { key: 'menu', header: 'Menu items', cell: (o) => products.filter((p) => p.outlet === o.name).length, hideBelow: 'sm' },
              { key: 'svc', header: 'Service', cell: (o) => `${o.serviceChargePercent}%`, hideBelow: 'md' },
              { key: 'tips', header: 'Tips', cell: (o) => (o.tipsEnabled ? 'Yes' : 'No'), hideBelow: 'lg' },
              { key: 'disc', header: 'Discount limit', cell: (o) => `${o.discountApprovalPercent}%`, hideBelow: 'lg' },
              { key: 'folio', header: 'Folio', cell: (o) => o.folioCategory, hideBelow: 'md' },
              { key: 'status', header: 'Status', cell: (o) => <Badge tone={o.active ? 'good' : 'neutral'}>{o.active ? 'Active' : 'Off'}</Badge> },
            ]}
          />
        </Card>
      )}

      {tab === 'modifiers' && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.modifierGroups.length === 0 && <Card><p className="text-sm text-ink/60">No option groups yet.</p></Card>}
          {data.modifierGroups.map((g) => (
            <Card key={g.id} title={g.name} actions={<>
              <Badge tone={g.required ? 'warn' : 'neutral'}>{g.required ? `Pick ${g.minSelect}` : 'Optional'}{g.maxSelect > 1 ? `, up to ${g.maxSelect}` : ''}</Badge>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditGroup(g)}>Edit</Button>}
            </>}>
              <div className="flex flex-wrap gap-1.5">
                {g.modifiers.map((m) => <Badge key={m.id}>{m.name}{m.price ? ` +${cash(m.price)}` : ''}</Badge>)}
              </div>
              <p className="mt-3 text-xs text-ink/55">On {g.productIds.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || 'no items'}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'combos' && (
        <Card padded={false}>
          <DataTable<Combo>
            rows={data.combos.filter((c) => outlets.some((o) => o.id === c.outletId))}
            rowKey={(c) => c.id}
            empty={{ title: 'No combos yet' }}
            onRowClick={canEdit ? (c) => setEditCombo(c) : undefined}
            columns={[
              { key: 'name', header: 'Combo', cell: (c) => <span className="font-semibold">{c.emoji} {c.name}</span> },
              { key: 'outlet', header: 'Outlet', cell: (c) => data.outlets.find((o) => o.id === c.outletId)?.name ?? '—', hideBelow: 'sm' },
              { key: 'items', header: 'Items', cell: (c) => c.items.map((i) => `${i.qty}× ${products.find((p) => p.id === i.productId)?.name ?? '?'}`).join(', '), hideBelow: 'md' },
              { key: 'save', header: 'Saving', cell: (c) => cash(c.items.reduce((s, i) => s + (products.find((p) => p.id === i.productId)?.price ?? 0) * i.qty, 0) - c.price), hideBelow: 'lg' },
              { key: 'price', header: 'Price', align: 'right', cell: (c) => <span className="font-semibold">{cash(c.price)}</span> },
            ]}
          />
        </Card>
      )}

      {tab === 'stations' && (
        <Card padded={false}>
          <DataTable
            rows={data.stations}
            rowKey={(s) => s.id}
            columns={[
              { key: 'name', header: 'Station', cell: (s) => <span className="font-semibold">{s.name}</span> },
              { key: 'cats', header: 'Prepares', cell: (s) => s.categories.join(', '), className: 'whitespace-normal' },
              { key: 'target', header: 'Target', align: 'right', cell: (s) => `${s.targetMinutes} min` },
            ]}
          />
        </Card>
      )}

      {editOutlet && (
        <OutletDialog
          outlet={editOutlet === 'new' ? null : editOutlet}
          onClose={() => setEditOutlet(null)}
          onSave={(input) => pos.service.saveOutlet(pos.pid, input, pos.actor, editOutlet === 'new' ? undefined : editOutlet.id).then((o) => { setEditOutlet(null); setNotice(`${o.name} saved.`) })}
        />
      )}
      {editGroup && (
        <GroupDialog
          group={editGroup === 'new' ? null : editGroup}
          products={sellable}
          onClose={() => setEditGroup(null)}
          onRemove={editGroup !== 'new' ? () => pos.service.removeModifierGroup(pos.pid, editGroup.id, pos.actor).then(() => { setEditGroup(null); setNotice('Option group removed.') }) : undefined}
          onSave={(input) => pos.service.saveModifierGroup(pos.pid, input, pos.actor, editGroup === 'new' ? undefined : editGroup.id).then(() => { setEditGroup(null); setNotice(`${input.name} saved.`) })}
        />
      )}
      {editCombo && (
        <ComboDialog
          combo={editCombo === 'new' ? null : editCombo}
          outlets={outlets}
          products={sellable}
          onClose={() => setEditCombo(null)}
          onRemove={editCombo !== 'new' ? () => pos.service.removeCombo(pos.pid, editCombo.id, pos.actor).then(() => { setEditCombo(null); setNotice('Combo removed.') }) : undefined}
          onSave={(input) => pos.service.saveCombo(pos.pid, input, pos.actor, editCombo === 'new' ? undefined : editCombo.id).then(() => { setEditCombo(null); setNotice(`${input.name} saved.`) })}
        />
      )}
    </div>
  )
}

function OutletDialog({ outlet, onSave, onClose }: { outlet: PosOutlet | null; onSave: (input: OutletInput) => Promise<unknown>; onClose: () => void }) {
  const [form, setForm] = useState<OutletInput>(() => outlet ?? {
    name: '', type: 'poolSpa', emoji: EMOJI.poolSpa, opensAt: '08:00', closesAt: '20:00', serviceChargePercent: 5, tipsEnabled: true,
    discountApprovalPercent: 15, folioCategory: 'Restaurant', hasTables: false, active: true,
  })
  const [error, setError] = useState('')
  const set = (patch: Partial<OutletInput>) => { setForm((f) => ({ ...f, ...patch })); setError('') }
  return (
    <Modal title={outlet ? outlet.name : 'New outlet'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(form).catch((e: unknown) => setError(errorText(e)))}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required hint={outlet ? 'Fixed once created.' : undefined}>{(id) => <Input id={id} value={form.name} disabled={Boolean(outlet)} onChange={(e) => set({ name: e.target.value })} placeholder="Pool bar" />}</Field>
        <Field label="Type">{(id) => <Select id={id} value={form.type} onChange={(e) => { const type = e.target.value as OutletType; set({ type, emoji: EMOJI[type], hasTables: type === 'restaurant' || type === 'bar' || type === 'poolSpa' }) }}>{(Object.keys(OUTLET_TYPE_LABEL) as OutletType[]).map((t) => <option key={t} value={t}>{OUTLET_TYPE_LABEL[t]}</option>)}</Select>}</Field>
        <Field label="Opens">{(id) => <Input id={id} type="time" value={form.opensAt} onChange={(e) => set({ opensAt: e.target.value })} />}</Field>
        <Field label="Closes" hint="Same as opening means 24 hours.">{(id) => <Input id={id} type="time" value={form.closesAt} onChange={(e) => set({ closesAt: e.target.value })} />}</Field>
        <Field label="Service charge %">{(id) => <Input id={id} type="number" min={0} max={25} value={form.serviceChargePercent} onChange={(e) => set({ serviceChargePercent: Number(e.target.value) })} />}</Field>
        <Field label="Discount without approval up to %">{(id) => <Input id={id} type="number" min={0} max={100} value={form.discountApprovalPercent} onChange={(e) => set({ discountApprovalPercent: Number(e.target.value) })} />}</Field>
        <Field label="Folio category for room charges">{(id) => <Select id={id} value={form.folioCategory} onChange={(e) => set({ folioCategory: e.target.value })}>{chargeCategories.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
        <div className="space-y-2 pt-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.tipsEnabled} onChange={(e) => set({ tipsEnabled: e.target.checked })} /> Takes tips</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.hasTables} onChange={(e) => set({ hasTables: e.target.checked })} /> Seats guests at tables</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
    </Modal>
  )
}

function GroupDialog({
  group, products, onSave, onRemove, onClose,
}: {
  group: ModifierGroup | null
  products: Product[]
  onSave: (input: Omit<ModifierGroup, 'id' | 'propertyId' | 'modifiers'> & { modifiers: { name: string; price: number }[] }) => Promise<unknown>
  onRemove?: () => Promise<unknown>
  onClose: () => void
}) {
  const [name, setName] = useState(group?.name ?? '')
  const [required, setRequired] = useState(group?.required ?? false)
  const [minSelect, setMin] = useState(group?.minSelect ?? 1)
  const [maxSelect, setMax] = useState(group?.maxSelect ?? 1)
  const [productIds, setProductIds] = useState<string[]>(group?.productIds ?? [])
  const [mods, setMods] = useState(group?.modifiers.map((m) => ({ name: m.name, price: m.price })) ?? [{ name: '', price: 0 }])
  const [error, setError] = useState('')
  const fail = (e: unknown) => setError(errorText(e))
  return (
    <Modal
      title={group ? group.name : 'New option group'}
      wide
      onClose={onClose}
      footer={<>
        {onRemove && <Button variant="danger" onClick={() => onRemove().catch(fail)}>Remove</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ name, required, minSelect: required ? minSelect : 0, maxSelect, productIds, modifiers: mods }).catch(fail)}>Save</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2"><Field label="Name" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Side" />}</Field></div>
          <Field label="Fewest">{(id) => <Input id={id} type="number" min={0} disabled={!required} value={required ? minSelect : 0} onChange={(e) => setMin(Number(e.target.value))} />}</Field>
          <Field label="Most">{(id) => <Input id={id} type="number" min={1} value={maxSelect} onChange={(e) => setMax(Number(e.target.value))} />}</Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required before the item can be added</label>
        <div>
          <p className="text-sm font-medium text-ink/80">Choices</p>
          <div className="mt-2 space-y-2">
            {mods.map((m, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2">
                <Input aria-label="Choice" value={m.name} onChange={(e) => setMods((old) => old.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Choice" />
                <Input aria-label="Add-on price" type="number" min={0} value={m.price} onChange={(e) => setMods((old) => old.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
                <Button variant="ghost" onClick={() => setMods((old) => old.filter((_, j) => j !== i))}>×</Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setMods((old) => [...old, { name: '', price: 0 }])}>+ Choice</Button>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-ink/80">Offered on</p>
          <div className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={productIds.includes(p.id)} onChange={(e) => setProductIds((old) => (e.target.checked ? [...old, p.id] : old.filter((x) => x !== p.id)))} />
                {p.emoji} {p.name} <span className="text-xs text-ink/45">{p.outlet}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}

function ComboDialog({
  combo, outlets, products, onSave, onRemove, onClose,
}: {
  combo: Combo | null
  outlets: PosOutlet[]
  products: Product[]
  onSave: (input: Omit<Combo, 'id' | 'propertyId' | 'items'> & { items: { productId: string; qty: number }[] }) => Promise<unknown>
  onRemove?: () => Promise<unknown>
  onClose: () => void
}) {
  const [outletId, setOutletId] = useState(combo?.outletId ?? outlets[0]?.id ?? '')
  const [name, setName] = useState(combo?.name ?? '')
  const [emoji, setEmoji] = useState(combo?.emoji ?? '🍱')
  const [price, setPrice] = useState(String(combo?.price ?? ''))
  const [items, setItems] = useState(combo?.items.map((i) => ({ productId: i.productId, qty: i.qty })) ?? [{ productId: '', qty: 1 }, { productId: '', qty: 1 }])
  const [error, setError] = useState('')
  const outletName = outlets.find((o) => o.id === outletId)?.name
  const own = products.filter((p) => p.outlet === outletName)
  const list = items.reduce((s, i) => s + (products.find((p) => p.id === i.productId)?.price ?? 0) * i.qty, 0)
  const fail = (e: unknown) => setError(errorText(e))
  return (
    <Modal
      title={combo ? combo.name : 'New combo'}
      onClose={onClose}
      footer={<>
        {onRemove && <Button variant="danger" onClick={() => onRemove().catch(fail)}>Remove</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ outletId, name, emoji, price: Number(price), active: true, items }).catch(fail)}>Save</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_80px]">
          <Field label="Name" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lunch deal" />}</Field>
          <Field label="Icon">{(id) => <Input id={id} value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />}</Field>
          <Field label="Outlet">{(id) => <Select id={id} value={outletId} onChange={(e) => setOutletId(e.target.value)}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_70px_auto] gap-2">
              <Select aria-label="Item" value={it.productId} onChange={(e) => setItems((old) => old.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}>
                <option value="">Item…</option>
                {own.map((p) => <option key={p.id} value={p.id}>{p.name} · {cash(p.price)}</option>)}
              </Select>
              <Input aria-label="Quantity" type="number" min={1} value={it.qty} onChange={(e) => setItems((old) => old.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} />
              <Button variant="ghost" onClick={() => setItems((old) => old.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setItems((old) => [...old, { productId: '', qty: 1 }])}>+ Item</Button>
        </div>
        <Field label="Combo price (UGX)" required hint={list ? `Items alone ${cash(list)}` : undefined}>{(id) => <Input id={id} type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
        {error && <p className="text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
