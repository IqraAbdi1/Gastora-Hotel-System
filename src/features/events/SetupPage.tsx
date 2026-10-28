import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import { ugx } from '../../lib/format'
import { SETUP_LABEL } from '../../services/events/eventsRules'
import type { Equipment, EquipmentCategory, EventPackage, FunctionSpace, PackageKind, SetupStyle, SpaceKind } from '../../services/events/eventsTypes'
import { ErrorNote } from './ErrorNote'
import { EQUIPMENT_LABEL, PACKAGE_KIND_LABEL, SPACE_KIND_LABEL, num } from './eventsUi'
import { useEvents, useRun } from './useEvents'

type Tab = 'spaces' | 'packages' | 'equipment'
const SETUPS = Object.keys(SETUP_LABEL) as SetupStyle[]

export default function SetupPage() {
  const { data, service, actor } = useEvents()
  const [tab, setTab] = useState<Tab>('spaces')
  const [space, setSpace] = useState<FunctionSpace | 'new' | null>(null)
  const [pkg, setPkg] = useState<EventPackage | 'new' | null>(null)
  const [item, setItem] = useState<Equipment | 'new' | null>(null)
  const { error, run } = useRun()
  const maxCap = (id: string) => Math.max(0, ...data.setups.filter((s) => s.spaceId === id).map((s) => s.capacity))

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Events and sales"
        title="Spaces and packages"
        description="Function spaces and their layouts, packages and menus, equipment and staff."
        actions={
          <Button onClick={() => (tab === 'spaces' ? setSpace('new') : tab === 'packages' ? setPkg('new') : setItem('new'))}>
            {tab === 'spaces' ? 'Add space' : tab === 'packages' ? 'Add package' : 'Add item'}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Function spaces" value={String(data.spaces.filter((s) => s.active).length)} icon="occupancy" />
        <StatCard label="Largest room" value={String(Math.max(0, ...data.spaces.filter((s) => s.active).map((s) => maxCap(s.id))))} hint="People" icon="guests" />
        <StatCard label="Packages" value={String(data.packages.filter((p) => p.active).length)} icon="list" />
        <StatCard label="Equipment and staff" value={String(data.equipment.length)} icon="tasks" />
      </div>
      <Tabs
        label="Set-up"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'spaces', label: 'Spaces', count: data.spaces.length },
          { key: 'packages', label: 'Packages', count: data.packages.length },
          { key: 'equipment', label: 'Equipment and staff', count: data.equipment.length },
        ]}
      />
      <ErrorNote error={error} />

      {tab === 'spaces' && (
        <Card padded={false}>
          <DataTable
            rows={data.spaces}
            rowKey={(s) => s.id}
            onRowClick={(s) => setSpace(s)}
            empty={{ title: 'No spaces yet' }}
            columns={[
              { key: 'n', header: 'Space', cell: (s) => <span className="font-medium text-ink">{s.name}</span> },
              { key: 'k', header: 'Kind', cell: (s) => SPACE_KIND_LABEL[s.kind], hideBelow: 'sm' },
              {
                key: 'l',
                header: 'Layouts',
                hideBelow: 'md',
                cell: (s) =>
                  data.setups
                    .filter((x) => x.spaceId === s.id)
                    .map((x) => `${SETUP_LABEL[x.setup]} ${x.capacity}`)
                    .join(' · '),
              },
              { key: 'h', header: 'Half / full day', cell: (s) => `${ugx(s.hireRateHalfDay)} / ${ugx(s.hireRateFullDay)}`, align: 'right', hideBelow: 'lg' },
              {
                key: 'a',
                header: '',
                cell: (s) => (
                  <span className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {!s.active && <Badge tone="neutral">Off</Badge>}
                    <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => run(() => service.setSpaceActive(s.id, !s.active, actor))}>
                      {s.active ? 'Take off sale' : 'Put on sale'}
                    </button>
                  </span>
                ),
              },
            ]}
          />
        </Card>
      )}
      {tab === 'packages' && (
        <Card padded={false}>
          <DataTable
            rows={data.packages}
            rowKey={(p) => p.id}
            onRowClick={(p) => setPkg(p)}
            empty={{ title: 'No packages yet' }}
            columns={[
              { key: 'n', header: 'Package', cell: (p) => <span className="font-medium text-ink">{p.name}</span> },
              { key: 'k', header: 'Kind', cell: (p) => PACKAGE_KIND_LABEL[p.kind], hideBelow: 'sm' },
              { key: 'i', header: 'Includes', cell: (p) => `${data.packageItems.filter((i) => i.packageId === p.id).length} items`, hideBelow: 'md' },
              { key: 'p', header: 'Per head', cell: (p) => ugx(p.pricePerHead), align: 'right' },
              { key: 'm', header: 'Margin', cell: (p) => `${Math.round(((p.pricePerHead - p.costPerHead) / p.pricePerHead) * 100)}%`, align: 'right', hideBelow: 'sm' },
            ]}
          />
        </Card>
      )}
      {tab === 'equipment' && (
        <Card padded={false}>
          <DataTable
            rows={data.equipment}
            rowKey={(e) => e.id}
            onRowClick={(e) => setItem(e)}
            empty={{ title: 'No equipment yet' }}
            columns={[
              { key: 'n', header: 'Item', cell: (e) => <span className="font-medium text-ink">{e.name}</span> },
              { key: 'c', header: 'Kind', cell: (e) => <Badge tone={e.category === 'staff' ? 'info' : 'neutral'}>{EQUIPMENT_LABEL[e.category]}</Badge> },
              { key: 'q', header: 'Have', cell: (e) => e.quantityOwned, align: 'right' },
              { key: 'r', header: 'Per day', cell: (e) => ugx(e.dailyRate), align: 'right', hideBelow: 'sm' },
            ]}
          />
        </Card>
      )}

      {space && <SpaceForm space={space === 'new' ? undefined : space} onClose={() => setSpace(null)} />}
      {pkg && <PackageForm pkg={pkg === 'new' ? undefined : pkg} onClose={() => setPkg(null)} />}
      {item && <EquipmentForm item={item === 'new' ? undefined : item} onClose={() => setItem(null)} />}
    </div>
  )
}

function FormModal({ title, busy, onSave, onClose, children }: { title: string; busy: boolean; onSave: () => void; onClose: () => void; children: ReactNode }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      side
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">{children}</div>
    </Modal>
  )
}

function SpaceForm({ space, onClose }: { space?: FunctionSpace; onClose: () => void }) {
  const { data, service, actor, propertyId } = useEvents()
  const { busy, error, run } = useRun()
  const [name, setName] = useState(space?.name ?? '')
  const [kind, setKind] = useState<SpaceKind>(space?.kind ?? 'hall')
  const [area, setArea] = useState(String(space?.areaSqm ?? ''))
  const [half, setHalf] = useState(String(space?.hireRateHalfDay ?? ''))
  const [full, setFull] = useState(String(space?.hireRateFullDay ?? ''))
  const [caps, setCaps] = useState<Record<SetupStyle, string>>(
    Object.fromEntries(SETUPS.map((s) => [s, String(data.setups.find((x) => x.spaceId === space?.id && x.setup === s)?.capacity ?? '')])) as Record<SetupStyle, string>,
  )
  const save = async () => {
    const ok = await run(() =>
      service.saveSpace(
        propertyId,
        { id: space?.id, name, kind, areaSqm: num(area), hireRateHalfDay: num(half), hireRateFullDay: num(full), setups: SETUPS.map((s) => ({ setup: s, capacity: num(caps[s]) })) },
        actor,
      ),
    )
    if (ok) onClose()
  }
  return (
    <FormModal title={space ? space.name : 'New function space'} busy={busy} onSave={save} onClose={onClose}>
      <Field label="Name" required>
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as SpaceKind)}>
              {(Object.keys(SPACE_KIND_LABEL) as SpaceKind[]).map((k) => (
                <option key={k} value={k}>
                  {SPACE_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Area (m²)">{(id) => <Input id={id} inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value)} />}</Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Half day (UGX)">{(id) => <Input id={id} inputMode="numeric" value={half} onChange={(e) => setHalf(e.target.value)} />}</Field>
        <Field label="Full day (UGX)">{(id) => <Input id={id} inputMode="numeric" value={full} onChange={(e) => setFull(e.target.value)} />}</Field>
      </div>
      <p className="text-sm font-medium text-ink/80">Capacity by layout</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SETUPS.map((s) => (
          <Field key={s} label={SETUP_LABEL[s]}>
            {(id) => <Input id={id} inputMode="numeric" placeholder="—" value={caps[s]} onChange={(e) => setCaps({ ...caps, [s]: e.target.value })} />}
          </Field>
        ))}
      </div>
      <ErrorNote error={error} />
    </FormModal>
  )
}

function PackageForm({ pkg, onClose }: { pkg?: EventPackage; onClose: () => void }) {
  const { data, service, actor, propertyId } = useEvents()
  const { busy, error, run } = useRun()
  const [name, setName] = useState(pkg?.name ?? '')
  const [kind, setKind] = useState<PackageKind>(pkg?.kind ?? 'day-delegate')
  const [price, setPrice] = useState(String(pkg?.pricePerHead ?? ''))
  const [cost, setCost] = useState(String(pkg?.costPerHead ?? ''))
  const [items, setItems] = useState(
    data.packageItems
      .filter((i) => i.packageId === pkg?.id)
      .map((i) => i.description)
      .join('\n'),
  )
  const save = async () => {
    const ok = await run(() => service.savePackage(propertyId, { id: pkg?.id, name, kind, pricePerHead: num(price), costPerHead: num(cost), items: items.split('\n') }, actor))
    if (ok) onClose()
  }
  return (
    <FormModal title={pkg ? pkg.name : 'New package'} busy={busy} onSave={save} onClose={onClose}>
      <Field label="Name" required>
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Kind">
        {(id) => (
          <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as PackageKind)}>
            {(Object.keys(PACKAGE_KIND_LABEL) as PackageKind[]).map((k) => (
              <option key={k} value={k}>
                {PACKAGE_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price per head" required>
          {(id) => <Input id={id} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />}
        </Field>
        <Field label="Cost per head">{(id) => <Input id={id} inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />}</Field>
      </div>
      <Field label="Includes" hint="One item per line">
        {(id) => <Textarea id={id} rows={5} value={items} onChange={(e) => setItems(e.target.value)} />}
      </Field>
      <ErrorNote error={error} />
    </FormModal>
  )
}

function EquipmentForm({ item, onClose }: { item?: Equipment; onClose: () => void }) {
  const { service, actor, propertyId } = useEvents()
  const { busy, error, run } = useRun()
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<EquipmentCategory>(item?.category ?? 'av')
  const [qty, setQty] = useState(String(item?.quantityOwned ?? ''))
  const [rate, setRate] = useState(String(item?.dailyRate ?? ''))
  const [cost, setCost] = useState(String(item?.dailyCost ?? ''))
  const save = async () => {
    const ok = await run(() => service.saveEquipment(propertyId, { id: item?.id, name, category, quantityOwned: num(qty), dailyRate: num(rate), dailyCost: num(cost) }, actor))
    if (ok) onClose()
  }
  return (
    <FormModal title={item ? item.name : 'New equipment or staff'} busy={busy} onSave={save} onClose={onClose}>
      <Field label="Name" required>
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          {(id) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as EquipmentCategory)}>
              {(Object.keys(EQUIPMENT_LABEL) as EquipmentCategory[]).map((k) => (
                <option key={k} value={k}>
                  {EQUIPMENT_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={category === 'staff' ? 'People available' : 'How many'} required>
          {(id) => <Input id={id} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Charge per day">{(id) => <Input id={id} inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} />}</Field>
        <Field label="Cost per day">{(id) => <Input id={id} inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />}</Field>
      </div>
      <ErrorNote error={error} />
    </FormModal>
  )
}
