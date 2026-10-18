import { useState } from 'react'
import { Badge, Button, Input, Modal } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { nightlyRate } from '../../lib/rates'
import {
  BILLING_LABEL,
  BILLING_NOTE,
  STATUS_LABEL,
  STATUS_TONE,
  agentMargin,
  blockCounts,
  hasMaster,
  inBlock,
  masterBill,
  pastCutOff,
  rateFor,
} from '../../lib/groups'
import type { GroupBlock } from '../../lib/groups'
import { splitFolio } from '../../lib/folioSplit'
import { useCorporate } from '../corporate/corporateContext'
import { useFeatures } from '../platform/featuresContext'
import { useGroups } from './groupsContext'
import type { Reservation } from '../../types'

const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

// One block: who is in it, who is paying for what, and which rooms still have nobody's name on them.
export default function GroupPanel({ block, onClose }: { block: GroupBlock; onClose: () => void }) {
  const { reservations, nameGroupRoom, releaseRoom } = useHotel()
  const { setStatus } = useGroups()
  const { byId } = useCorporate()
  const { options } = useFeatures()
  const [naming, setNaming] = useState<Reservation | null>(null)

  const rooms = inBlock(reservations, block.id)
  const counts = blockCounts(reservations, block.id)
  const nights = Math.max(1, nightsBetween(block.arrival, block.departure))
  const linked = block.accountId ?? block.agentId
  const account = linked ? byId(linked) : undefined
  const overdue = pastCutOff(block, reservations, TODAY)
  const bill = masterBill(
    block,
    reservations,
    (r, b) => splitFolio(r, account?.name, b),
    (type) => nightlyRate(type, 0, options.rates),
  )

  const value = rooms
    .filter((r) => r.status !== 'cancelled' && r.status !== 'no-show')
    .reduce((sum, r) => sum + rateFor(block, r.roomType, nightlyRate(r.roomType, 0, options.rates)) * nights, 0)

  return (
    <Modal
      title={block.name}
      description={`${block.code} · ${dayMonth(block.arrival)} to ${dayMonth(block.departure)} · ${nights} night(s)`}
      onClose={onClose}
      side
      wide
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[block.status]} dot>
            {STATUS_LABEL[block.status]}
          </Badge>
          <Badge tone="neutral">{BILLING_LABEL[block.billing]}</Badge>
          {block.status === 'held' && (
            <Button size="sm" variant="secondary" onClick={() => setStatus(block.id, 'confirmed')}>
              Confirm the block
            </Button>
          )}
        </div>

        <div>
          <p className={heading}>Who pays</p>
          <p className="mt-1 text-sm text-ink/75">{BILLING_NOTE[block.billing]}</p>
          {account && <p className="mt-1 text-sm text-ink/75">Invoiced to {account.name}.</p>}
          {hasMaster(block.billing) && (
            <p className="mt-1 text-xs text-ink/60">
              On the organiser's bill: {block.covers.join(', ') || 'nothing yet'}. Everything else is settled by the guest at the desk.
            </p>
          )}
        </div>

        <div>
          <p className={heading}>The rooms</p>
          <dl className="mt-1 space-y-1 text-sm">
            {block.rooms.map((line) => {
              const rack = nightlyRate(line.type, 0, options.rates)
              const rate = rateFor(block, line.type, rack)
              const margin = agentMargin(block, line.type, rack)
              return (
                <div key={line.type} className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink/65">
                    {line.count} × {line.type}
                  </dt>
                  <dd className="text-right tabular-nums text-ink/80">
                    {ugx(rate)} a night
                    {rate !== rack && <span className="ml-1 text-xs text-ink/50">(rack {ugx(rack)})</span>}
                    {block.billing === 'agent-net' && block.net[line.type] !== undefined && (
                      <span className="ml-2 rounded bg-warn/10 px-1.5 py-0.5 text-xs font-semibold text-warn">
                        net {ugx(block.net[line.type] as number)} · agent keeps {ugx(margin)}
                      </span>
                    )}
                  </dd>
                </div>
              )
            })}
            <div className="border-t border-ink/10 pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold text-ink">Rooms held, {nights} night(s)</dt>
                <dd className="font-bold tabular-nums text-ink">{ugx(value)}</dd>
              </div>
            </div>
          </dl>
          {block.billing === 'agent-net' && (
            <p className="mt-1 text-xs text-warn">Net rates are staff-only. Nothing the guest is given shows them.</p>
          )}
        </div>

        {overdue.length > 0 && (
          <div className="rounded-xl bg-warn/[0.08] p-3">
            <p className="text-sm font-semibold text-ink">
              {overdue.length} room(s) still have no name, and names were due by {dayMonth(block.cutOff as string)}
            </p>
            <p className="mt-0.5 text-xs text-ink/70">The hotel can take these back and sell them to somebody else.</p>
            <div className="mt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  for (const r of overdue) releaseRoom(r.id, 'Front desk', false, `Names were due by ${block.cutOff}`)
                }}
              >
                Put {overdue.length} room(s) back on sale
              </Button>
            </div>
          </div>
        )}

        {hasMaster(block.billing) && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className={heading}>{block.billing === 'agent-net' ? "The agent's bill" : "The organiser's bill"}</p>
              <span className="text-xs text-ink/60">One invoice for the block</span>
            </div>
            <dl className="mt-1 space-y-1 text-sm">
              {bill.lines.map((l) => (
                <div key={l.reservationId} className="flex items-baseline justify-between gap-3">
                  <dt className="min-w-0 truncate text-ink/65">
                    {l.guest}
                    {l.room ? ` · Room ${l.room}` : ''}
                  </dt>
                  <dd className="shrink-0 text-right tabular-nums text-ink/80">
                    {ugx(l.master)}
                    {l.guest_ > 0 && <span className="ml-2 text-xs text-ink/50">guest {ugx(l.guest_)}</span>}
                  </dd>
                </div>
              ))}
              <div className="border-t border-ink/10 pt-1">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold text-ink">To invoice {account ? account.name : 'the organiser'}</dt>
                  <dd className="font-bold tabular-nums text-ink">{ugx(bill.masterTotal)}</dd>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-ink/60">
                  <dt>Settled by guests at the desk</dt>
                  <dd className="tabular-nums">{ugx(bill.guestTotal)}</dd>
                </div>
                {block.billing === 'agent-net' && bill.net !== undefined && (
                  <div className="mt-1 rounded-lg bg-warn/[0.08] p-2 text-xs text-ink/75">
                    Staff only: the hotel receives {ugx(bill.net)} and the agent keeps {ugx(bill.margin ?? 0)}. Nothing the guest is given
                    shows either figure.
                  </div>
                )}
              </div>
            </dl>
            <p className="mt-1 text-xs text-ink/55">
              The guest column is what each person settles for themselves before they leave, whatever the organiser is paying.
            </p>
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={heading}>Rooming list</p>
            <span className="text-xs text-ink/60">
              {counts.named} of {counts.held} named · {counts.arrived} arrived · {counts.left} left
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {rooms.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className={r.group?.named ? 'font-medium text-ink' : 'text-ink/50'}>{r.guest}</span>
                  <span className="ml-2 text-xs text-ink/55">
                    {r.roomType}
                    {r.room ? ` · Room ${r.room}` : ''} · {r.status}
                    {r.details?.phone ? ` · ${r.details.phone}` : ''}
                  </span>
                </div>
                {r.status === 'booked' && (
                  <Button size="sm" variant="ghost" onClick={() => setNaming(r)}>
                    {r.group?.named ? 'Change the name' : 'Put a name to it'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink/55">
            Names can be filled in days ahead from the organiser's list, or one at a time as people walk up to the desk. A room with nobody's
            name on it is still a room out of inventory.
          </p>
        </div>

        {block.note && (
          <div>
            <p className={heading}>Note</p>
            <p className="mt-1 text-sm text-ink/75">{block.note}</p>
          </div>
        )}
      </div>

      {naming && (
        <NameDialog
          reservation={naming}
          onClose={() => setNaming(null)}
          onSave={(guest, phone) => {
            nameGroupRoom(naming.id, guest, phone)
            setNaming(null)
          }}
        />
      )}
    </Modal>
  )
}

function NameDialog({
  reservation,
  onClose,
  onSave,
}: {
  reservation: Reservation
  onClose: () => void
  onSave: (guest: string, phone: string) => void
}) {
  const [guest, setGuest] = useState(reservation.group?.named ? reservation.guest : '')
  const [phone, setPhone] = useState(reservation.details?.phone ?? '')
  return (
    <Modal
      title="Who is in this room?"
      description={`${reservation.roomType} · ${dayMonth(reservation.arrival)} to ${dayMonth(reservation.departure)}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={guest.trim().length < 2} onClick={() => onSave(guest, phone)}>
            Save the name
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-ink/80" htmlFor="group-guest">
            Guest name
          </label>
          <Input id="group-guest" className="mt-1" value={guest} onChange={(e) => setGuest(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-ink/80" htmlFor="group-phone">
            Phone
          </label>
          <Input id="group-phone" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <p className="mt-3 text-xs text-ink/55">
        This becomes an ordinary booking in the guest's own name, still part of the block. Check-in is the same as any other arrival.
      </p>
    </Modal>
  )
}
