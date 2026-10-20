import { useState } from 'react'
import { Badge } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { paymentMethods } from '../../lib/folio'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { partyBalance, partyLabel, partyOf, stillIn, waitingToCheckIn } from '../../lib/party'
import type { Reservation } from '../../types'
import { useAuth } from '../auth/authContext'

const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

const STATUS: Record<Reservation['status'], string> = {
  booked: 'Booked',
  'in-house': 'In house',
  'checked-out': 'Checked out',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
}

/**
 * The other rooms booked with this one. Each room is still its own booking; this is where the desk
 * sees them together, opens one, checks them in one after another, and settles them on one bill.
 */
export default function PartySection({
  r,
  onOpen,
  onCheckIn,
}: {
  r: Reservation
  onOpen: (id: string) => void
  /** Check these in, one after another. */
  onCheckIn: (ids: string[]) => void
}) {
  const { reservations, setPartyPayer, addPayment } = useHotel()
  const { user } = useAuth()
  const [method, setMethod] = useState(paymentMethods[0])
  const [settled, setSettled] = useState<string | null>(null)
  const party = partyOf(reservations, r)
  if (!r.party || party.length < 2) return null

  const live = party.filter(stillIn)
  const waiting = waitingToCheckIn(party, TODAY)
  const payer = party.find((x) => x.id === r.party?.payerId)
  const bill = partyBalance(party)
  const me = user?.name ?? 'Front desk'

  function settleAll() {
    // Simulated, like every payment in the prototype: each room in the house is paid off in full.
    for (const x of bill.inHouse) addPayment(x.id, { method, amount: x.total - x.paid, reference: `Party ${r.party?.id}, paid by ${payer?.guest ?? r.guest}` })
    setSettled(`${ugx(bill.owed)} taken by ${method} for ${bill.inHouse.length} room${bill.inHouse.length === 1 ? '' : 's'}.`)
  }

  return (
    <div>
      <p className={heading}>
        {partyLabel(live.length)} · {r.party.id}
      </p>
      <p className="mt-1 text-xs text-ink/60">Booked together by {r.party.booker}. Each room is its own booking with its own guest.</p>
      <ul className="mt-2 divide-y divide-ink/10 rounded-xl border border-ink/10 text-sm">
        {party.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="min-w-0">
              <span className={x.id === r.id ? 'font-semibold text-ink' : 'text-ink/80'}>{x.guest}</span>
              <span className="block text-xs text-ink/55">
                {x.id} · {x.roomType} · {x.room ? `Room ${x.room}` : 'room not assigned'}
                {x.total > x.paid && stillIn(x) ? ` · owes ${ugx(x.total - x.paid)}` : ''}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone={x.status === 'in-house' ? 'brand' : stillIn(x) ? 'neutral' : 'bad'}>{STATUS[x.status]}</Badge>
              {x.id === r.id ? (
                <span className="text-xs text-ink/50">This room</span>
              ) : (
                <button type="button" className="text-xs font-semibold text-brand" onClick={() => onOpen(x.id)}>
                  Open
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap gap-3">
        {waiting.length > 1 && (
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => onCheckIn(waiting.map((x) => x.id))}>
            Check in all {waiting.length} rooms, one after another
          </button>
        )}
        {payer ? (
          <button type="button" className="text-sm font-semibold text-ink/60" onClick={() => setPartyPayer(r.party!.id, null, me)}>
            Each room pays its own
          </button>
        ) : (
          live.length > 1 && (
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => setPartyPayer(r.party!.id, r.id, me)}>
              Put every room on {r.guest}'s bill
            </button>
          )
        )}
      </div>

      {payer && (
        <div className="mt-2 rounded-lg bg-canvas p-3 text-xs text-ink/70">
          <p>
            <b>One bill:</b> {payer.guest} ({payer.id}) pays for every room. Charges on the other rooms are sent to that bill; the room
            money stays on each room.
          </p>
          {settled ? (
            <p className="mt-2 font-semibold text-good">{settled}</p>
          ) : bill.owed > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Paid by" className="rounded-lg border border-ink/15 bg-surface px-2 py-1 text-xs">
                {paymentMethods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <button type="button" onClick={settleAll} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">
                Take {ugx(bill.owed)} for the {bill.inHouse.length} room{bill.inHouse.length === 1 ? '' : 's'} in the house
              </button>
              <span className="text-ink/50">Payment simulated.</span>
            </div>
          ) : (
            <p className="mt-1">
              {bill.all > 0 ? `${ugx(bill.all)} is still owed on rooms not yet in the house; it can be settled once they arrive.` : 'Nothing is owed on any room.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
