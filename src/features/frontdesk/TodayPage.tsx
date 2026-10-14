import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButtons from '../../components/ActionButtons'
import KpiCard from '../../components/KpiCard'
import { aiSamples } from '../../data/assistant'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { buildRuleSuggestions } from '../../lib/rules'
import { useHousekeeping } from '../housekeeping/hkContext'
import CheckInPanel from './CheckInPanel'
import ShortageBanner from '../housekeeping/ShortageBanner'
export default function TodayPage() {
  const { reservations, rooms } = useHotel()
  const { readyRooms, dismissReady } = useHousekeeping()
  const [checkIn, setCheckIn] = useState<{ id: string; room?: string } | null>(null)

  const arrivals = reservations.filter((r) => r.status === 'booked' && r.arrival === TODAY)
  const departures = reservations.filter((r) => r.status === 'in-house' && r.departure === TODAY)
  // Guests due out today, or who should already have left, in room order
  const leaving = reservations
    .filter((r) => r.status === 'in-house' && r.departure <= TODAY)
    .sort((a, b) => Number(a.room) - Number(b.room))
  const inHouse = reservations.filter((r) => r.status === 'in-house')
  const toClean = rooms.filter((r) => r.status === 'dirty')
  const unpaid = inHouse.filter((r) => r.total > r.paid)
  const sellable = rooms.filter((r) => r.status !== 'blocked').length
  const occupied = rooms.filter((r) => r.status === 'occupied').length
  const occupancy = Math.round((occupied / sellable) * 100)
  const items = [...buildRuleSuggestions(reservations, rooms), ...aiSamples]
  const checkingIn = reservations.find((r) => r.id === checkIn?.id) ?? null
  const todayLabel = new Date(`${TODAY}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-ink/60">{todayLabel}</p>
      </div>

      {readyRooms.map((ready) => {
        const guest = arrivals.find((g) => g.roomType === ready.type && (!g.room || g.room === ready.room))
        return (
          <div
            key={ready.room}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-good/30 bg-good/10 p-4"
          >
            <div>
              <p className="font-semibold text-good">Room {ready.room} is ready</p>
              <p className="text-sm text-ink/70">
                Housekeeping finished at {ready.time}.{' '}
                {guest ? `${guest.guest} is waiting for a ${guest.roomType} room.` : 'No guest is waiting for this room type.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {guest && (
                <button
                  type="button"
                  onClick={() => setCheckIn({ id: guest.id, room: ready.room })}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                >
                  Check in {guest.guest.split(' ')[0]}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissReady(ready.room)}
                className="text-sm font-semibold text-ink/60 hover:text-ink"
              >
                Dismiss
              </button>
            </div>
          </div>
        )
      })}
      <ShortageBanner />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Arrivals" value={arrivals.length} hint="View arrivals" to="/desk/reservations?view=arrivals" />
        <KpiCard label="Departures" value={departures.length} hint="View departures" to="/desk/reservations?view=departures" />
        <KpiCard label="In house" value={inHouse.length} hint="View guests" to="/desk/reservations?view=in-house" />
        <KpiCard label="Occupancy" value={`${occupancy}%`} hint={`${occupied} of ${sellable} rooms`} to="/desk/rooms" />
        <KpiCard label="Rooms to clean" value={toClean.length} hint="Open housekeeping" to="/housekeeping" tone="warn" />
        <KpiCard label="Unpaid balances" value={unpaid.length} hint="Open folios" to="/desk/folios" tone="bad" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-ink/10 bg-surface p-4">
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
                      onClick={() => setCheckIn({ id: r.id })}
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
            <h2 className="mb-3 text-lg font-semibold">Departures today</h2>
            {leaving.length === 0 && <p className="text-sm text-ink/60">No one is due to leave today.</p>}
            <ul className="divide-y divide-ink/10">
              {leaving.slice(0, 8).map((r) => {
                const owes = r.total - r.paid
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold">{r.guest}</p>
                      <p className="text-sm text-ink/60">
                        Room {r.room} · {r.id}
                        {r.departure < TODAY && <span className="text-warn"> · was due {dayMonth(r.departure)}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {owes > 0 ? (
                        <span className="rounded-full bg-bad/10 px-3 py-1 text-xs font-semibold text-bad">Owes {ugx(owes)}</span>
                      ) : (
                        <span className="rounded-full bg-good/10 px-3 py-1 text-xs font-semibold text-good">Settled</span>
                      )}
                      <Link
                        to={`/desk/folios?view=leaving&r=${r.id}`}
                        className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand"
                      >
                        Check out
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
            {leaving.length > 8 && (
              <Link to="/desk/folios?view=leaving" className="mt-3 inline-block text-sm font-semibold text-brand">
                See all {leaving.length} departures
              </Link>
            )}
          </section>
        </div>

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

      {checkingIn && <CheckInPanel reservation={checkingIn} room={checkIn?.room} onClose={() => setCheckIn(null)} />}
    </div>
  )
}