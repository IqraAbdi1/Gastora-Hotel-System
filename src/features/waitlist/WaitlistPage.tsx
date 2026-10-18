import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Segmented, Select, StatCard, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { freeByType } from '../../lib/booking'
import { dayMonth } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import {
  OFF_LIST_REASONS,
  WAIT_STATUS_LABEL,
  WAIT_STATUS_TONE,
  nightsAsked,
  offerExpired,
  offerLeft,
  readyToOffer,
  stale,
} from '../../lib/waitlist'
import type { WaitEntry } from '../../lib/waitlist'
import { useAuth } from '../auth/authContext'
import { useMessages } from '../messages/messagesContext'
import { useWaitlist } from './waitlistContext'
import type { Room } from '../../types'

const types: Room['type'][] = ['Standard', 'Deluxe', 'Suite']
type View = 'waiting' | 'closed'

// Everyone the hotel had to turn away, and - the part that matters - whose room has since come free.
export default function WaitlistPage() {
  const { entries, add, offer, close, lapse } = useWaitlist()
  const { rooms, reservations } = useHotel()
  const { queue } = useMessages()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('waiting')
  const [adding, setAdding] = useState(false)
  const [closing, setClosing] = useState<WaitEntry | null>(null)

  const me = user?.staffName ?? user?.name ?? 'Front desk'
  const freeOf = useMemo(
    () => (type: Room['type'], from: string, to: string) => freeByType(rooms, reservations, from, to)[type] ?? 0,
    [rooms, reservations],
  )

  const open = entries.filter((e) => e.status === 'waiting' || e.status === 'offered')
  const closed = entries.filter((e) => e.status === 'booked' || e.status === 'gone')
  const ready = readyToOffer(open, freeOf)
  const offered = open.filter((e) => e.status === 'offered')

  function tell(entry: WaitEntry) {
    offer(entry.id)
    queue({
      kind: 'room now free',
      to: entry.phone,
      guestName: entry.guestName,
      vars: {
        guest: entry.guestName,
        arrival: dayMonth(entry.arrival),
        departure: dayMonth(entry.departure),
        room: entry.roomType,
        hours: String(entry.offerHours),
      },
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Waiting list"
        description="Guests the hotel could not take. When a room comes free, the system says whose it is."
        actions={<Button onClick={() => setAdding(true)}>Add someone</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Waiting" value={String(open.filter((e) => e.status === 'waiting').length)} hint="Still want a room" />
        <StatCard
          label="Room has come free"
          value={String(ready.length)}
          tone={ready.length > 0 ? 'good' : 'default'}
          hint={ready.length > 0 ? 'Tell them now' : 'Nothing free for anyone waiting'}
        />
        <StatCard label="Offered" value={String(offered.length)} tone={offered.length > 0 ? 'warn' : 'default'} hint="Waiting for an answer" />
      </div>

      {ready.length > 0 && (
        <Card
          title="A room has come free"
          description="Offered, never held. The room stays on sale until somebody actually books it."
          icon="bed"
          count={ready.length}
          padded
        >
          <ul className="space-y-3">
            {ready.map((e) => (
              <li key={e.id} className="rounded-xl bg-good/[0.07] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{e.guestName}</p>
                    <p className="text-xs text-ink/65">
                      {e.roomType} · {dayMonth(e.arrival)} to {dayMonth(e.departure)} · {nightsAsked(e)} night(s) · asked {e.at}
                    </p>
                    {e.note && <p className="mt-0.5 text-xs text-ink/55">{e.note}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => tell(e)}>
                      Tell them
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setClosing(e)}>
                      Off the list
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Segmented
        options={[
          { key: 'waiting', label: `On the list (${open.length})` },
          { key: 'closed', label: `Finished (${closed.length})` },
        ]}
        value={view}
        onChange={setView}
        label="Waiting list view"
      />

      {view === 'waiting' && (
        <Card title="On the list" description="Oldest first. That is the order rooms are offered in." padded>
          {open.length === 0 ? (
            <p className="text-sm text-ink/60">Nobody is waiting. Add a guest when the hotel has to turn one away.</p>
          ) : (
            <ul className="space-y-3">
              {[...open]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((e) => {
                  const free = freeOf(e.roomType, e.arrival, e.departure)
                  const over = offerExpired(e)
                  return (
                    <li key={e.id} className="rounded-xl border border-ink/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink">{e.guestName}</span>
                            <Badge tone={WAIT_STATUS_TONE[e.status]} dot>
                              {WAIT_STATUS_LABEL[e.status]}
                            </Badge>
                            {stale(e, TODAY) && <Badge tone="neutral">Dates have passed</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-ink/65">
                            {e.roomType} · {dayMonth(e.arrival)} to {dayMonth(e.departure)} · {e.adults} adult(s) · {e.phone}
                          </p>
                          {e.status === 'offered' && (
                            <p className="mt-0.5 text-xs font-semibold text-warn">
                              Offered {e.offeredAt} · {offerLeft(e)}
                            </p>
                          )}
                          {e.status === 'waiting' && (
                            <p className="mt-0.5 text-xs text-ink/55">
                              {free > 0 ? `${free} ${e.roomType} free for those dates` : 'Nothing free for those dates yet'}
                            </p>
                          )}
                          {e.note && <p className="mt-0.5 text-xs text-ink/55">{e.note}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {e.status === 'waiting' && free > 0 && (
                            <Button size="sm" onClick={() => tell(e)}>
                              Tell them
                            </Button>
                          )}
                          {e.status === 'offered' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  navigate(
                                    `/desk/new-reservation?guest=${encodeURIComponent(e.guestName)}&phone=${encodeURIComponent(e.phone)}&type=${e.roomType}&from=${e.arrival}&to=${e.departure}`,
                                  )
                                }
                              >
                                Book it
                              </Button>
                              {over && (
                                <Button size="sm" variant="ghost" onClick={() => lapse(e.id)}>
                                  Time is up
                                </Button>
                              )}
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setClosing(e)}>
                            Off the list
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </Card>
      )}

      {view === 'closed' && (
        <Card title="Finished" description="What became of everyone who was on the list." padded>
          {closed.length === 0 ? (
            <p className="text-sm text-ink/60">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {closed.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 pb-2 text-sm last:border-0">
                  <span className="font-medium text-ink">{e.guestName}</span>
                  <span className="text-xs text-ink/60">
                    {e.status === 'booked' ? `Booked ${e.bookedId ?? ''}` : `Off the list: ${e.closedReason}`} · {e.closedAt}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {adding && <AddDialog onClose={() => setAdding(false)} onAdd={(input) => add(input, me)} />}
      {closing && (
        <Modal title={`Take ${closing.guestName} off the list`} onClose={() => setClosing(null)}>
          <div className="space-y-3">
            {OFF_LIST_REASONS.map((reason) => (
              <Button
                key={reason}
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  close(closing.id, reason)
                  setClosing(null)
                }}
              >
                {reason}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function AddDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (input: Parameters<ReturnType<typeof useWaitlist>['add']>[0]) => void }) {
  const [guestName, setGuestName] = useState('')
  const [phone, setPhone] = useState('')
  const [roomType, setRoomType] = useState<Room['type']>('Standard')
  const [arrival, setArrival] = useState(TODAY)
  const [departure, setDeparture] = useState(TODAY)
  const [adults, setAdults] = useState(1)
  const [note, setNote] = useState('')

  const ok = guestName.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9 && departure > arrival

  return (
    <Modal
      title="Add someone to the waiting list"
      description="The hotel could not take them today. The system will say when their room comes free."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ok}
            onClick={() => {
              onAdd({ guestName: guestName.trim(), phone: phone.trim(), roomType, arrival, departure, adults, note: note.trim() || undefined })
              onClose()
            }}
          >
            Add to the list
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Guest name" required>{(id) => <Input id={id} value={guestName} onChange={(e) => setGuestName(e.target.value)} />}</Field>
        <Field label="Phone" required>{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
        <Field label="Room type">
          {(id) => (
            <Select id={id} value={roomType} onChange={(e) => setRoomType(e.target.value as Room['type'])}>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Adults">
          {(id) => <Input id={id} type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />}
        </Field>
        <Field label="Arrival">{(id) => <Input id={id} type="date" value={arrival} onChange={(e) => setArrival(e.target.value)} />}</Field>
        <Field label="Departure">{(id) => <Input id={id} type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Anything the desk was told">
            {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: here for a wedding, any room will do" />}
          </Field>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink/55">
        A room is never held for the waiting list. When one comes free it is offered for two hours, and it stays on sale the whole time.
      </p>
    </Modal>
  )
}
