import { useMemo, useState } from 'react'
import { Badge, Button, Field, Input, Select, inputClass } from '../../components/ui'
import { roomRate } from '../../data/rates'
import { isRoomFree } from '../../lib/availability'
import { nightsOf, roomTypes } from '../../lib/booking'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { floorLabel, floorOf } from '../../lib/rooms'
import type { Reservation, Room } from '../../types'
import { useAuth } from '../auth/authContext'

type Props = { reservation: Reservation; onClose: () => void; onDone: () => void }

/** Why the guest is moving. The reason decides who pays when the new room is a better one. */
const HOTEL_REASONS = ['Fault in the room', 'Noise', 'Room needed for another booking', 'Housekeeping problem', 'Other']
const GUEST_REASONS = ['Guest asked for a better room', 'Guest asked for a quieter room', 'Guest asked for another floor', 'Other']

const SHOW = 12
const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

// Move a guest who is already in the house. Only clean rooms free for the rest of the stay are offered.
// A better room is free when the hotel caused the move or it is a goodwill upgrade; the guest pays the
// difference only when they asked for it. The old room goes to housekeeping as dirty.
export default function MoveRoomPanel({ reservation: r, onClose, onDone }: Props) {
  const { rooms, reservations, moveRoom, addCharge } = useHotel()
  const { user } = useAuth()

  const [pick, setPick] = useState('')
  const [paidBy, setPaidBy] = useState<'hotel' | 'guest'>('hotel')
  const [reason, setReason] = useState(HOTEL_REASONS[0])
  const [note, setNote] = useState('')
  const [q, setQ] = useState('')
  // What actually happened, kept as it was at the moment of the move: afterwards the room is occupied and the
  // live figures no longer describe the move.
  const [done, setDone] = useState<{ from: string; to: string; charged: number } | null>(null)

  const free = useMemo(
    () =>
      rooms.filter(
        (x) => x.number !== r.room && x.status === 'clean' && isRoomFree(x, r.arrival, r.departure, reservations, r.id),
      ),
    [rooms, reservations, r],
  )
  const list = useMemo(
    () =>
      free
        .filter((x) => q.trim() === '' || x.number.includes(q.trim()))
        .sort(
          (a, b) =>
            Number(a.type !== r.roomType) - Number(b.type !== r.roomType) || Number(a.number) - Number(b.number),
        ),
    [free, q, r.roomType],
  )
  const shown = list.slice(0, SHOW)

  const target = free.find((x) => x.number === pick)
  const rank = (t: Room['type']) => roomTypes.indexOf(t)
  const higher = target ? rank(target.type) > rank(r.roomType) : false
  const lower = target ? rank(target.type) < rank(r.roomType) : false

  // Nights left to pay for at the new rate. The night the guest moves counts as a night in the new room.
  const nightsLeft = target ? Math.max(0, nightsOf(new Date().toISOString().slice(0, 10), r.departure)) : 0
  const perNight = target ? roomRate[target.type] - roomRate[r.roomType] : 0
  const difference = higher && paidBy === 'guest' ? Math.max(0, perNight * nightsLeft) : 0
  const charged = difference > 0

  const reasonList = paidBy === 'guest' ? GUEST_REASONS : HOTEL_REASONS
  const pickedReason = reasonList.includes(reason) ? reason : reasonList[0]
  const valid = !!target && (pickedReason !== 'Other' || note.trim() !== '')

  function choosePaidBy(next: 'hotel' | 'guest') {
    setPaidBy(next)
    setReason(next === 'guest' ? GUEST_REASONS[0] : HOTEL_REASONS[0])
  }

  function confirm() {
    if (!target) return
    const why = [pickedReason, note.trim()].filter(Boolean).join(': ')
    moveRoom(r.id, target.number, {
      from: r.room as string,
      to: target.number,
      reason: why,
      by: user?.name ?? 'Front desk',
      ...(target.type !== r.roomType
        ? { typeChange: { from: r.roomType, to: target.type }, free: higher && !charged }
        : {}),
    })
    if (charged)
      addCharge(r.id, {
        category: 'Room upgrade',
        description: `${r.roomType} to ${target.type}, room ${target.number}, ${nightsLeft} night${nightsLeft === 1 ? '' : 's'}`,
        amount: difference,
      })
    setDone({ from: r.room as string, to: target.number, charged: difference })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={`Move ${r.guest}`}>
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-linear-to-r from-brand-deep to-brand p-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Front desk · Move room</p>
            <h2 className="text-lg font-semibold">{r.guest}</h2>
            <p className="text-sm text-white/80">
              {r.id} · Room {r.room} ({r.roomType}) · leaves {dayMonth(r.departure)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-white/90 hover:text-white">
            Close
          </button>
        </div>

        {done ? (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-good/30 bg-good/10 p-4">
              <p className="font-semibold text-good">
                {r.guest} moved from room {done.from} to room {done.to}.
              </p>
              <p className="mt-1 text-sm text-ink/75">
                Room {done.from} is now dirty and waiting for housekeeping.{' '}
                {done.charged > 0
                  ? `${ugx(done.charged)} was added to the folio for the better room.`
                  : 'Nothing was added to the folio.'}
              </p>
            </div>
            <Button className="w-full" onClick={onDone}>
              Done
            </Button>
          </div>
        ) : free.length === 0 ? (
          <div className="space-y-4 p-5">
            <p className="rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn">
              No clean room is free for the rest of this stay. Ask housekeeping to clean one first, then move the guest.
            </p>
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Back
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={heading}>1 · New room</p>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Room number"
                    aria-label="Room number"
                    className={`${inputClass} w-36 py-1.5`}
                  />
                </div>
                <p className="mt-1 text-xs text-ink/60">
                  Clean rooms free until {dayMonth(r.departure)}. Same type first.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {shown.map((x) => {
                    const up = rank(x.type) > rank(r.roomType)
                    return (
                      <button
                        key={x.number}
                        type="button"
                        onClick={() => setPick(x.number)}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          pick === x.number
                            ? 'border-brand bg-brand/[0.08] ring-2 ring-brand/20'
                            : 'border-ink/12 bg-canvas hover:border-brand/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-ink">Room {x.number}</p>
                          {x.type === r.roomType ? (
                            <Badge tone="good">Same</Badge>
                          ) : (
                            <Badge tone={up ? 'accent' : 'warn'}>{up ? 'Higher' : 'Lower'}</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-ink/60">
                          {x.type} · {floorLabel(floorOf(x))}
                        </p>
                      </button>
                    )
                  })}
                </div>
                {list.length > shown.length && (
                  <p className="mt-2 text-xs text-ink/55">And {list.length - shown.length} more. Search by room number.</p>
                )}
              </section>

              <section>
                <p className={heading}>2 · Who pays</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        key: 'hotel' as const,
                        title: 'Free move',
                        blurb: 'The hotel is moving the guest, or giving a goodwill upgrade. Nothing is charged.',
                      },
                      {
                        key: 'guest' as const,
                        title: 'Guest asked',
                        blurb: 'The guest wants a better room. A higher type is charged at the difference.',
                      },
                    ]
                  ).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => choosePaidBy(o.key)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        paidBy === o.key
                          ? 'border-brand bg-brand/[0.08] ring-2 ring-brand/20'
                          : 'border-ink/12 bg-canvas hover:border-brand/40'
                      }`}
                    >
                      <p className="font-semibold text-ink">{o.title}</p>
                      <p className="mt-0.5 text-xs text-ink/60">{o.blurb}</p>
                    </button>
                  ))}
                </div>

                {target && (
                  <div
                    className={`mt-3 rounded-xl border p-3 text-sm ${
                      charged ? 'border-brand/25 bg-brand/[0.06]' : 'border-good/30 bg-good/10'
                    }`}
                  >
                    {charged ? (
                      <>
                        <p className="font-semibold text-ink">To charge: {ugx(difference)}</p>
                        <p className="mt-0.5 text-xs text-ink/70">
                          {r.roomType} to {target.type}: {ugx(perNight)} a night × {nightsLeft} night
                          {nightsLeft === 1 ? '' : 's'} left. It goes on the folio as "Room upgrade" when you confirm.
                        </p>
                      </>
                    ) : higher ? (
                      <p className="font-semibold text-good">
                        Free upgrade to {target.type}. The guest keeps the {r.roomType} price.
                      </p>
                    ) : lower ? (
                      <p className="text-warn">
                        Room {target.number} is a {target.type}, lower than the booked {r.roomType}. The price does not change
                        here. If the guest should pay less, use Change stay after the move.
                      </p>
                    ) : (
                      <p className="font-semibold text-good">Same room type. Nothing changes on the folio.</p>
                    )}
                  </div>
                )}
              </section>

              <section>
                <p className={heading}>3 · Reason</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label="Reason for the move" required>
                    {(id) => (
                      <Select id={id} value={pickedReason} onChange={(e) => setReason(e.target.value)}>
                        {reasonList.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field
                    label="Note"
                    required={pickedReason === 'Other'}
                    hint={pickedReason === 'Other' ? undefined : 'Anything housekeeping or the next shift should know.'}
                    error={pickedReason === 'Other' && note.trim() === '' ? 'Say what the reason is.' : undefined}
                  >
                    {(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
                  </Field>
                </div>
                <p className="mt-2 text-xs text-ink/55">
                  The move is saved on the booking with your name, the time and this reason, and it prints on the guest's
                  receipt.
                </p>
              </section>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 p-4">
              <Button className="flex-1" onClick={confirm} disabled={!valid}>
                {target
                  ? charged
                    ? `Move to room ${target.number} and charge ${ugx(difference)}`
                    : `Move to room ${target.number}`
                  : 'Choose a room'}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
