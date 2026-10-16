import { useState } from 'react'
import { Badge, Button } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { arrivalPlan } from '../../lib/arrival'
import { nowTime, readyEstimate } from '../../lib/stayTimes'
import { useHotel } from '../../lib/hotelContext'
import { floorLabel, floorOf } from '../../lib/rooms'
import type { Reservation } from '../../types'
import { cleanMinutes } from '../housekeeping/hkModel'
import { useFeatures } from '../platform/featuresContext'
import AskHousekeeping from './AskHousekeeping'
import { useFrontDesk } from './frontDeskContext'

// Shown for a guest arriving when no clean room of the booked type is free. It says why and offers what the desk can do:
// rush a dirty room, ask for an occupied one to be cleaned first, or give a free upgrade. No manager approval is needed.
export default function ArrivalRoomHelp({ reservation: r, force = false }: { reservation: Reservation; force?: boolean }) {
  const { rooms, reservations, upgradeStay } = useHotel()
  const { stayTimes } = useFeatures()
  const { createTask, now } = useFrontDesk()
  const [done, setDone] = useState<string | null>(null)
  const [taskMade, setTaskMade] = useState(false)
  const [luggageDone, setLuggageDone] = useState(false)
  const [moveMade, setMoveMade] = useState(false)

  if (r.status !== 'booked' || r.arrival > TODAY) return null
  const plan = arrivalPlan(r, rooms, reservations, TODAY)

  if (done) {
    return (
      <div className="rounded-lg border border-good/30 bg-good/10 p-3 text-sm font-semibold text-good">
        {done}
      </div>
    )
  }
  if (plan.state === 'ok' && !force) return null

  const why: string[] = []
  if (plan.outOfService.length) why.push(`${plan.outOfService.length} ${r.roomType} room${plan.outOfService.length === 1 ? ' is' : 's are'} out of service (${plan.outOfService.map((x) => x.number).join(', ')})`)
  if (plan.leaving.length) why.push(`${plan.leaving.map((x) => x.number).join(', ')} still ${plan.leaving.length === 1 ? 'has' : 'have'} a guest who leaves today`)
  if (plan.dirty.length) why.push(`${plan.dirty.length} ${plan.dirty.length === 1 ? 'is' : 'are'} dirty and can be rushed`)

  // What to tell a guest waiting in the lobby, with the earliest time each option is ready.
  const clock = nowTime()
  const mins = cleanMinutes[r.roomType] ?? 40
  const early = clock < stayTimes.checkInTime
  const tell: string[] = []
  if (plan.dirty.length > 0) tell.push(`Rush a dirty room now: ready about ${readyEstimate('dirty', stayTimes, mins, clock)}.`)
  if (plan.leaving.length > 0) tell.push(`Room ${plan.leaving[0].number} after check-out at ${stayTimes.checkOutTime}: ready about ${readyEstimate('leaving', stayTimes, mins, clock)}.`)
  if (plan.upgrades.length > 0) tell.push('Free upgrade: a clean higher room is ready now.')

  async function storeLuggage() {
    await createTask({
      title: `Store luggage for ${r.guest}`,
      description: `${r.id} is waiting in the lobby for a ${r.roomType} room. Tag the luggage and offer a seat and a drink.`,
      category: 'guest-request',
      priority: 'normal',
      dueAt: new Date(now + 15 * 60000).toISOString(),
      reservationId: r.id,
    })
    setLuggageDone(true)
  }

  async function moveToPartner() {
    await createTask({
      title: `Move ${r.guest} to ${stayTimes.partnerHotel}`,
      description: `${r.id} arrives today for a ${r.roomType} room. Nothing is usable and no upgrade is free. Book a room at ${stayTimes.partnerHotel}, arrange transport and tell the guest.`,
      category: 'arrival-prep',
      priority: 'urgent',
      dueAt: new Date(now + 60 * 60000).toISOString(),
      reservationId: r.id,
    })
    setMoveMade(true)
  }

  function upgrade(type: (typeof plan.upgrades)[number]['type'], room: string) {
    upgradeStay(r.id, type, room, `No ${r.roomType} room could be used on arrival.`)
    setDone(`Upgraded to ${type}, room ${room}. Free of charge, the total is unchanged.`)
  }

  async function findRoomTask() {
    await createTask({
      title: `Find a room for ${r.guest}`,
      description: `${r.id} arrives today for a ${r.roomType} room. None is usable and no upgrade is free. Find another room or move the guest to a partner hotel.`,
      category: 'arrival-prep',
      priority: 'urgent',
      dueAt: new Date(now + 60 * 60000).toISOString(),
      reservationId: r.id,
    })
    setTaskMade(true)
  }

  return (
    <div className="space-y-3 border-warn/30">
      <div>
        <p className="text-sm font-semibold text-warn">No clean {r.roomType} room is ready for this arrival.</p>
        {why.length > 0 && <p className="mt-0.5 text-xs text-ink/70">{why.join('. ')}.</p>}
      </div>

      <div className="rounded-lg border border-ink/10 bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Guest waiting? What to tell them</p>
          {luggageDone ? (
            <p className="text-xs font-semibold text-good">Luggage task created.</p>
          ) : (
            <Button size="sm" variant="secondary" onClick={storeLuggage}>
              Store luggage
            </Button>
          )}
        </div>
        {early && (
          <p className="mt-1 text-xs text-ink/70">
            Check-in time is {stayTimes.checkInTime}. Rule: early check-in is free when a clean room is ready; otherwise the
            guest waits. Offer a seat and a drink.
          </p>
        )}
        {tell.length > 0 ? (
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-ink/70">
            {tell.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-ink/70">No room of this type can be promised today. See the options below.</p>
        )}
      </div>

      {(plan.dirty.length > 0 || plan.leaving.length > 0 || force) && <AskHousekeeping roomType={r.roomType} room={undefined} />}

      {plan.upgrades.length > 0 && (
        <div className="rounded-lg border border-brand/25 bg-brand/[0.06] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Free upgrade</p>
            <Badge tone="good">No charge</Badge>
            <Badge>No approval needed</Badge>
          </div>
          <p className="mt-0.5 text-xs text-ink/60">Move the guest to a clean room of a higher type. The price stays at {r.roomType}.</p>
          <div className="mt-2 space-y-2">
            {plan.upgrades.map((u) => (
              <div key={u.type}>
                <p className="text-xs font-semibold text-ink/70">{u.type}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {u.rooms.slice(0, 4).map((x) => (
                    <Button key={x.number} size="sm" variant="secondary" onClick={() => upgrade(u.type, x.number)}>
                      Room {x.number} · {floorLabel(floorOf(x))}
                    </Button>
                  ))}
                  {u.rooms.length > 4 && <span className="self-center text-xs text-ink/55">and {u.rooms.length - 4} more</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.state === 'none' && (
        <div className="rounded-lg border border-bad/30 bg-bad/10 p-3">
          <p className="text-sm font-semibold text-bad">No room can be given right now</p>
          <p className="mt-0.5 text-xs text-ink/70">Nothing of this type can be rushed and no higher room is free. Find another room, or move the guest to a partner hotel.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {taskMade ? (
              <p className="text-xs font-semibold text-good">Task created for the front desk.</p>
            ) : (
              <Button size="sm" onClick={findRoomTask}>
                Create task: find a room
              </Button>
            )}
            {stayTimes.partnerHotel &&
              (moveMade ? (
                <p className="text-xs font-semibold text-good">Move task created.</p>
              ) : (
                <Button size="sm" variant="secondary" onClick={moveToPartner}>
                  Task: move to {stayTimes.partnerHotel}
                </Button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
