import { useMemo, useState } from 'react'
import { Badge, Button, DataTable, Modal } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { nightsBetween } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { proposeRooms, unassignedArrivals } from '../../lib/roomAssign'
import type { Proposal } from '../../lib/roomAssign'
import type { Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

type Row = { r: Reservation; p: Proposal }

/**
 * "Assign rooms for today's arrivals": the plan first, then one press. Nothing is assigned until the
 * desk has seen it, and a stay that already has a room is not in the plan at all.
 */
export function AssignRoomsDialog({ onClose }: { onClose: () => void }) {
  const { reservations, rooms, guests, assignRooms } = useHotel()
  const { user } = useAuth()
  const [done, setDone] = useState<number | null>(null)
  // The plan is worked out once, when the dialog opens, so it does not shift under the desk's eyes.
  const [rows] = useState<Row[]>(() => {
    const targets = unassignedArrivals(reservations, TODAY)
    const plan = proposeRooms({ reservations, rooms, guests, today: TODAY, targets })
    return plan.map((p) => ({ r: targets.find((x) => x.id === p.reservationId) as Reservation, p }))
  })
  const ready = rows.filter((x) => x.p.room)

  const columns: Column<Row>[] = [
    {
      key: 'guest',
      header: 'Guest',
      cell: ({ r }) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">{r.guest}</p>
          <p className="text-xs text-ink/55">
            {r.roomType} · {nightsBetween(r.arrival, r.departure)} night{nightsBetween(r.arrival, r.departure) === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room',
      cell: ({ p }) => (p.room ? <span className="text-lg font-bold text-ink">{p.room}</span> : <Badge tone="warn">None free</Badge>),
    },
    {
      key: 'why',
      header: 'Why',
      cell: ({ p }) => <span className="text-xs text-ink/70">{p.room ? p.parts.join(', ') : p.reason}</span>,
    },
  ]

  return (
    <Modal
      title="Assign rooms for today's arrivals"
      description="Nothing is assigned until you confirm. Chosen rooms stay."
      onClose={onClose}
      wide
      footer={
        done === null ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={ready.length === 0}
              onClick={() =>
                setDone(
                  assignRooms(
                    ready.map((x) => ({ reservationId: x.r.id, room: x.p.room as string, reason: x.p.reason })),
                    user?.name ?? 'Front desk',
                    false,
                  ),
                )
              }
            >
              Assign {ready.length} room{ready.length === 1 ? '' : 's'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )
      }
    >
      {done !== null ? (
        <p className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
          {done} room{done === 1 ? '' : 's'} assigned. You can still change them at check-in.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink/60">Every arrival today already has a room.</p>
      ) : (
        <div className="space-y-3">
          <DataTable columns={columns} rows={rows} rowKey={(x) => x.r.id} />
          <p className="text-xs text-ink/55">
            Order: VIPs, returning guests, longer stays, then first booked.
          </p>
        </div>
      )}
    </Modal>
  )
}

/** The button that opens it. Shown only when the hotel has the feature and somebody is still without a room. */
export default function AssignRoomsButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { reservations } = useHotel()
  const { features } = useFeatures()
  const [open, setOpen] = useState(false)
  const waiting = useMemo(() => unassignedArrivals(reservations, TODAY).length, [reservations])
  if (!features.roomAutoAssign || (waiting === 0 && !open)) return null
  return (
    <>
      <Button size={size} variant="secondary" onClick={() => setOpen(true)}>
        Assign rooms ({waiting})
      </Button>
      {open && <AssignRoomsDialog onClose={() => setOpen(false)} />}
    </>
  )
}
