import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import CommandBar from './CommandBar'
import DraftPanel from './DraftPanel'
import BookingPanel from './BookingPanel'
import NavBadge from './NavBadge'
import NavIcon from './NavIcon'
import { useAuth } from '../features/auth/authContext'
import { useFeatures } from '../features/platform/featuresContext'
import HousekeepingBar from '../features/housekeeping/HousekeepingBar'
import { DraftContext } from '../lib/draftContext'
import { BookingContext } from '../lib/bookingContext'
import type { BookingPreset } from '../lib/bookingContext'
import { moduleOf, otherApps, visibleModules } from '../lib/nav'
import type { NavModule, NavPage } from '../lib/nav'
import { ROLES, roleById } from '../lib/roles'
import type { RoleId } from '../lib/roles'
import type { DraftAction } from '../types'

const childClass = (isActive: boolean) =>
  `flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
  }`

// The small icon in front of a page name. If any page in the group has one, the others get an
// empty space of the same size so the names stay lined up.
function PageIcon({ m, p }: { m: NavModule; p: NavPage }) {
  if (!m.pages.some((x) => x.icon)) return null
  return p.icon ? (
    <NavIcon name={p.icon} className="mr-2 h-4 w-4 shrink-0" />
  ) : (
    <span className="mr-2 inline-block h-4 w-4 shrink-0" />
  )
}

// Nobody gets in without signing in.
export default function AppShell() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Shell />
}

function Shell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [draft, setDraft] = useState<DraftAction | null>(null)
  const [booking, setBooking] = useState<BookingPreset | null>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { tenant, features } = useFeatures()
  const { user, role, actualRole, viewAs, isViewingAs, canOpen, setViewAs, logout } = useAuth()
  const inHousekeeping = pathname.startsWith('/housekeeping')
  const allowedModules = visibleModules(features, canOpen)
  const landingId = role ? moduleOf(role.landing)?.id : undefined
  // The module the person lives in goes first.
  const modules = [...allowedModules].sort((a, b) => Number(b.id === landingId) - Number(a.id === landingId))
  const totalPages = modules.reduce((n, m) => n + m.pages.length, 0)
  // Rule: few pages stand on their own, a few modules stay open, many modules fold.
  const layout: 'flat' | 'open' | 'accordion' =
    totalPages <= 8 ? 'flat' : modules.length <= 3 ? 'open' : 'accordion'
  const [folded, setFolded] = useState<string[]>([])
  const apps = otherApps.filter((a) => canOpen(a.to))

  // One module open at a time. The module you are in opens by itself. A choice you make by hand
  // only lasts while you stay in that module, so moving elsewhere opens the right group again.
  const current = moduleOf(pathname)?.id
  // The search and booking buttons belong to the front desk, so other modules do not carry them.
  const showDeskBar = current === 'overview' || current === 'frontdesk'
  const [manual, setManual] = useState<{ at?: string; id: string | null } | null>(null)
  const openId = manual && manual.at === current ? manual.id : current

  // A page the role cannot open shows a message. Unknown paths are left to the router's "not found".
  const known = !!moduleOf(pathname) || pathname.startsWith('/guest') || pathname.startsWith('/platform')
  const allowed = !known || canOpen(pathname)

  function select(m: NavModule) {
    if (layout === 'open') {
      setFolded((f) => (f.includes(m.id) ? f.filter((x) => x !== m.id) : [...f, m.id]))
      return
    }
    if (m.id !== current) {
      navigate(m.to)
      setManual({ at: m.id, id: m.id })
    } else {
      setManual({ at: current, id: openId === m.id ? null : m.id })
    }
  }

  function changeView(id: RoleId | null) {
    setViewAs(id)
    const target = id ? roleById(id) : actualRole
    if (target) navigate(target.landing)
  }

  function signOut() {
    logout()
    navigate('/login')
  }

  const closeMenu = () => setMobileOpen(false)

  return (
    <DraftContext.Provider value={{ openDraft: setDraft }}>
      <BookingContext.Provider value={{ openBooking: (preset) => setBooking(preset ?? {}) }}>
        <div className="flex min-h-screen flex-col bg-canvas text-ink md:flex-row">
          <aside
            className={`bg-sidebar p-4 text-white transition-all md:sticky md:top-0 md:h-screen md:shrink-0 md:overflow-y-auto ${
              collapsed ? 'md:w-16 md:px-2' : 'md:w-60'
            }`}
          >
            <div className={`mb-4 flex items-center md:mb-6 ${collapsed ? 'justify-between md:justify-center' : 'justify-between px-2'}`}>
              <div className={collapsed ? 'md:hidden' : ''}>
                <p className="text-xl font-bold">Gastora</p>
                <p className="text-xs text-white/60">{tenant.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Menu"
                aria-expanded={mobileOpen}
                className="rounded-lg px-3 py-1 text-lg text-white/80 hover:bg-white/10 md:hidden"
              >
                {mobileOpen ? '×' : '☰'}
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden rounded-lg px-2 py-1 text-lg text-white/70 hover:bg-white/10 hover:text-white md:block"
              >
                {collapsed ? '»' : '«'}
              </button>
            </div>

            <nav className={`space-y-1 ${mobileOpen ? 'block' : 'hidden'} md:block`}>
              {modules.map((m) => {
                const isCurrent = m.id === current
                const single = m.pages.length === 1
                const open =
                  layout === 'flat' ? true : layout === 'open' ? !folded.includes(m.id) : openId === m.id

                // A module with one page is just a link, never a folder.
                if (single) {
                  const p = m.pages[0]
                  return (
                    <NavLink
                      key={m.id}
                      to={p.to}
                      end={p.end}
                      title={m.label}
                      onClick={closeMenu}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                          collapsed ? 'md:justify-center md:px-0' : ''
                        } ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`
                      }
                    >
                      <NavIcon name={m.icon} />
                      <span className={`flex-1 ${collapsed ? 'md:hidden' : ''}`}>{p.label}</span>
                      {p.badge && <NavBadge kind={p.badge} />}
                    </NavLink>
                  )
                }

                // Few pages: a small heading, pages always visible, nothing to click open.
                if (layout === 'flat') {
                  return (
                    <div key={m.id} className="pt-2 first:pt-0">
                      <button
                        type="button"
                        title={m.label}
                        onClick={() => navigate(m.to)}
                        className={`flex w-full items-center gap-3 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/50 hover:text-white ${
                          collapsed ? 'md:justify-center md:px-0' : ''
                        }`}
                      >
                        <NavIcon name={m.icon} className="h-4 w-4" />
                        <span className={collapsed ? 'md:hidden' : ''}>{m.label}</span>
                      </button>
                      <div className={`space-y-0.5 ${collapsed ? 'md:hidden' : ''}`}>
                        {m.pages.map((p) => (
                          <NavLink
                            key={p.to}
                            to={p.to}
                            end={p.end}
                            onClick={closeMenu}
                            className={({ isActive }) => childClass(isActive)}
                          >
                            <PageIcon m={m} p={p} />
                            {p.label}
                            {p.badge && <NavBadge kind={p.badge} />}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )
                }

                // 'open' and 'accordion': a folder that can fold.
                return (
                  <div key={m.id}>
                    <button
                      type="button"
                      title={m.label}
                      onClick={() => (collapsed ? navigate(m.to) : select(m))}
                      aria-expanded={open}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                        collapsed ? 'md:justify-center md:px-0' : ''
                      } ${
                        isCurrent
                          ? 'bg-white/10 font-semibold text-white'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <NavIcon name={m.icon} />
                      <span className={`flex-1 text-left ${collapsed ? 'md:hidden' : ''}`}>{m.label}</span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''} ${collapsed ? 'md:hidden' : ''}`}
                        aria-hidden="true"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </button>
                    {open && (
                      <div className={`ml-5 mt-0.5 space-y-0.5 border-l border-white/15 pl-2 ${collapsed ? 'md:hidden' : ''}`}>
                        {m.pages.map((p) => (
                          <NavLink
                            key={p.to}
                            to={p.to}
                            end={p.end}
                            onClick={closeMenu}
                            className={({ isActive }) => childClass(isActive)}
                          >
                            <PageIcon m={m} p={p} />
                            {p.label}
                            {p.badge && <NavBadge kind={p.badge} />}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

            {apps.length > 0 && (
              <div className={`mt-6 space-y-0.5 border-t border-white/10 pt-4 ${mobileOpen ? 'block' : 'hidden'} md:block ${collapsed ? 'md:hidden' : ''}`}>
                <p className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-white/50">
                  <NavIcon name="apps" className="h-4 w-4" />
                  Other apps
                </p>
                {apps.map((a) => (
                  <NavLink key={a.to} to={a.to} onClick={closeMenu} className={({ isActive }) => childClass(isActive)}>
                    {a.label}
                  </NavLink>
                ))}
              </div>
            )}

            <div className={`mt-6 border-t border-white/10 pt-4 ${mobileOpen ? 'block' : 'hidden'} md:block ${collapsed ? 'md:hidden' : ''}`}>
              <p className="px-3 text-sm font-semibold">{user?.name}</p>
              <p className="px-3 text-xs text-white/60">{actualRole?.label}</p>
              {actualRole?.canViewAs && (
                <label className="mt-3 block px-3 text-xs text-white/60">
                  View as
                  <select
                    value={viewAs ?? ''}
                    onChange={(e) => changeView(e.target.value ? (e.target.value as RoleId) : null)}
                    className="mt-1 w-full rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white"
                  >
                    <option value="" className="text-ink">Myself</option>
                    {ROLES.filter((r) => r.id !== 'platform' && r.id !== actualRole.id).map((r) => (
                      <option key={r.id} value={r.id} className="text-ink">
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={signOut}
                className="mt-3 w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {isViewingAs && role && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-warn/15 px-4 py-2 text-sm md:px-6">
                <span>
                  Viewing as <strong>{role.label}</strong>. This is a preview. Nothing changes for that person.
                </span>
                <button type="button" onClick={() => changeView(null)} className="font-semibold text-brand hover:underline">
                  Back to my view
                </button>
              </div>
            )}
            {inHousekeeping ? (
              <HousekeepingBar />
            ) : !showDeskBar ? null : (
              <header className="flex flex-wrap items-center gap-3 border-b border-ink/10 bg-surface px-4 py-3 md:px-6">
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
            )}
            <main className="flex-1 p-4 md:p-6">
              {allowed ? (
                <Outlet />
              ) : (
                <div className="mx-auto max-w-md rounded-xl border border-ink/10 bg-surface p-6 text-center">
                  <p className="font-semibold text-ink">This page is not for your role</p>
                  <p className="mt-1 text-sm text-ink/60">
                    You are signed in as {role?.label}. Ask your hotel admin if you need access.
                  </p>
                  <button
                    type="button"
                    onClick={() => role && navigate(role.landing)}
                    className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    Go to my page
                  </button>
                </div>
              )}
            </main>
          </div>

          {draft && <DraftPanel key={draft.title} draft={draft} onClose={() => setDraft(null)} />}
          {booking && <BookingPanel preset={booking} onClose={() => setBooking(null)} />}
        </div>
      </BookingContext.Provider>
    </DraftContext.Provider>
  )
}