import { useMemo, useState } from 'react'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { isRoomFree } from '../../lib/availability'
import { dayMonth } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { Reservation, Room } from '../../types'

const types: Room['type'][] = ['Standard', 'Deluxe', 'Suite']

// One stay across two rooms: the guest moves on a date the hotel plans now, rather than being moved
// on the morning with no warning.
export default function SplitStayDialog({
  reservation: r,
  onClose,
  onSplit,
}: {
  reservation: Reservation
  onClose: () => void
  onSplit: (fromDate: string, type: Room['type'], room: string | null) => void
}) {
  const { rooms, reservations } = useHotel()
  const [date, setDate] = useState('')
  const [type, setType] = useState<Room['type']>(r.roomType)
  const [room, setRoom] = useState('')

  const free = useMemo(
    () => (date ? rooms.filter((x) => x.type === type && isRoomFree(x, date, r.departure, reservations, r.id)) : []),
    [date, reservations, r.departure, r.id, rooms, type],
  )
  const ok = date > r.arrival && date < r.departure

  return (
    <Modal
      title="Move rooms part-way through"
      description={`${r.guest} · ${dayMonth(r.arrival)} to ${dayMonth(r.departure)}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ok} onClick={() => onSplit(date, type, room || null)}>
            Plan the move
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Moves on" required hint="The night they first sleep in the new room">
          {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} min={r.arrival} max={r.departure} />}
        </Field>
        <Field label="Into a">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as Room['type'])}>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Room" hint={date ? `${free.length} free for the rest of the stay` : 'Choose the date first'}>
          {(id) => (
            <Select id={id} value={room} onChange={(e) => setRoom(e.target.value)} disabled={!date}>
              <option value="">Assign later</option>
              {free.map((x) => (
                <option key={x.number} value={x.number}>
                  Room {x.number}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <p className="mt-3 text-xs text-ink/55">
        The stay becomes two bookings end to end, which is what it is: each room is counted only on the nights it is actually used, and the
        guest's bill for each part stands on its own.
      </p>
    </Modal>
  )
}
