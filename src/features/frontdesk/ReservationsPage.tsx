import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { Reservation } from '../../types'
import CheckInPanel from './CheckInPanel'
import ReservationPanel from './ReservationPanel'

const views = [
  { key: 'all', label: 'All' },
  { key: 'arrivals', label: 'Arrivals today' },
  { key: 'departures', label: 'Departures today' },
  { key: 'in-house', label: 'In house' },
]

function filterFor(view: string, list: Reservation[]) {
  if (view === 'arrivals') return list.filter((r) => r.status === 'booked' && r.arrival === TODAY)
  if (view === 'departures') return list.filter((r) => r.status === 'in-house' && r.departure === TODAY)
  if (view === 'in-house') return list.filter((r) => r.status === 'in-house')
  return list
}

export default function ReservationsPage() {
  const { reservations } = useHotel()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)

  const view = params.get('view') ?? 'all'
  const rows = filterFor(view, reservations)
  const selected = reservations.find((r) => r.id === selectedId) ?? null
  const checkingIn = reservations.find((r) => r.id === checkInId) ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reservations</h1>
        <p className="text-sm text-ink/60">Click a guest to see the booking without leaving this page.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setParams(v.key === 'all' ? {} : { view: v.key })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              view === v.key ? 'bg-brand text-white' : 'bg-surface text-ink/70 hover:bg-brand/10'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Stay</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {rows.map((r) => {
              const balance = r.total - r.paid
              return (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`cursor-pointer hover:bg-canvas ${selectedId === r.id ? 'bg-canvas' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setSelectedId(r.id)} className="font-semibold text-brand">
                      {r.guest}
                    </button>
                  </td>
                  <td className="px-4 py-3">{r.id}</td>
                  <td className="px-4 py-3">{r.room ?? r.roomType}</td>
                  <td className="px-4 py-3">
                    {dayMonth(r.arrival)} to {dayMonth(r.departure)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${balance > 0 ? 'text-bad' : 'text-good'}`}>
                    {ugx(balance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-ink/60">No reservations match this filter.</p>}
      </div>

      {selected && (
        <ReservationPanel
          reservation={selected}
          onClose={() => setSelectedId(null)}
          onCheckIn={() => setCheckInId(selected.id)}
        />
      )}
      {checkingIn && <CheckInPanel reservation={checkingIn} onClose={() => setCheckInId(null)} />}
    </div>
  )
}