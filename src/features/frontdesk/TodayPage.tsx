import { useState } from 'react'
import ActionButtons from '../../components/ActionButtons'
import KpiCard from '../../components/KpiCard'
import { aiSamples } from '../../data/assistant'
import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { buildRuleSuggestions } from '../../lib/rules'
import CheckInPanel from './CheckInPanel'

export default function TodayPage() {
  const { reservations, rooms } = useHotel()
  const [checkInId, setCheckInId] = useState<string | null>(null)

  const arrivals = reservations.filter((r) => r.status === 'booked' && r.arrival === TODAY)
  const departures = reservations.filter((r) => r.status === 'in-house' && r.departure === TODAY)
  const inHouse = reservations.filter((r) => r.status === 'in-house')
  const toClean = rooms.filter((r) => r.status === 'dirty')
  const unpaid = inHouse.filter((r) => r.total > r.paid)
  const sellable = rooms.filter((r) => r.status !== 'blocked').length
  const occupied = rooms.filter((r) => r.status === 'occupied').length
  const occupancy = Math.round((occupied / sellable) * 100)
  const items = [...buildRuleSuggestions(reservations, rooms), ...aiSamples]
  const checkingIn = reservations.find((r) => r.id === checkInId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-ink/60">Wednesday 7 October 2026</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Arrivals" value={arrivals.length} hint="View arrivals" to="/desk/reservations?view=arrivals" />
        <KpiCard label="Departures" value={departures.length} hint="View departures" to="/desk/reservations?view=departures" />
        <KpiCard label="In house" value={inHouse.length} hint="View guests" to="/desk/reservations?view=in-house" />
        <KpiCard label="Occupancy" value={`${occupancy}%`} hint={`${occupied} of ${sellable} rooms`} to="/desk/rooms" />
        <KpiCard label="Rooms to clean" value={toClean.length} hint="Open housekeeping" to="/housekeeping" tone="warn" />
        <KpiCard label="Unpaid balances" value={unpaid.length} hint="Open folios" to="/desk/folios" tone="bad" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-ink/10 bg-surface p-4 lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Arrivals today</h2>
          {arrivals.length === 0 && <p className="text-sm text-ink/60">Everyone expected today has checked in.</p>}
          <ul className="divide-y divide-ink/10">
            {arrivals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{r.guest}</p>
                  <p className="text-sm text-ink/60">
                    {r.id} · {r.roomType}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.paid > 0 ? (
                    <span className="rounded-full bg-good/10 px-3 py-1 text-xs font-semibold text-good">
                      Deposit {ugx(r.paid)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">No deposit</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCheckInId(r.id)}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    Check in
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-ink/10 bg-surface p-4">
          <h2 className="text-lg font-semibold">Suggestions</h2>
          <p className="mb-3 text-xs text-ink/60">Rule: calculated from the data. AI (sample): preview only.</p>
          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.text} className="rounded-lg bg-canvas p-3 text-sm">
                <span
                  className={`mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    s.source === 'rule' ? 'bg-brand/10 text-brand' : 'bg-accent/15 text-warn'
                  }`}
                >
                  {s.source === 'rule' ? 'Rule' : 'AI (sample)'}
                </span>
                <p>{s.text}</p>
                <ActionButtons actions={s.actions} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {checkingIn && <CheckInPanel reservation={checkingIn} onClose={() => setCheckInId(null)} />}
    </div>
  )
}