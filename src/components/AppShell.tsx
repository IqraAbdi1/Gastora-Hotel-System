import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import CommandBar from './CommandBar'
import DraftPanel from './DraftPanel'
import BookingPanel from './BookingPanel'
import { DraftContext } from '../lib/draftContext'
import { BookingContext } from '../lib/bookingContext'
import type { BookingPreset } from '../lib/bookingContext'
import type { DraftAction } from '../types'

const sections = [
  {
    title: 'Overview',
    links: [{ to: '/dashboard', label: 'Dashboard', end: true }],
  },
  {
    title: 'Front desk',
    links: [
      { to: '/desk', label: 'Today', end: true },
      { to: '/desk/reservations', label: 'Reservations' },
      { to: '/desk/rooms', label: 'Rooms' },
      { to: '/desk/folios', label: 'Folios' },
    ],
  },
  {
    title: 'Operations',
    links: [
      { to: '/housekeeping', label: 'Housekeeping' },
      { to: '/pos', label: 'POS' },
      { to: '/inventory', label: 'Inventory' },
    ],
  },
  {
    title: 'Business',
    links: [
      { to: '/finance', label: 'Finance' },
      { to: '/manager', label: 'Manager' },
    ],
  },
  {
    title: 'Portals',
    links: [
      { to: '/guest', label: 'Guest portal' },
      { to: '/admin', label: 'Platform admin' },
    ],
  },
]

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [draft, setDraft] = useState<DraftAction | null>(null)
  const [booking, setBooking] = useState<BookingPreset | null>(null)

  return (
    <DraftContext.Provider value={{ openDraft: setDraft }}>
      <BookingContext.Provider value={{ openBooking: (preset) => setBooking(preset ?? {}) }}>
        <div className="flex min-h-screen flex-col bg-canvas text-ink md:flex-row">
          <aside
            className={`bg-sidebar p-4 text-white transition-all md:shrink-0 ${
              collapsed ? 'md:w-16 md:px-2' : 'md:w-60'
            }`}
          >
            <div className={`mb-6 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
              {!collapsed && (
                <div>
                  <p className="text-xl font-bold">Gastora</p>
                  <p className="text-xs text-white/60">Sample Hotel</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="rounded-lg px-2 py-1 text-lg text-white/70 hover:bg-white/10 hover:text-white"
              >
                {collapsed ? '»' : '«'}
              </button>
            </div>
            <nav className={collapsed ? 'hidden space-y-5 md:block' : 'space-y-5'}>
              {sections.map((s) => (
                <div key={s.title}>
                  {!collapsed && (
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-white/50">{s.title}</p>
                  )}
                  <div className="space-y-0.5">
                    {s.links.map((l) => (
                      <NavLink
                        key={l.to}
                        to={l.to}
                        end={l.end}
                        title={l.label}
                        className={({ isActive }) =>
                          `block rounded-lg px-3 py-2 text-sm font-medium ${collapsed ? 'text-center' : ''} ${
                            isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        {collapsed ? l.label[0] : l.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex flex-wrap items-center gap-3 border-b border-ink/10 bg-surface px-6 py-3">
              <CommandBar />
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setBooking({})}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                >
                  New booking
                </button>
                <button
                  type="button"
                  onClick={() => setBooking({ walkin: true })}
                  className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand"
                >
                  Walk-in
                </button>
              </div>
            </header>
            <main className="flex-1 p-6">
              <Outlet />
            </main>
          </div>

          {draft && <DraftPanel key={draft.title} draft={draft} onClose={() => setDraft(null)} />}
          {booking && <BookingPanel preset={booking} onClose={() => setBooking(null)} />}
        </div>
      </BookingContext.Provider>
    </DraftContext.Provider>
  )
}