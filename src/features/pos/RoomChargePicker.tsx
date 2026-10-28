import { TODAY } from '../../data/sample'
import { Select } from '../../components/ui'
import { useHotel } from '../../lib/hotelContext'
import type { FolioControl } from '../../services/pos/posTypes'
import { cash } from './posFormat'
import { checkRoomCharge } from './posRules'

// Pick the guest, and see at once whether the folio will take the charge and, if not, why.
export default function RoomChargePicker({
  reservationId,
  onChange,
  amount,
  category,
  controls,
}: {
  reservationId: string
  onChange: (id: string) => void
  amount: number
  category: string
  controls: FolioControl[]
}) {
  const { reservations } = useHotel()
  const inHouse = reservations.filter((r) => r.status === 'in-house').sort((a, b) => (a.room ?? '').localeCompare(b.room ?? ''))
  // Guests arriving or leaving today are listed too, so the cashier sees why they cannot be charged.
  const others = reservations.filter((r) => r.status !== 'in-house' && r.room && (r.arrival === TODAY || r.departure === TODAY || r.checkedOutAt?.startsWith(TODAY)))
  const selected = reservations.find((r) => r.id === reservationId)
  const result = selected ? checkRoomCharge(selected, reservations, amount, category, controls.find((c) => c.reservationId === selected.id)) : null

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold">
        Guest and room
        <Select value={reservationId} onChange={(e) => onChange(e.target.value)} className="mt-1.5 font-normal" aria-label="Guest to charge">
          <option value="">Choose an in-house guest…</option>
          <optgroup label="In house">
            {inHouse.map((r) => <option key={r.id} value={r.id}>Room {r.room} · {r.guest}</option>)}
          </optgroup>
          {others.length > 0 && (
            <optgroup label="Not in house">
              {others.map((r) => <option key={r.id} value={r.id}>Room {r.room} · {r.guest} ({r.status})</option>)}
            </optgroup>
          )}
        </Select>
      </label>
      {result && (result.ok ? (
        <div className="rounded-lg border border-good/30 bg-good/5 px-3 py-2 text-sm text-good" role="status">
          <p className="font-semibold">Folio open · charge allowed</p>
          <p className="text-xs text-ink/70">
            {result.routedTo ? `Routed to ${result.postTo.guest}, room ${result.postTo.room}. ` : ''}
            Balance after {cash(result.balanceAfter)} of {cash(result.limit)}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad" role="alert">
          <p className="font-semibold">Cannot charge to this room</p>
          <ul className="mt-1 list-disc pl-4 text-xs">
            {result.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}
