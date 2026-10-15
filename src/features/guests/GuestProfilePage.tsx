import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import GuestEditPanel from './GuestEditPanel'

export default function GuestProfilePage() {
  const { guestId } = useParams()
  const { guests, reservations } = useHotel()
  const [editing, setEditing] = useState(false)

  const guest = guests.find((g) => g.id === guestId)

  if (!guest) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-brand">Guest not found</h1>
        <Link to="/guests" className="text-sm font-semibold text-brand">
          Back to guests
        </Link>
      </section>
    )
  }

  // A booking belongs to this guest by id. Older bookings with no id match on the exact name.
  const stays = reservations
    .filter((r) => (r.guestId ? r.guestId === guest.id : r.guest === guest.name))
    .sort((a, b) => b.arrival.localeCompare(a.arrival))

  const details: [string, string | undefined][] = [
    ['Phone', guest.phone],
    ['Email', guest.email],
    ['Nationality', guest.nationality],
    ['Date of birth', guest.dateOfBirth ? dayMonth(guest.dateOfBirth) : undefined],
    ['Gender', guest.gender],
    ['Address', guest.address],
    ['ID', guest.idNumber ? `${guest.idType ?? 'ID'} ending ${guest.idNumber.slice(-4)}` : undefined],
  ]

  return (
    <div className="max-w-3xl space-y-4">
      <Link to="/guests" className="text-sm font-semibold text-brand">
        Back to guests
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{guest.name}</h1>
          {guest.vip && (
            <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-warn">VIP</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-ink/15 bg-surface px-4 py-2 text-sm font-semibold"
        >
          Edit profile
        </button>
      </div>

      <section className="space-y-3 rounded-xl border border-ink/10 bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Details</p>
        <dl className="space-y-2 text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-ink/60">{label}</dt>
              <dd className="text-right font-medium">{value ?? '-'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3 rounded-xl border border-ink/10 bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Stays</p>
        {stays.length === 0 ? (
          <p className="text-sm text-ink/60">No bookings for this guest yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="py-2 pr-4">Booking</th>
                  <th className="py-2 pr-4">Room</th>
                  <th className="py-2 pr-4">Stay</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {stays.map((r) => {
                  const balance = r.total - r.paid
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4">{r.id}</td>
                      <td className="py-2 pr-4">{r.room ?? r.roomType}</td>
                      <td className="py-2 pr-4">
                        {dayMonth(r.arrival)} to {dayMonth(r.departure)}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusPill status={r.status} />
                      </td>
                      <td className={`py-2 text-right font-medium ${balance > 0 ? 'text-bad' : 'text-good'}`}>
                        {ugx(balance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <GuestEditPanel guest={guest} onClose={() => setEditing(false)} />}
    </div>
  )
}