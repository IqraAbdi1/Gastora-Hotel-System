import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { ugx } from '../../lib/format'
import { SETUP_LABEL, beoLineCost, beoLineTotal, hireFor } from '../../services/events/eventsRules'
import type { Beo, BeoItem, BeoItemKind, EventBooking, EventSession, EventsData } from '../../services/events/eventsTypes'
import { SessionDialog } from './DiaryPage'
import { ErrorNote } from './ErrorNote'
import { BEO_STATUS_LABEL, BEO_STATUS_TONE, eventDays, num, shortDate, stampText } from './eventsUi'
import { useEvents, useRun } from './useEvents'

// The banquet event order: where, when, what is served and how the room is set.
export default function BeoTab({ booking, beo, data, closed }: { booking: EventBooking; beo: Beo; data: EventsData; closed: boolean }) {
  const { service, actor } = useEvents()
  const { error, run } = useRun()
  const [session, setSession] = useState<(Partial<EventSession> & { spaceId: string; date: string }) | null>(null)
  const [adding, setAdding] = useState(false)
  const [signing, setSigning] = useState(false)
  const [removing, setRemoving] = useState<BeoItem | null>(null)
  const [agenda, setAgenda] = useState(beo.agenda)
  const [kitchen, setKitchen] = useState(beo.kitchenNotes ?? '')
  const [setupNotes, setSetupNotes] = useState(beo.setupNotes ?? '')
  const saved = JSON.stringify([beo.agenda, beo.kitchenNotes ?? '', beo.setupNotes ?? ''])
  const [seen, setSeen] = useState(saved)
  // Pick up a change saved elsewhere, such as another tab.
  if (seen !== saved) {
    setSeen(saved)
    setAgenda(beo.agenda)
    setKitchen(beo.kitchenNotes ?? '')
    setSetupNotes(beo.setupNotes ?? '')
  }

  const sessions = data.sessions.filter((s) => s.eventBookingId === booking.id).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
  const items = data.beoItems.filter((i) => i.beoId === beo.id).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
  const spaceName = (id: string) => data.spaces.find((s) => s.id === id)?.name ?? id
  const fbTotal = items.reduce((s, i) => s + beoLineTotal(i), 0)
  const fbCost = items.reduce((s, i) => s + beoLineCost(i), 0)
  const dirty =
    JSON.stringify(agenda) !== JSON.stringify(beo.agenda) || kitchen !== (beo.kitchenNotes ?? '') || setupNotes !== (beo.setupNotes ?? '')

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">BEO v{beo.version}</span>
            <Badge tone={BEO_STATUS_TONE[beo.status]} dot>
              {BEO_STATUS_LABEL[beo.status]}
            </Badge>
            {beo.issuedAt && <span className="text-xs text-ink/55">Issued {stampText(beo.issuedAt)} by {beo.issuedBy}</span>}
            {beo.signedAt && <span className="text-xs text-ink/55">· signed by {beo.signedBy}</span>}
          </div>
          {!closed && (
            <div className="flex gap-2">
              {beo.status === 'draft' && (
                <Button size="sm" onClick={() => run(() => service.issueBeo(beo.id, actor))} disabled={dirty}>
                  Issue to departments
                </Button>
              )}
              {beo.status === 'issued' && (
                <Button size="sm" onClick={() => setSigning(true)}>
                  Record client signature
                </Button>
              )}
            </div>
          )}
        </div>
        {dirty && <p className="mt-2 text-xs text-warn">Save the agenda and notes before issuing.</p>}
        <div className="mt-2">
          <ErrorNote error={error} />
        </div>
      </Card>

      <Card
        title="Function spaces"
        icon="calendar"
        count={sessions.length}
        padded={false}
        actions={
          !closed && (
            <Button size="sm" variant="secondary" onClick={() => setSession({ spaceId: data.spaces.find((s) => s.active)?.id ?? '', date: booking.startDate, startTime: '09:00', endTime: '13:00', eventBookingId: booking.id })}>
              Add session
            </Button>
          )
        }
      >
        <DataTable
          rows={sessions}
          rowKey={(s) => s.id}
          onRowClick={closed ? undefined : (s) => setSession(s)}
          empty={{ title: 'No space booked yet' }}
          columns={[
            { key: 'd', header: 'When', cell: (s) => `${shortDate(s.date)} ${s.startTime}-${s.endTime}` },
            { key: 't', header: 'Session', cell: (s) => <span className="font-medium text-ink">{s.title}</span> },
            { key: 's', header: 'Space', cell: (s) => spaceName(s.spaceId) },
            { key: 'u', header: 'Setup', cell: (s) => `${SETUP_LABEL[s.setup]} · ${s.pax}`, hideBelow: 'sm' },
            { key: 'h', header: 'Hire', cell: (s) => ugx(hireFor(s, data)), align: 'right', hideBelow: 'md' },
          ]}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Agenda"
          icon="list"
          actions={
            !closed && (
              <Button size="sm" variant="ghost" onClick={() => setAgenda([...agenda, { time: '', item: '' }])}>
                Add line
              </Button>
            )
          }
        >
          <div className="space-y-2">
            {agenda.length === 0 && <p className="text-sm text-ink/55">No agenda yet.</p>}
            {agenda.map((a, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-32 shrink-0">
                  <Input
                    type="time"
                    value={a.time}
                    aria-label="Time"
                    disabled={closed}
                    onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))}
                  />
                </div>
                <Input value={a.item} aria-label="Item" disabled={closed} onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} />
                {!closed && (
                  <Button size="sm" variant="ghost" aria-label="Remove line" onClick={() => setAgenda(agenda.filter((_, j) => j !== i))}>
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Notes" icon="tasks">
          <div className="space-y-3">
            <Field label="Kitchen">{(id) => <Textarea id={id} rows={3} value={kitchen} disabled={closed} onChange={(e) => setKitchen(e.target.value)} placeholder="Dietary needs, timings" />}</Field>
            <Field label="Room setup">{(id) => <Textarea id={id} rows={3} value={setupNotes} disabled={closed} onChange={(e) => setSetupNotes(e.target.value)} placeholder="Stage, head table, signage" />}</Field>
            {!closed && (
              <div className="flex justify-end">
                <Button size="sm" disabled={!dirty} onClick={() => run(() => service.saveBeo(beo.id, { agenda: agenda.filter((a) => a.time || a.item), kitchenNotes: kitchen, setupNotes }, actor))}>
                  Save agenda and notes
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card
        title="Menus and packages"
        icon="money"
        count={items.length}
        padded={false}
        description={`${ugx(fbTotal)} · cost ${ugx(fbCost)}`}
        actions={
          !closed && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              Add menu or package
            </Button>
          )
        }
      >
        <DataTable
          rows={items}
          rowKey={(i) => i.id}
          empty={{ title: 'Nothing ordered yet' }}
          columns={[
            { key: 'd', header: 'Served', cell: (i) => `${shortDate(i.date)}${i.time ? ' ' + i.time : ''}` },
            { key: 'x', header: 'Item', cell: (i) => <span className="font-medium text-ink">{i.description}</span> },
            { key: 'q', header: 'Qty', cell: (i) => `${i.quantity}${i.perHead ? ' pax' : ''}`, align: 'right' },
            { key: 'p', header: 'Price', cell: (i) => ugx(i.unitPrice), align: 'right', hideBelow: 'md' },
            { key: 't', header: 'Total', cell: (i) => ugx(beoLineTotal(i)), align: 'right' },
            {
              key: 'r',
              header: '',
              cell: (i) =>
                !closed && (
                  <button type="button" className="text-xs font-semibold text-bad hover:underline" onClick={() => setRemoving(i)}>
                    Remove
                  </button>
                ),
            },
          ]}
        />
      </Card>

      {session && <SessionDialog draft={session} data={data} fixedEventId={booking.id} onClose={() => setSession(null)} />}
      {adding && <BeoItemDialog booking={booking} beo={beo} data={data} onClose={() => setAdding(false)} />}
      {signing && <SignDialog title="Client signature on the BEO" onClose={() => setSigning(false)} onSign={(name) => service.signBeo(beo.id, name, actor)} defaultName={booking.contactName} />}
      {removing && (
        <ConfirmDialog
          title="Remove this item?"
          message={`${removing.description}. An issued BEO goes back to draft.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const i = removing
            setRemoving(null)
            void run(() => service.removeBeoItem(i.id, actor))
          }}
        />
      )}
    </div>
  )
}

function BeoItemDialog({ booking, beo, data, onClose }: { booking: EventBooking; beo: Beo; data: EventsData; onClose: () => void }) {
  const { service, actor } = useEvents()
  const { busy, error, run } = useRun()
  const packages = data.packages.filter((p) => p.active)
  const days = eventDays(booking)
  const guests = booking.guaranteedGuests ?? booking.expectedGuests
  const [packageId, setPackageId] = useState(packages[0]?.id ?? '')
  const [kind, setKind] = useState<BeoItemKind>(packages.length ? 'package' : 'other')
  const first = packages[0]
  const [description, setDescription] = useState(first?.name ?? '')
  const [date, setDate] = useState(days[0])
  const [time, setTime] = useState('')
  const [quantity, setQuantity] = useState(String(guests))
  const [price, setPrice] = useState(String(first?.pricePerHead ?? ''))
  const [cost, setCost] = useState(String(first?.costPerHead ?? ''))

  const pick = (id: string) => {
    setPackageId(id)
    const p = packages.find((x) => x.id === id)
    if (p) {
      setKind(p.kind === 'menu' ? 'menu' : 'package')
      setDescription(p.name)
      setPrice(String(p.pricePerHead))
      setCost(String(p.costPerHead))
    } else {
      setKind('beverage')
      setDescription('')
      setPrice('')
      setCost('')
    }
  }
  const included = data.packageItems.filter((i) => i.packageId === packageId)
  const save = async () => {
    const perHead = kind === 'package' || kind === 'menu'
    const ok = await run(() =>
      service.addBeoItem(beo.id, { kind, packageId: packageId || undefined, description, date, time: time || undefined, quantity: num(quantity), unitPrice: num(price), unitCost: num(cost), perHead }, actor),
    )
    if (ok) onClose()
  }
  return (
    <Modal
      title="Add to the BEO"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Package or menu">
          {(id) => (
            <Select id={id} value={packageId} onChange={(e) => pick(e.target.value)}>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {ugx(p.pricePerHead)} per head
                </option>
              ))}
              <option value="">Other item (drinks, cake, extras)</option>
            </Select>
          )}
        </Field>
        {included.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink/65">
            {included.map((i) => (
              <li key={i.id}>{i.description}</li>
            ))}
          </ul>
        )}
        {!packageId && (
          <Field label="Kind">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as BeoItemKind)}>
                <option value="beverage">Beverage</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>
        )}
        <Field label="Description" required>
          {(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            {(id) => (
              <Select id={id} value={date} onChange={(e) => setDate(e.target.value)}>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {shortDate(d)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Time">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={packageId ? 'People' : 'Quantity'} required>
            {(id) => <Input id={id} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
          </Field>
          <Field label="Price each">{(id) => <Input id={id} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
          <Field label="Cost each">{(id) => <Input id={id} inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />}</Field>
        </div>
        <p className="text-sm font-semibold text-ink">Total {ugx(num(quantity) * num(price))}</p>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}

/** Who signed for the client. Used for BEOs and contracts. */
export function SignDialog({ title, defaultName, onSign, onClose }: { title: string; defaultName: string; onSign: (name: string) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState(defaultName)
  const { busy, error, run } = useRun()
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={async () => (await run(() => onSign(name))) && onClose()}>
            Record signature
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Signed by" required>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  )
}
