import { useMemo, useState } from 'react'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatCard, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { nightlyRate } from '../../lib/rates'
import {
  BILLING_LABEL,
  BILLING_NOTE,
  COVERABLE,
  STATUS_LABEL,
  STATUS_TONE,
  blockCounts,
  defaultCovers,
  hasMaster,
  roomsHeld,
} from '../../lib/groups'
import type { GroupBilling, GroupBlock, GroupRooms } from '../../lib/groups'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { useFeatures } from '../platform/featuresContext'
import { useGroups } from './groupsContext'
import GroupPanel from './GroupPanel'
import type { Room } from '../../types'

const types: Room['type'][] = ['Standard', 'Deluxe', 'Suite']
const billings: GroupBilling[] = ['master-all', 'master-room', 'each-guest', 'agent-net']

// Every block the hotel is holding. A workshop, a wedding, a tour operator's rooms: the same list,
// because to the rack they are all rooms out of inventory.
export default function GroupsPage() {
  const { blocks } = useGroups()
  const { reservations } = useHotel()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const open = blocks.find((b) => b.id === openId)
  const live = blocks.filter((b) => b.status !== 'closed' && b.status !== 'cancelled')
  const roomsOut = live.reduce((sum, b) => sum + blockCounts(reservations, b.id).held, 0)
  const toName = live.reduce((sum, b) => {
    const c = blockCounts(reservations, b.id)
    return sum + (c.held - c.named - c.released)
  }, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Groups"
        description="Blocks of rooms held under one name: workshops, weddings, and rooms sold through an agent."
        actions={<Button onClick={() => setAdding(true)}>Hold rooms for a group</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Groups" value={String(live.length)} hint="Held or in house" />
        <StatCard label="Rooms held" value={String(roomsOut)} hint="Out of inventory" tone={roomsOut > 0 ? 'warn' : 'default'} />
        <StatCard label="Still without a name" value={String(toName)} hint="Names can come on the day" />
      </div>

      <Card title="Blocks" icon="bed" count={blocks.length} padded>
        {blocks.length === 0 ? (
          <p className="text-sm text-ink/60">
            No group is holding rooms. A ministry workshop, a wedding party or a tour operator's block all start here.
          </p>
        ) : (
          <ul className="space-y-3">
            {blocks.map((b) => {
              const c = blockCounts(reservations, b.id)
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(b.id)}
                    className="w-full rounded-xl border border-ink/10 p-3 text-left hover:border-brand"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{b.name}</span>
                          <Badge tone={STATUS_TONE[b.status]} dot>
                            {STATUS_LABEL[b.status]}
                          </Badge>
                          <span className="rounded bg-ink/8 px-1.5 py-0.5 font-mono text-[11px] text-ink/70">{b.code}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink/65">
                          {roomsHeld(b)} room(s) · {dayMonth(b.arrival)} to {dayMonth(b.departure)} · {BILLING_LABEL[b.billing]}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/55">
                          {c.named} of {c.held} named · {c.arrived} arrived · {c.left} left
                          {b.cutOff ? ` · names due by ${dayMonth(b.cutOff)}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-brand">Open</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {adding && <NewGroupDialog onClose={() => setAdding(false)} />}
      {open && <GroupPanel block={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function NewGroupDialog({ onClose }: { onClose: () => void }) {
  const { create } = useGroups()
  const { accounts } = useCorporate()
  const { options } = useFeatures()
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [billing, setBilling] = useState<GroupBilling>('master-room')
  const [accountId, setAccountId] = useState('')
  const [organiser, setOrganiser] = useState('')
  const [phone, setPhone] = useState('')
  const [arrival, setArrival] = useState(TODAY)
  const [departure, setDeparture] = useState(TODAY)
  const [cutOff, setCutOff] = useState('')
  const [counts, setCounts] = useState<Record<Room['type'], number>>({ Standard: 0, Deluxe: 0, Suite: 0 })
  const [rates, setRates] = useState<Record<Room['type'], string>>({ Standard: '', Deluxe: '', Suite: '' })
  const [net, setNet] = useState<Record<Room['type'], string>>({ Standard: '', Deluxe: '', Suite: '' })
  const [covers, setCovers] = useState<string[]>(defaultCovers('master-room'))
  const [note, setNote] = useState('')

  const nights = Math.max(1, nightsBetween(arrival, departure))
  const total = useMemo(
    () =>
      types.reduce((sum, t) => {
        const rate = Number(rates[t].replace(/\D/g, '')) || nightlyRate(t, 0, options.rates)
        return sum + rate * counts[t] * nights
      }, 0),
    [counts, nights, options.rates, rates],
  )

  const rooms: GroupRooms[] = types.filter((t) => counts[t] > 0).map((t) => ({ type: t, count: counts[t] }))
  const ok = name.trim().length >= 3 && organiser.trim() !== '' && rooms.length > 0 && departure > arrival

  function pickBilling(next: GroupBilling) {
    setBilling(next)
    setCovers(defaultCovers(next))
  }

  return (
    <Modal
      title="Hold rooms for a group"
      description="The rooms come out of inventory straight away. Names can be added now or on the day."
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink/70">
            {rooms.reduce((s, r) => s + r.count, 0)} room(s) · {nights} night(s) · {ugx(total)}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!ok}
              onClick={() => {
                const num = (v: string) => (v.replace(/\D/g, '') === '' ? undefined : Number(v.replace(/\D/g, '')))
                create(
                  {
                    name: name.trim(),
                    billing,
                    accountId: hasMaster(billing) && billing !== 'agent-net' ? accountId || undefined : undefined,
                    agentId: billing === 'agent-net' ? accountId || undefined : undefined,
                    organiser: { name: organiser.trim(), phone: phone.trim() },
                    arrival,
                    departure,
                    rooms,
                    rates: Object.fromEntries(types.map((t) => [t, num(rates[t])]).filter(([, v]) => v !== undefined)),
                    net: Object.fromEntries(types.map((t) => [t, num(net[t])]).filter(([, v]) => v !== undefined)),
                    covers,
                    cutOff: cutOff || undefined,
                    note: note.trim() || undefined,
                  },
                  user?.name ?? 'Front desk',
                )
                onClose()
              }}
            >
              Hold the rooms
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Group name" required hint="What the desk will call it">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ministry of Health workshop" />}
        </Field>
        <Field label="Organiser" required>{(id) => <Input id={id} value={organiser} onChange={(e) => setOrganiser(e.target.value)} />}</Field>
        <Field label="Organiser phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
        <Field label="Arrival">{(id) => <Input id={id} type="date" value={arrival} onChange={(e) => setArrival(e.target.value)} />}</Field>
        <Field label="Departure">{(id) => <Input id={id} type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />}</Field>
        <Field label="Names due by" hint="Rooms with no name go back on sale after this">
          {(id) => <Input id={id} type="date" value={cutOff} onChange={(e) => setCutOff(e.target.value)} />}
        </Field>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium text-ink/80">Who pays</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {billings.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => pickBilling(b)}
              className={`rounded-xl border p-3 text-left text-sm ${billing === b ? 'border-brand bg-brand/[0.06]' : 'border-ink/10 hover:border-brand/40'}`}
            >
              <span className="font-semibold text-ink">{BILLING_LABEL[b]}</span>
              <span className="mt-0.5 block text-xs text-ink/60">{BILLING_NOTE[b]}</span>
            </button>
          ))}
        </div>
      </div>

      {hasMaster(billing) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={billing === 'agent-net' ? 'Agent account' : 'Company account'} hint="Who the invoice goes to">
            {(id) => (
              <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Not set yet</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium text-ink/80">Rooms and the group's rate</p>
        <div className="space-y-2">
          {types.map((t) => (
            <div key={t} className="grid grid-cols-[1fr_5rem_1fr] items-center gap-2 sm:grid-cols-[1fr_6rem_1fr_1fr]">
              <span className="text-sm text-ink/75">
                {t} <span className="text-xs text-ink/50">({ugx(nightlyRate(t, 0, options.rates))})</span>
              </span>
              <Input
                type="number"
                min={0}
                aria-label={`${t} rooms`}
                value={counts[t]}
                onChange={(e) => setCounts((c) => ({ ...c, [t]: Math.max(0, Number(e.target.value) || 0) }))}
              />
              <Input
                aria-label={`${t} group rate`}
                placeholder="Group rate"
                value={rates[t]}
                onChange={(e) => setRates((r) => ({ ...r, [t]: e.target.value }))}
              />
              {billing === 'agent-net' && (
                <Input
                  aria-label={`${t} net rate`}
                  placeholder="Net to hotel"
                  value={net[t]}
                  onChange={(e) => setNet((r) => ({ ...r, [t]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        {billing === 'agent-net' && (
          <p className="mt-1 text-xs text-ink/55">
            The net rate is what the hotel receives. It is staff-only and never appears on anything the guest is given.
          </p>
        )}
      </div>

      {hasMaster(billing) && (
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-ink/80">What the organiser's bill covers</p>
          <div className="flex flex-wrap gap-2">
            {COVERABLE.map((cat) => {
              const on = covers.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCovers((list) => (on ? list.filter((x) => x !== cat) : [...list, cat]))}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${on ? 'bg-brand/10 text-brand ring-brand/30' : 'bg-ink/5 text-ink/60 ring-ink/10'}`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-xs text-ink/55">Everything not ticked follows the guest and is settled at the desk when they leave.</p>
        </div>
      )}

      <div className="mt-4">
        <Field label="Anything the desk should know">
          {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Conference hall from 08:00, tea at 10:30" />}
        </Field>
      </div>
    </Modal>
  )
}

export type { GroupBlock }
