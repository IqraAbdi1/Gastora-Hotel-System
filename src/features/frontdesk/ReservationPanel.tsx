import { useState } from 'react'
import { Link } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { TODAY } from '../../data/sample'
import { guarantees } from '../../data/rates'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { planFor } from '../../lib/booking'
import type { CancelMode } from '../../lib/cancel'
import type { Reservation } from '../../types'
import AmendPanel from './AmendPanel'
import CancelPanel from './CancelPanel'

type Props = { reservation: Reservation; onClose: () => void; onCheckIn?: () => void }

const sourceLabel = {
  'walk-in': 'Walk-in',
  'front desk': 'Front desk',
  phone: 'Phone',
  email: 'Email',
  online: 'Online',
  ota: 'OTA',
}

const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

export default function ReservationPanel({ reservation: r, onClose, onCheckIn }: Props) {
  const [amending, setAmending] = useState(false)
  const [cancelMode, setCancelMode] = useState<CancelMode | null>(null)
  const [showPhoto, setShowPhoto] = useState(false)
  const balance = r.total - r.paid

  const rows: string[][] = [
    ['Booking', r.id],
    ['Booked via', r.source ? sourceLabel[r.source] : 'Not recorded'],
    ['Room', r.room ? `${r.room} (${r.roomType})` : `${r.roomType}, not assigned yet`],
    ['Arrival', dayMonth(r.arrival)],
    ['Departure', dayMonth(r.departure)],
    ['Nights', String(nightsBetween(r.arrival, r.departure))],
  ]
  if (r.plan) rows.push(['Rate plan', planFor(r.plan).name])
  if (r.guarantee) rows.push(['Guarantee', guarantees.find((g) => g.key === r.guarantee)?.label ?? r.guarantee])
  if (r.adults !== undefined) rows.push(['Guests', `${r.adults} adult${r.adults === 1 ? '' : 's'}${r.children ? `, ${r.children} child${r.children === 1 ? '' : 'ren'}` : ''}`])
  rows.push(['Total', ugx(r.total)], ['Paid', ugx(r.paid)])

  const d = r.details
  const guestRows: string[][] = []
  if (d) {
    guestRows.push(
      ['ID', `${d.idType} ending ${d.idNumber.slice(-4)}`],
      ['Nationality', d.nationality],
      ['Phone', d.phone],
    )
    if (d.idExpiry) guestRows.push(['ID expiry', d.idExpiry])
    if (d.dateOfBirth) guestRows.push(['Date of birth', d.dateOfBirth])
    if (d.purpose) guestRows.push(['Purpose', d.purpose])
    if (d.vehiclePlate) guestRows.push(['Vehicle', d.vehiclePlate])
    if (d.emergencyName) guestRows.push(['Emergency contact', `${d.emergencyName} ${d.emergencyPhone ?? ''}`.trim()])
    guestRows.push(['Requests', d.specialRequests || 'None'])
  }

  const isBooked = r.status === 'booked'
  const canChange = isBooked || r.status === 'in-house'
  const c = r.cancellation

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

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
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

        {c && (
          <div>
            <p className={heading}>{c.kind === 'no-show' ? 'No-show' : 'Cancellation'}</p>
            <dl className="mt-2 space-y-2 text-sm">
              {[
                ['When', c.at],
                ['Reason', c.reason],
                ['Charge', c.waived ? 'Waived' : ugx(c.charge)],
                ['Refund (simulated)', ugx(c.refund)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink/60">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {d && (
          <div>
            <p className={heading}>Guest details</p>
            <dl className="mt-2 space-y-2 text-sm">
              {guestRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink/60">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {(d.idPhoto || d.signature) && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowPhoto((s) => !s)}
                  className="text-sm font-semibold text-brand"
                >
                  {showPhoto ? 'Hide ID photo and signature' : 'Show ID photo and signature'}
                </button>
                {showPhoto && (
                  <div className="mt-2 space-y-3">
                    {d.idPhoto && <img src={d.idPhoto} alt="Guest ID" className="max-h-56 rounded-lg border border-ink/10" />}
                    {d.signature && (
                      <img src={d.signature} alt="Guest signature" className="max-h-24 rounded-lg border border-ink/10 bg-white" />
                    )}
                    <p className="text-xs text-ink/60">Personal data. In the real system only authorised staff can open this.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {r.changes && r.changes.length > 0 && (
          <div>
            <p className={heading}>Changes</p>
            <ul className="mt-2 space-y-2 text-sm">
              {r.changes.map((ch, i) => (
                <li key={i} className="rounded-lg bg-canvas p-2">
                  <p className="font-medium">
                    {dayMonth(ch.fromArrival)} to {dayMonth(ch.fromDeparture)} → {dayMonth(ch.toArrival)} to {dayMonth(ch.toDeparture)}
                  </p>
                  <p className="text-xs text-ink/60">
                    {ch.at} · {ch.reason}
                    {ch.fee > 0 && ` · fee ${ugx(ch.fee)}`}
                    {ch.waived && ' · fee waived'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(canChange || (isBooked && onCheckIn)) && (
        <div className="flex flex-wrap gap-3 border-t border-ink/10 p-4">
          {isBooked && onCheckIn && (
            <button
              type="button"
              onClick={onCheckIn}
              className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            >
              Check in
            </button>
          )}
          {canChange && (
            <button
              type="button"
              onClick={() => setAmending(true)}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold"
            >
              Change stay
            </button>
          )}
          {isBooked && (
            <button
              type="button"
              onClick={() => setCancelMode('cancel')}
              className="rounded-lg border border-bad/40 px-4 py-2 text-sm font-semibold text-bad"
            >
              Cancel
            </button>
          )}
          {isBooked && r.arrival <= TODAY && (
            <button
              type="button"
              onClick={() => setCancelMode('no-show')}
              className="rounded-lg border border-bad/40 px-4 py-2 text-sm font-semibold text-bad"
            >
              No-show
            </button>
          )}
        </div>
      )}

            {(r.status === 'in-house' || r.status === 'checked-out') && (
        <div className="border-t border-ink/10 p-4">
          <Link
            to={`/desk/folios?view=${r.status === 'in-house' ? 'inhouse' : 'out'}&r=${r.id}`}
            className="block rounded-lg bg-brand px-4 py-2 text-center text-sm font-semibold text-white"
          >
            {r.status === 'in-house' ? 'Open folio' : 'View folio and invoice'}
          </Link>
        </div>
      )}

      {amending && <AmendPanel reservation={r} onClose={() => setAmending(false)} onDone={onClose} />}
      {cancelMode && (
        <CancelPanel reservation={r} mode={cancelMode} onClose={() => setCancelMode(null)} onDone={onClose} />
      )}
    </div>
  )
}