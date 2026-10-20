import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Segmented, Select, StatCard } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { SETUP_LABEL, capacityOf, clashesFor } from '../../services/events/eventsRules'
import type { EventBooking, EventSession, EventsData, SetupStyle } from '../../services/events/eventsTypes'
import { ErrorNote } from './ErrorNote'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, EVENT_TYPES, EVENT_TYPE_LABEL, SPACE_KIND_LABEL, addDays, num, shortDate } from './eventsUi'
import { useEvents, useRun } from './useEvents'

const START = 7
const END = 24
const HOURS = Array.from({ length: END - START }, (_, i) => START + i)
const pct = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return ((h + m / 60 - START) / (END - START)) * 100
}

type Draft = Partial<EventSession> & { spaceId: string; date: string }

export default function DiaryPage() {
  const { data } = useEvents()
  const [date, setDate] = useState(TODAY)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [draft, setDraft] = useState<Draft | null>(null)

  const spaces = data.spaces.filter((s) => s.active)
  const live = data.bookings.filter((b) => b.status !== 'cancelled')
  const liveIds = new Set(live.map((b) => b.id))
  const sessions = data.sessions.filter((s) => liveIds.has(s.eventBookingId))
  const days = view === 'day' ? [date] : Array.from({ length: 7 }, (_, i) => addDays(date, i))
  const inRange = sessions.filter((s) => days.includes(s.date))
  const clashIds = new Set(inRange.filter((s) => clashesFor(s, data.sessions, data.bookings).length > 0).map((s) => s.id))
  const pax = inRange.reduce((sum, s) => sum + s.pax, 0)
  const booking = (id: string) => data.bookings.find((b) => b.id === id)
  const spaceName = (id: string) => data.spaces.find((s) => s.id === id)?.name ?? id

  const step = view === 'day' ? 1 : 7

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Events and sales"
        title="Function diary"
        description="Halls, boardrooms and gardens by day and time."
        actions={
          <Button onClick={() => setDraft({ spaceId: spaces[0]?.id ?? '', date, startTime: '09:00', endTime: '13:00' })} disabled={spaces.length === 0}>
            Book a space
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={view === 'day' ? 'Sessions' : 'Sessions this week'} value={String(inRange.length)} icon="calendar" />
        <StatCard label="Spaces in use" value={`${new Set(inRange.map((s) => s.spaceId)).size} of ${spaces.length}`} icon="occupancy" />
        <StatCard label="Guests" value={pax.toLocaleString('en-US')} hint="Sum of session pax" icon="guests" />
        <StatCard label="Clashes" value={String(clashIds.size)} hint={clashIds.size ? 'Tentative holds overlap' : 'None'} tone={clashIds.size ? 'bad' : 'default'} icon="alert" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDate(addDays(date, -step))} aria-label="Earlier">
          ‹
        </Button>
        <div className="w-40">
          <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDate(addDays(date, step))} aria-label="Later">
          ›
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDate(TODAY)}>
          Today
        </Button>
        <div className="ml-auto">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { key: 'day', label: 'Day' },
              { key: 'week', label: 'Week' },
            ]}
          />
        </div>
      </div>

      <Card title={view === 'day' ? shortDate(date) : `${shortDate(days[0])} to ${shortDate(days[6])}`} icon="calendar" padded={false}>
        {spaces.length === 0 ? (
          <p className="p-4 text-sm text-ink/60">
            No function spaces yet. <Link to="/events/setup" className="font-semibold text-brand">Add one</Link>
          </p>
        ) : view === 'day' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="flex border-b border-ink/10 bg-canvas/50 text-[11px] font-semibold text-ink/50">
                <div className="w-40 shrink-0 px-3 py-2">Space</div>
                <div className="relative flex flex-1">
                  {HOURS.map((h) => (
                    <div key={h} className="flex-1 border-l border-ink/8 px-1 py-2">
                      {String(h).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
              </div>
              {spaces.map((sp) => {
                const row = inRange.filter((s) => s.spaceId === sp.id)
                return (
                  <div key={sp.id} className="flex border-b border-ink/8 last:border-0">
                    <div className="w-40 shrink-0 px-3 py-3">
                      <p className="text-sm font-semibold text-ink">{sp.name}</p>
                      <p className="text-[11px] text-ink/50">{SPACE_KIND_LABEL[sp.kind]}</p>
                    </div>
                    <div className="relative min-h-[64px] flex-1">
                      <div className="absolute inset-0 flex">
                        {HOURS.map((h) => (
                          <button
                            key={h}
                            type="button"
                            aria-label={`Book ${sp.name} at ${h}:00`}
                            onClick={() =>
                              setDraft({
                                spaceId: sp.id,
                                date,
                                startTime: `${String(h).padStart(2, '0')}:00`,
                                endTime: `${String(Math.min(23, h + 3)).padStart(2, '0')}:${h + 3 > 23 ? '59' : '00'}`,
                              })
                            }
                            className="flex-1 border-l border-ink/8 hover:bg-brand/5"
                          />
                        ))}
                      </div>
                      {row.map((s) => {
                        const b = booking(s.eventBookingId)
                        const clash = clashIds.has(s.id)
                        const left = Math.max(0, pct(s.startTime))
                        const width = Math.min(100, pct(s.endTime)) - left
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setDraft(s)}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            className={`absolute top-1.5 bottom-1.5 overflow-hidden rounded-md px-2 py-1 text-left text-xs shadow-sm ${
                              b?.status === 'definite' || b?.status === 'completed'
                                ? 'bg-brand text-white'
                                : 'border border-dashed border-warn bg-warn/15 text-ink'
                            } ${clash ? 'ring-2 ring-bad' : ''}`}
                            title={`${b?.name} · ${s.title} · ${s.startTime}-${s.endTime}`}
                          >
                            <span className="block truncate font-semibold">{b?.name}</span>
                            <span className="block truncate opacity-80">
                              {s.startTime}-{s.endTime} · {SETUP_LABEL[s.setup]} {s.pax}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-xs">
              <thead>
                <tr className="border-b border-ink/10 bg-canvas/50 text-ink/55">
                  <th className="w-40 px-3 py-2 text-left font-semibold">Space</th>
                  {days.map((d) => (
                    <th key={d} className={`px-2 py-2 text-left font-semibold ${d === TODAY ? 'text-brand' : ''}`}>
                      {shortDate(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {spaces.map((sp) => (
                  <tr key={sp.id}>
                    <td className="px-3 py-2 align-top text-sm font-semibold text-ink">{sp.name}</td>
                    {days.map((d) => (
                      <td key={d} className="px-1.5 py-1.5 align-top">
                        <div className="space-y-1">
                          {inRange
                            .filter((s) => s.spaceId === sp.id && s.date === d)
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map((s) => {
                              const b = booking(s.eventBookingId)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => setDraft(s)}
                                  className={`block w-full truncate rounded px-1.5 py-1 text-left ${
                                    b?.status === 'tentative' ? 'border border-dashed border-warn bg-warn/15 text-ink' : 'bg-brand text-white'
                                  } ${clashIds.has(s.id) ? 'ring-2 ring-bad' : ''}`}
                                >
                                  {s.startTime} {b?.name}
                                </button>
                              )
                            })}
                          <button
                            type="button"
                            onClick={() => setDraft({ spaceId: sp.id, date: d, startTime: '09:00', endTime: '13:00' })}
                            className="block w-full rounded px-1.5 py-0.5 text-left text-ink/35 hover:bg-brand/5 hover:text-brand"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-4 border-t border-ink/10 px-4 py-2.5 text-xs text-ink/60">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded bg-brand" /> Definite
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-dashed border-warn bg-warn/15" /> Tentative
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded ring-2 ring-bad" /> Clash
          </span>
        </div>
      </Card>

      <Card title="Sessions" count={inRange.length} padded={false}>
        <DataTable
          rows={[...inRange].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))}
          rowKey={(s) => s.id}
          onRowClick={(s) => setDraft(s)}
          empty={{ title: 'Nothing booked' }}
          columns={[
            { key: 'when', header: 'When', cell: (s) => `${view === 'week' ? shortDate(s.date) + ' ' : ''}${s.startTime}-${s.endTime}` },
            { key: 'event', header: 'Event', cell: (s) => <span className="font-medium text-ink">{booking(s.eventBookingId)?.name}</span> },
            { key: 'space', header: 'Space', cell: (s) => spaceName(s.spaceId) },
            { key: 'setup', header: 'Setup', cell: (s) => `${SETUP_LABEL[s.setup]} · ${s.pax}`, hideBelow: 'md' },
            {
              key: 'status',
              header: 'Status',
              cell: (s) => {
                const b = booking(s.eventBookingId)
                return (
                  <span className="flex gap-1">
                    {b && <Badge tone={EVENT_STATUS_TONE[b.status]}>{EVENT_STATUS_LABEL[b.status]}</Badge>}
                    {clashIds.has(s.id) && <Badge tone="bad">Clash</Badge>}
                  </span>
                )
              },
            },
          ]}
        />
      </Card>

      {draft && <SessionDialog draft={draft} data={data} onClose={() => setDraft(null)} />}
    </div>
  )
}

/** Book a space for an event, or change or remove a booked session. Also used from the event page. */
export function SessionDialog({ draft, data, onClose, fixedEventId }: { draft: Draft; data: EventsData; onClose: () => void; fixedEventId?: string }) {
  const { service, actor, propertyId } = useEvents()
  const { busy, error, run } = useRun()
  const editing = !!draft.id
  const open = data.bookings.filter((b) => b.status === 'tentative' || b.status === 'definite')
  const [eventId, setEventId] = useState(draft.eventBookingId ?? fixedEventId ?? open[0]?.id ?? 'new')
  const [spaceId, setSpaceId] = useState(draft.spaceId)
  const [title, setTitle] = useState(draft.title ?? '')
  const [date, setDate] = useState(draft.date)
  const [startTime, setStart] = useState(draft.startTime ?? '09:00')
  const [endTime, setEnd] = useState(draft.endTime ?? '13:00')
  const spaceSetups = data.setups.filter((s) => s.spaceId === spaceId)
  const [setup, setSetup] = useState<SetupStyle>(draft.setup ?? spaceSetups[0]?.setup ?? 'theatre')
  const [pax, setPax] = useState(String(draft.pax ?? ''))
  const [quick, setQuick] = useState({ name: '', clientName: '', contactPhone: '', eventType: 'meeting' as EventBooking['eventType'] })
  const [removing, setRemoving] = useState(false)

  const clashes = useMemo(
    () => (spaceId && date && startTime < endTime ? clashesFor({ id: draft.id, spaceId, date, startTime, endTime }, data.sessions, data.bookings) : []),
    [spaceId, date, startTime, endTime, draft.id, data.sessions, data.bookings],
  )
  const name = (id: string) => data.bookings.find((b) => b.id === id)?.name ?? id
  const chosenSetup = spaceSetups.some((s) => s.setup === setup) ? setup : (spaceSetups[0]?.setup ?? setup)
  const cap = capacityOf(data.setups, spaceId, chosenSetup)

  const save = async () => {
    const ok = await run(async () => {
      let evId = eventId
      if (evId === 'new') {
        const b = await service.createBooking(
          propertyId,
          { name: quick.name, eventType: quick.eventType, clientName: quick.clientName, contactName: quick.clientName, contactPhone: quick.contactPhone, startDate: date, endDate: date, expectedGuests: num(pax), ownerName: actor.name },
          actor,
        )
        evId = b.id
      }
      return service.saveSession(propertyId, { id: draft.id, eventBookingId: evId, spaceId, title: title || 'Main session', date, startTime, endTime, setup: chosenSetup, pax: num(pax) }, actor)
    })
    if (ok) onClose()
  }

  return (
    <Modal
      title={editing ? 'Session' : 'Book a space'}
      description={editing ? name(draft.eventBookingId as string) : undefined}
      onClose={onClose}
      side
      footer={
        <>
          {editing && (
            <Button variant="ghost" className="mr-auto text-bad" onClick={() => setRemoving(true)}>
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {editing ? 'Save' : 'Book'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {!fixedEventId && (
          <Field label="Event" required>
            {(id) => (
              <Select id={id} value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={editing}>
                {open.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({EVENT_STATUS_LABEL[b.status].toLowerCase()})
                  </option>
                ))}
                {!editing && <option value="new">+ New event</option>}
              </Select>
            )}
          </Field>
        )}
        {eventId === 'new' && !editing && (
          <div className="space-y-3 rounded-lg border border-ink/10 p-3">
            <Field label="Event name" required>
              {(id) => <Input id={id} value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} />}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client" required>
                {(id) => <Input id={id} value={quick.clientName} onChange={(e) => setQuick({ ...quick, clientName: e.target.value })} />}
              </Field>
              <Field label="Phone">
                {(id) => <Input id={id} value={quick.contactPhone} onChange={(e) => setQuick({ ...quick, contactPhone: e.target.value })} />}
              </Field>
            </div>
            <Field label="Type">
              {(id) => (
                <Select id={id} value={quick.eventType} onChange={(e) => setQuick({ ...quick, eventType: e.target.value as EventBooking['eventType'] })}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
        <Field label="Session" hint="e.g. Plenary, Lunch, Reception">
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Space" required>
          {(id) => (
            <Select id={id} value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              {data.spaces
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="From">{(id) => <Input id={id} type="time" value={startTime} onChange={(e) => setStart(e.target.value)} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} />}</Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Setup">
            {(id) => (
              <Select id={id} value={chosenSetup} onChange={(e) => setSetup(e.target.value as SetupStyle)}>
                {spaceSetups.map((s) => (
                  <option key={s.setup} value={s.setup}>
                    {SETUP_LABEL[s.setup]} (up to {s.capacity})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="People" required error={cap !== undefined && num(pax) > cap ? `Holds ${cap} in this setup` : undefined}>
            {(id) => <Input id={id} inputMode="numeric" value={pax} onChange={(e) => setPax(e.target.value)} />}
          </Field>
        </div>
        {clashes.length > 0 && (
          <div className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-ink">
            <p className="font-semibold text-warn">Overlaps</p>
            <ul className="mt-1 space-y-0.5">
              {clashes.map((c) => (
                <li key={c.id}>
                  {name(c.eventBookingId)} · {c.startTime}-{c.endTime}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ErrorNote error={error} />
        {editing && draft.eventBookingId && !fixedEventId && (
          <Link to={`/events/bookings/${draft.eventBookingId}`} className="block text-sm font-semibold text-brand hover:underline">
            Open the event and BEO
          </Link>
        )}
      </div>
      {removing && draft.id && (
        <ConfirmDialog
          title="Remove this session?"
          message={`${title} on ${date}, ${startTime}-${endTime}.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(false)}
          onConfirm={async () => {
            if (await run(() => service.deleteSession(draft.id as string, actor).then(() => true))) onClose()
            setRemoving(false)
          }}
        />
      )}
    </Modal>
  )
}
