import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import type { Reservation } from '../../types'
import AmendPanel from './AmendPanel'

type Props = { reservation: Reservation; onClose: () => void; onCheckIn?: () => void }

export default function ReservationPanel({ reservation: r, onClose, onCheckIn }: Props) {
  const [amending, setAmending] = useState(false)
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

  const canChange = r.status === 'booked' || r.status === 'in-house'

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

      <div className="flex-1 overflow-y-auto p-4">
        <dl className="space-y-3 text-sm">
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

        {r.changes && r.changes.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Changes</p>
            <ul className="mt-2 space-y-2 text-sm">
              {r.changes.map((c, i) => (
                <li key={i} className="rounded-lg bg-canvas p-2">
                  <p className="font-medium">
                    {dayMonth(c.fromArrival)} to {dayMonth(c.fromDeparture)} → {dayMonth(c.toArrival)} to {dayMonth(c.toDeparture)}
                  </p>
                  <p className="text-xs text-ink/60">
                    {c.at} · {c.reason}
                    {c.fee > 0 && ` · fee ${ugx(c.fee)}`}
                    {c.waived && ' · fee waived'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(canChange || (r.status === 'booked' && onCheckIn)) && (
        <div className="flex gap-3 border-t border-ink/10 p-4">
          {canChange && (
            <button
              type="button"
              onClick={() => setAmending(true)}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold"
            >
              Change stay
            </button>
          )}
          {r.status === 'booked' && onCheckIn && (
            <button
              type="button"
              onClick={onCheckIn}
              className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Check in
            </button>
          )}
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

      {amending && (
        <AmendPanel reservation={r} onClose={() => setAmending(false)} onDone={onClose} />
      )}
    </div>
  )
}