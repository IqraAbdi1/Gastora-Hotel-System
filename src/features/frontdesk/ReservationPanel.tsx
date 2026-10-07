import { Link } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import type { Reservation } from '../../types'

type Props = { reservation: Reservation; onClose: () => void; onCheckIn?: () => void }

export default function ReservationPanel({ reservation: r, onClose, onCheckIn }: Props) {
  const balance = r.total - r.paid
  const rows = [
    ['Booking', r.id],
    ['Room', r.room ? `${r.room} (${r.roomType})` : `${r.roomType}, not assigned yet`],
    ['Arrival', dayMonth(r.arrival)],
    ['Departure', dayMonth(r.departure)],
    ['Nights', String(nightsBetween(r.arrival, r.departure))],
    ['Total', ugx(r.total)],
    ['Paid', ugx(r.paid)],
  ]

  if (r.details) {
    rows.push(
      ['ID', `${r.details.idType} ending ${r.details.idNumber.slice(-4)}`],
      ['Nationality', r.details.nationality],
      ['Phone', r.details.phone],
      ['Requests', r.details.specialRequests || 'None'],
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">{r.guest}</h2>
          <div className="mt-1">
            <StatusPill status={r.status} />
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      <dl className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-ink/60">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-ink/10 pt-3">
          <dt className="font-semibold">Balance</dt>
          <dd className={`font-bold ${balance > 0 ? 'text-bad' : 'text-good'}`}>{ugx(balance)}</dd>
        </div>
      </dl>

      {r.status === 'booked' && onCheckIn && (
        <div className="border-t border-ink/10 p-4">
          <button
            type="button"
            onClick={onCheckIn}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            Check in
          </button>
        </div>
      )}

      {r.status === 'in-house' && (
        <div className="border-t border-ink/10 p-4">
          <Link
            to="/desk/folios"
            className="block rounded-lg bg-brand px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Open folio
          </Link>
        </div>
      )}
    </div>
  )
}