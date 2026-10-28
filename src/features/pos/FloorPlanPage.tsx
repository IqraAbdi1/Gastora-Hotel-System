import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TODAY } from '../../data/sample'
import { Badge, Button, Card, Chip, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useHotel } from '../../lib/hotelContext'
import { useNow } from '../../lib/useNow'
import type { PosTable, TableBooking, TableShape, TableStatus } from '../../services/pos/posTypes'
import { cash } from './posFormat'
import { hoursLabel, lineGross, minutesOf, TABLE_STATUS_LABEL, tableStatusOf } from './posRules'
import { BASE_PRODUCTS, EXTRA_PRODUCTS } from './posSeed'
import { POS_STORAGE_KEYS } from './posTypes'
import type { HeldOrder, Product } from './posTypes'
import { errorText, usePos } from './usePos'

const STATUS_STYLE: Record<TableStatus, { box: string; tone: Tone }> = {
  free: { box: 'border-good/40 bg-good/5', tone: 'good' },
  seated: { box: 'border-info/50 bg-info/10', tone: 'info' },
  ordered: { box: 'border-brand/50 bg-brand/10', tone: 'brand' },
  billAsked: { box: 'border-warn/60 bg-warn/15', tone: 'warn' },
  cleaning: { box: 'border-bad/40 bg-bad/10', tone: 'bad' },
}
const SHAPE: Record<TableShape, string> = { round: 'rounded-full h-[72px] w-[72px]', square: 'rounded-xl h-[72px] w-[72px]', long: 'rounded-xl h-[72px] w-[116px]' }
const seed = [...BASE_PRODUCTS, ...EXTRA_PRODUCTS]

type Tab = 'floor' | 'bookings'

export default function FloorPlanPage() {
  const navigate = useNavigate()
  const pos = usePos()
  const hotel = useHotel()
  const now = useNow()
  const [heldOrders, setHeldOrders] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, [])
  const [products] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, seed)
  const seated = pos.outlets.filter((o) => o.hasTables)
  const [outletId, setOutletId] = useState('')
  const outlet = seated.find((o) => o.id === outletId) ?? seated[0]
  const [tab, setTab] = useState<Tab>('floor')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [adding, setAdding] = useState(false)
  const [booking, setBooking] = useState(false)
  const [date, setDate] = useState(TODAY)

  const tables = (pos.data?.tables ?? []).filter((t) => t.outletId === outlet?.id)
  const areas = (pos.data?.areas ?? []).filter((a) => a.outletId === outlet?.id)
  const bookings = (pos.data?.bookings ?? []).filter((b) => b.outletId === outlet?.id)
  const todays = bookings.filter((b) => b.date === TODAY && b.status === 'booked')
  const statusOf = (t: PosTable) => tableStatusOf(t, heldOrders, outlet?.name ?? '')
  const orderOf = (t: PosTable) => heldOrders.find((o) => o.outlet === outlet?.name && o.orderType === 'Dine-in' && o.table === t.name)
  const orderTotal = (o: HeldOrder) => o.items.reduce((s, l) => {
    const p = products.find((x) => x.id === l.productId)
    return p ? s + lineGross(l, p) : s
  }, 0)
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes()
  const nextBooking = (t: PosTable) => todays.filter((b) => b.tableId === t.id && minutesOf(b.time) >= nowMin - 30).sort((a, b) => a.time.localeCompare(b.time))[0]
  const selected = tables.find((t) => t.id === selectedId)

  const act = (p: Promise<unknown>, done?: string) =>
    p.then(() => { if (done) setNotice(done) }).catch((e: unknown) => setNotice(errorText(e)))

  /** Orders follow their guests when a table is moved or joined to another. */
  function moveOrders(fromName: string, toName: string) {
    setHeldOrders((old) => old.map((o) => (o.outlet === outlet?.name && o.orderType === 'Dine-in' && o.table === fromName ? { ...o, table: toName, updatedAt: new Date().toISOString() } : o)))
  }

  function openOrder(t: PosTable) {
    const held = orderOf(t)
    if (held) {
      setHeldOrders((old) => old.filter((o) => o.id !== held.id))
      navigate('/pos', { state: { resume: held } })
      return
    }
    navigate('/pos', { state: { outlet: outlet?.name, table: t.name, covers: t.covers } })
  }

  if (!pos.data) return <PageHeader title="Floor plan" />
  if (!outlet) return (
    <div className="space-y-5">
      <PageHeader title="Floor plan" />
      <Card><p className="text-sm text-ink/60">No outlet seats guests at tables.</p></Card>
    </div>
  )

  const counts = tables.reduce<Record<string, number>>((acc, t) => {
    if (t.mergedInto) return acc
    const s = statusOf(t)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const covers = tables.reduce((s, t) => s + (t.status !== 'free' && t.status !== 'cleaning' && !t.mergedInto ? t.covers ?? 0 : 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Restaurant & bar POS"
        title="Floor plan"
        description={`${outlet.name} · ${hoursLabel(outlet)}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setAdding(true)}>Add table</Button>
            <Button onClick={() => setBooking(true)}>New booking</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Free tables" value={counts.free ?? 0} icon="check" tone="good" />
        <StatCard label="Covers seated" value={covers} icon="guests" />
        <StatCard label="Bills asked" value={counts.billAsked ?? 0} icon="money" tone={counts.billAsked ? 'warn' : 'default'} />
        <StatCard label="Bookings today" value={todays.length} icon="calendar" />
      </div>

      {notice && (
        <div role="status" className="flex justify-between gap-3 rounded-lg border border-brand/20 bg-white px-4 py-3 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss" className="font-bold">×</button>
        </div>
      )}

      {seated.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {seated.map((o) => <Chip key={o.id} active={o.id === outlet.id} onClick={() => { setOutletId(o.id); setSelectedId(null) }}>{o.emoji} {o.name}</Chip>)}
        </div>
      )}

      <Tabs label="Floor plan view" value={tab} onChange={setTab} tabs={[{ key: 'floor', label: 'Floor' }, { key: 'bookings', label: 'Bookings', count: todays.length }]} />

      {tab === 'floor' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_STYLE) as TableStatus[]).map((s) => <Badge key={s} tone={STATUS_STYLE[s].tone} dot>{TABLE_STATUS_LABEL[s]} {counts[s] ?? 0}</Badge>)}
          </div>
          {areas.map((area) => {
            const inArea = tables.filter((t) => t.areaId === area.id)
            return (
              <Card key={area.id} title={area.name} count={inArea.length} padded={false}>
                <div className="overflow-x-auto">
                  <div style={{ height: Math.max(...inArea.map((t) => t.y), 0) >= 50 ? 300 : 170 }} className="relative min-w-[600px] bg-[radial-gradient(circle,rgba(17,48,44,0.08)_1px,transparent_1px)] [background-size:20px_20px]">
                    {inArea.map((t) => {
                      const status = statusOf(t)
                      const order = orderOf(t)
                      const next = nextBooking(t)
                      const joinedTo = t.mergedInto ? tables.find((x) => x.id === t.mergedInto) : undefined
                      const joined = tables.filter((x) => x.mergedInto === t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          style={{ left: `${t.x}%`, top: `${t.y}%` }}
                          className={`absolute flex -translate-x-1/2 flex-col items-center justify-center border-2 text-center shadow-sm transition hover:scale-105 ${SHAPE[t.shape]} ${joinedTo ? 'border-dashed border-ink/30 bg-canvas' : STATUS_STYLE[status].box} ${selectedId === t.id ? 'ring-2 ring-brand ring-offset-2' : ''}`}
                          aria-label={`${t.name}, ${joinedTo ? `joined to ${joinedTo.name}` : TABLE_STATUS_LABEL[status]}`}
                        >
                          <span className="text-sm font-bold leading-none">{t.name}</span>
                          <span className="mt-0.5 text-[10px] text-ink/60">{joinedTo ? `with ${joinedTo.name}` : t.covers && status !== 'free' && status !== 'cleaning' ? `${t.covers}/${t.seats + joined.reduce((s, x) => s + x.seats, 0)}` : `${t.seats} seats`}</span>
                          {order && <span className="text-[10px] font-semibold text-brand">{cash(orderTotal(order)).replace('UGX ', '')}</span>}
                          {!order && next && status === 'free' && <span className="text-[10px] font-semibold text-info">{next.time}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'bookings' && (
        <Card
          title="Table bookings"
          padded={false}
          actions={<Input type="date" value={date} min={TODAY} onChange={(e) => setDate(e.target.value || TODAY)} aria-label="Booking date" className="w-40" />}
        >
          <DataTable<TableBooking>
            rows={bookings.filter((b) => b.date === date).sort((a, b) => a.time.localeCompare(b.time))}
            rowKey={(b) => b.id}
            empty={{ title: 'No bookings for this day' }}
            columns={[
              { key: 'time', header: 'Time', cell: (b) => <span className="font-semibold">{b.time}</span> },
              { key: 'guest', header: 'Guest', cell: (b) => <span>{b.guestName}{b.notes ? <span className="block text-xs text-ink/50">{b.notes}</span> : null}</span> },
              { key: 'covers', header: 'Covers', cell: (b) => b.covers },
              { key: 'table', header: 'Table', cell: (b) => tables.find((t) => t.id === b.tableId)?.name ?? '—' },
              { key: 'phone', header: 'Phone', cell: (b) => b.phone ?? '—', hideBelow: 'lg' },
              { key: 'status', header: 'Status', cell: (b) => <Badge tone={b.status === 'booked' ? 'info' : b.status === 'seated' ? 'good' : 'neutral'}>{b.status === 'noShow' ? 'No-show' : b.status[0].toUpperCase() + b.status.slice(1)}</Badge> },
              {
                key: 'act', header: '', align: 'right', cell: (b) => b.status === 'booked' ? (
                  <span className="flex justify-end gap-1">
                    <Button size="sm" onClick={() => act(pos.service.setBookingStatus(pos.pid, b.id, 'seated', pos.actor), `${b.guestName} seated.`)}>Seat</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(pos.service.setBookingStatus(pos.pid, b.id, 'noShow', pos.actor), `${b.guestName} marked no-show.`)}>No-show</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(pos.service.setBookingStatus(pos.pid, b.id, 'cancelled', pos.actor), `Booking for ${b.guestName} cancelled.`)}>Cancel</Button>
                  </span>
                ) : null,
              },
            ]}
          />
        </Card>
      )}

      {selected && (
        <TablePanel
          table={selected}
          status={statusOf(selected)}
          order={orderOf(selected)}
          orderTotal={orderOf(selected) ? orderTotal(orderOf(selected) as HeldOrder) : 0}
          tables={tables}
          statusOf={statusOf}
          bookings={todays.filter((b) => b.tableId === selected.id)}
          now={now}
          onClose={() => setSelectedId(null)}
          onOpenOrder={() => openOrder(selected)}
          onSeat={(n) => act(pos.service.setTableStatus(pos.pid, selected.id, 'seated', pos.actor, n), `${n} seated at ${selected.name}.`)}
          onStatus={(s, msg) => act(pos.service.setTableStatus(pos.pid, selected.id, s, pos.actor), msg)}
          onMove={(toId) => {
            const to = tables.find((t) => t.id === toId)
            if (!to) return
            void pos.service.moveTable(pos.pid, selected.id, toId, pos.actor).then(() => {
              moveOrders(selected.name, to.name)
              setSelectedId(toId)
              setNotice(`Guests moved from ${selected.name} to ${to.name}.`)
            }).catch((e: unknown) => setNotice(errorText(e)))
          }}
          onMerge={(otherId) => {
            const other = tables.find((t) => t.id === otherId)
            if (!other) return
            void pos.service.mergeTables(pos.pid, selected.id, otherId, pos.actor).then(() => {
              moveOrders(other.name, selected.name)
              setNotice(`${other.name} joined to ${selected.name}.`)
            }).catch((e: unknown) => setNotice(errorText(e)))
          }}
          onUnmerge={() => act(pos.service.unmergeTable(pos.pid, selected.id, pos.actor), `${selected.name} separated.`)}
        />
      )}

      {adding && (
        <AddTableDialog
          areas={areas}
          onClose={() => setAdding(false)}
          onSave={(input) => pos.service.addTable(pos.pid, { ...input, outletId: outlet.id }, pos.actor).then((t) => { setAdding(false); setNotice(`${t.name} added.`) })}
        />
      )}

      {booking && (
        <BookingDialog
          tables={tables.filter((t) => !t.mergedInto)}
          inHouse={hotel.reservations.filter((r) => r.status === 'in-house')}
          onClose={() => setBooking(false)}
          onSave={(input) => pos.service.createBooking(pos.pid, { ...input, outletId: outlet.id }, pos.actor).then((b) => { setBooking(false); setTab('bookings'); setDate(b.date); setNotice(`Booked ${b.guestName} for ${b.covers} at ${b.time}.`) })}
        />
      )}
    </div>
  )
}

function TablePanel({
  table, status, order, orderTotal, tables, statusOf, bookings, now, onClose, onOpenOrder, onSeat, onStatus, onMove, onMerge, onUnmerge,
}: {
  table: PosTable
  status: TableStatus
  order?: HeldOrder
  orderTotal: number
  tables: PosTable[]
  statusOf: (t: PosTable) => TableStatus
  bookings: TableBooking[]
  now: number
  onClose: () => void
  onOpenOrder: () => void
  onSeat: (covers: number) => void
  onStatus: (s: 'free' | 'billAsked' | 'cleaning' | 'seated', message: string) => void
  onMove: (toId: string) => void
  onMerge: (otherId: string) => void
  onUnmerge: () => void
}) {
  const [covers, setCovers] = useState(String(table.covers ?? Math.min(2, table.seats)))
  const [moveTo, setMoveTo] = useState('')
  const [mergeWith, setMergeWith] = useState('')
  const joined = tables.filter((t) => t.mergedInto === table.id)
  const free = tables.filter((t) => t.id !== table.id && !t.mergedInto && statusOf(t) === 'free')
  const mainOf = table.mergedInto ? tables.find((t) => t.id === table.mergedInto) : undefined
  const seatedFor = table.seatedAt ? Math.max(0, Math.round((now - new Date(table.seatedAt).getTime()) / 60000)) : null

  return (
    <Modal side title={`Table ${table.name}`} description={`${table.seats + joined.reduce((s, t) => s + t.seats, 0)} seats${joined.length ? ` · with ${joined.map((t) => t.name).join(', ')}` : ''}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_STYLE[status].tone} dot>{mainOf ? `Joined to ${mainOf.name}` : TABLE_STATUS_LABEL[status]}</Badge>
          {table.covers && status !== 'free' && <Badge>{table.covers} covers</Badge>}
          {seatedFor !== null && status !== 'free' && <Badge>{seatedFor} min</Badge>}
        </div>

        {mainOf ? (
          <Button variant="ghost" onClick={onUnmerge}>Separate from {mainOf.name}</Button>
        ) : (
          <>
            {order && (
              <div className="rounded-lg bg-canvas p-3 text-sm">
                <p className="font-semibold">{order.id} · {cash(orderTotal)}</p>
                <p className="text-ink/60">{order.items.reduce((s, l) => s + l.qty, 0)} items · kitchen {order.kitchenStatus ?? 'New'}</p>
              </div>
            )}

            {status === 'free' && (
              <div className="flex items-end gap-2">
                <Field label="Guests">{(id) => <Input id={id} type="number" min={1} value={covers} onChange={(e) => setCovers(e.target.value)} className="w-24" />}</Field>
                <Button onClick={() => onSeat(Number(covers) || 0)}>Seat guests</Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {status !== 'cleaning' && <Button onClick={onOpenOrder} className="col-span-2">{order ? 'Open order' : 'Start order'}</Button>}
              {(status === 'seated' || status === 'ordered') && <Button variant="secondary" onClick={() => onStatus('billAsked', `Bill asked at ${table.name}.`)}>Bill asked</Button>}
              {status === 'billAsked' && <Button variant="secondary" onClick={() => onStatus('seated', `${table.name} back to seated.`)}>Undo bill asked</Button>}
              {status === 'cleaning' && <Button className="col-span-2" onClick={() => onStatus('free', `${table.name} is clean and free.`)}>Mark clean</Button>}
              {(status === 'seated' || status === 'billAsked') && !order && <Button variant="ghost" onClick={() => onStatus('cleaning', `${table.name} cleared.`)}>Guests left</Button>}
            </div>

            {status !== 'free' && status !== 'cleaning' && (
              <div className="space-y-3 border-t border-ink/10 pt-4">
                <div className="flex items-end gap-2">
                  <Field label="Move guests to">
                    {(id) => (
                      <Select id={id} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                        <option value="">Free table…</option>
                        {free.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.seats} seats</option>)}
                      </Select>
                    )}
                  </Field>
                  <Button variant="ghost" disabled={!moveTo} onClick={() => onMove(moveTo)}>Move</Button>
                </div>
                <div className="flex items-end gap-2">
                  <Field label="Join another table">
                    {(id) => (
                      <Select id={id} value={mergeWith} onChange={(e) => setMergeWith(e.target.value)}>
                        <option value="">Table…</option>
                        {tables.filter((t) => t.id !== table.id && !t.mergedInto && !tables.some((x) => x.mergedInto === t.id)).map((t) => <option key={t.id} value={t.id}>{t.name} · {TABLE_STATUS_LABEL[statusOf(t)]}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Button variant="ghost" disabled={!mergeWith} onClick={() => { onMerge(mergeWith); setMergeWith('') }}>Join</Button>
                </div>
              </div>
            )}
          </>
        )}

        {bookings.length > 0 && (
          <div className="border-t border-ink/10 pt-4">
            <p className="text-sm font-semibold">Booked today</p>
            <ul className="mt-2 space-y-1 text-sm">
              {bookings.map((b) => <li key={b.id}>{b.time} · {b.guestName} · {b.covers} covers</li>)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

function AddTableDialog({ areas, onSave, onClose }: { areas: { id: string; name: string }[]; onSave: (input: { areaId: string; name: string; seats: number; shape: TableShape }) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [seats, setSeats] = useState('4')
  const [shape, setShape] = useState<TableShape>('square')
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '')
  const [error, setError] = useState('')
  return (
    <Modal title="Add table" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave({ areaId, name, seats: Number(seats), shape }).catch((e: unknown) => setError(errorText(e)))}>Add table</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="T13" />}</Field>
        <Field label="Seats" required>{(id) => <Input id={id} type="number" min={1} max={20} value={seats} onChange={(e) => setSeats(e.target.value)} />}</Field>
        <Field label="Shape">{(id) => <Select id={id} value={shape} onChange={(e) => setShape(e.target.value as TableShape)}><option value="square">Square</option><option value="round">Round</option><option value="long">Long</option></Select>}</Field>
        <Field label="Area">{(id) => <Select id={id} value={areaId} onChange={(e) => setAreaId(e.target.value)}>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
    </Modal>
  )
}

function BookingDialog({
  tables, inHouse, onSave, onClose,
}: {
  tables: PosTable[]
  inHouse: { id: string; guest: string; room: string | null }[]
  onSave: (input: Omit<TableBooking, 'id' | 'propertyId' | 'status' | 'createdAt' | 'createdBy' | 'outletId'>) => Promise<unknown>
  onClose: () => void
}) {
  const [guestName, setGuestName] = useState('')
  const [phone, setPhone] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [date, setDate] = useState(TODAY)
  const [time, setTime] = useState('19:30')
  const [covers, setCovers] = useState('2')
  const [tableId, setTableId] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const fits = tables.filter((t) => t.seats >= (Number(covers) || 1))
  return (
    <Modal
      title="New table booking"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave({ guestName, phone: phone || undefined, reservationId: reservationId || undefined, date, time, covers: Number(covers), tableId: tableId || undefined, notes: notes || undefined }).catch((e: unknown) => setError(errorText(e)))}>Book</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hotel guest">
          {(id) => (
            <Select id={id} value={reservationId} onChange={(e) => { setReservationId(e.target.value); const r = inHouse.find((x) => x.id === e.target.value); if (r) setGuestName(r.guest) }}>
              <option value="">Not staying / walk-in</option>
              {inHouse.map((r) => <option key={r.id} value={r.id}>Room {r.room} · {r.guest}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Guest name" required>{(id) => <Input id={id} value={guestName} onChange={(e) => setGuestName(e.target.value)} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+256…" />}</Field>
        <Field label="Covers" required>{(id) => <Input id={id} type="number" min={1} value={covers} onChange={(e) => setCovers(e.target.value)} />}</Field>
        <Field label="Date" required>{(id) => <Input id={id} type="date" min={TODAY} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Time" required>{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
        <Field label="Table">
          {(id) => (
            <Select id={id} value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">Decide on arrival</option>
              {fits.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.seats} seats</option>)}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
        </div>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
    </Modal>
  )
}
