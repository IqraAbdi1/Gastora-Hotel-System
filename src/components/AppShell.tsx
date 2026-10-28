
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import CommandBar from './CommandBar'
import DraftPanel from './DraftPanel'
import BookingPanel from './BookingPanel'
import NavBadge from './NavBadge'
import NavIcon from './NavIcon'
import { useAuth } from '../features/auth/authContext'
import { useFeatures } from '../features/platform/featuresContext'
import NotificationBell from '../features/frontdesk/NotificationBell'
import { HousekeepingRequests } from '../features/housekeeping/HousekeepingBar'
import { DraftContext } from '../lib/draftContext'
import { BookingContext } from '../lib/bookingContext'
import type { BookingPreset } from '../lib/bookingContext'
import { SECTIONS, moduleOf, otherApps, pageOf, visibleModules } from '../lib/nav'
import type { NavModule, NavPage } from '../lib/nav'
import { ROLES, roleById } from '../lib/roles'
import type { RoleId } from '../lib/roles'
import type { DraftAction } from '../types'

const childClass = (isActive: boolean) =>
  `relative flex items-center rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
    isActive
      ? 'bg-white/12 text-white before:absolute before:-left-[9px] before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-accent'
      : 'text-white/65 hover:bg-white/8 hover:text-white'
  }`

// The pages of one module as menu links. Pages used less often fold under "More" until one of them is open.
function ModulePages({ m, pathname, onPick }: { m: NavModule; pathname: string; onPick: () => void }) {
  const [showMore, setShowMore] = useState(false)
  const main = m.pages.filter((p) => !p.more)
  const extra = m.pages.filter((p) => p.more)
  const onExtra = extra.some((p) => pathname === p.to || pathname.startsWith(`${p.to}/`))
  const fold = extra.length > 1 && main.length > 0
  const shown = !fold || showMore || onExtra ? m.pages : main

  return (
    <>
      {shown.map((p) => (
        <NavLink
          key={p.to}
          to={p.to}
          end={p.end}
          onClick={onPick}
          className={({ isActive }) => childClass(isActive)}
        >
          <PageIcon m={m} p={p} />
          <span className="flex-1">{p.label}</span>
          {p.badge && <NavBadge kind={p.badge} />}
        </NavLink>
      ))}

      {fold && !onExtra && (
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="flex w-full items-center rounded-lg px-3 py-1.5 text-left text-[13px] font-medium text-white/45 hover:bg-white/8 hover:text-white"
        >
          {showMore ? 'Fewer' : `More (${extra.length})`}
        </button>
      )}
    </>
  )
}

// The small icon in front of a page name.
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
  const { tenant, features, options } = useFeatures()
  const { user, role, actualRole, viewAs, isViewingAs, canOpen, setViewAs, logout } = useAuth()

  const inHousekeeping = pathname.startsWith('/housekeeping')
  const allowedModules = visibleModules(features, canOpen, options)
  const modules = allowedModules
  const totalPages = modules.reduce((n, m) => n + m.pages.length, 0)

  const layout: 'flat' | 'open' | 'accordion' =
    totalPages <= 8 ? 'flat' : modules.length <= 3 ? 'open' : 'accordion'

  const [folded, setFolded] = useState<string[]>([])
  const apps = otherApps.filter((a) => canOpen(a.to))

  const current = moduleOf(pathname)?.id
  const showDeskBar = current === 'frontdesk'
  const currentModule = modules.find((m) => m.id === current)
  const currentPage = pageOf(pathname)
  const [manual, setManual] = useState<{ at?: string; id: string | null } | null>(null)
  const openId = manual && manual.at === current ? manual.id : current

  const known = !!moduleOf(pathname) || pathname.startsWith('/guest') || pathname.startsWith('/platform')
  const allowed = !known || canOpen(pathname)

  const otherAppLabel = otherApps.find((a) => pathname.startsWith(a.to))?.label
  const pageTitle = currentPage?.label ?? currentModule?.label ?? otherAppLabel ?? tenant.name
  const hotelName = tenant.name?.trim() || 'Hotel'
  const initials = (user?.name ?? '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')

  // Keep the browser tab aligned with the active tenant and current page.
  useEffect(() => {
    document.title = pageTitle && pageTitle !== hotelName
      ? `${pageTitle} | ${hotelName} | Gastora`
      : `${hotelName} | Gastora`
  }, [hotelName, pageTitle])

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

  function renderModule(m: NavModule) {
    const isCurrent = m.id === current
    const single = m.pages.length === 1
    const open = layout === 'flat' ? true : layout === 'open' ? !folded.includes(m.id) : openId === m.id

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
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              collapsed ? 'md:justify-center md:px-0' : ''
            } ${isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`
          }
        >
          <NavIcon name={m.icon} className="h-[18px] w-[18px] shrink-0" />
          <span className={`flex-1 ${collapsed ? 'md:hidden' : ''}`}>{p.label}</span>
          {p.badge && <NavBadge kind={p.badge} />}
        </NavLink>
      )
    }

    if (layout === 'flat') {
      return (
        <div key={m.id} className="pt-2 first:pt-0">
          <button
            type="button"
            title={m.label}
            onClick={() => navigate(m.to)}
            className={`flex w-full items-center gap-3 px-3 py-1 text-xs font-semibold text-white/55 hover:text-white ${
              collapsed ? 'md:justify-center md:px-0' : ''
            }`}
          >
            <NavIcon name={m.icon} className="h-4 w-4" />
            <span className={collapsed ? 'md:hidden' : ''}>{m.label}</span>
          </button>

          <div className={`ml-5 space-y-0.5 border-l border-white/10 pl-2 ${collapsed ? 'md:hidden' : ''}`}>
            <ModulePages m={m} pathname={pathname} onPick={closeMenu} />
          </div>
        </div>
      )
    }

    return (
      <div key={m.id}>
        <button
          type="button"
          title={m.label}
          onClick={() => (collapsed ? navigate(m.to) : select(m))}
          aria-expanded={open}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            collapsed ? 'md:justify-center md:px-0' : ''
          } ${isCurrent ? 'text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}
        >
          <NavIcon name={m.icon} className={`h-[18px] w-[18px] shrink-0 ${isCurrent ? 'text-accent' : ''}`} />
          <span className={`flex-1 text-left ${collapsed ? 'md:hidden' : ''} ${isCurrent ? 'font-semibold' : ''}`}>
            {m.label}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${
              open ? 'rotate-90' : ''
            } ${collapsed ? 'md:hidden' : ''}`}
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        {open && (
          <div className={`mb-1 ml-[21px] mt-0.5 space-y-0.5 border-l border-white/10 pl-2 ${collapsed ? 'md:hidden' : ''}`}>
            <ModulePages m={m} pathname={pathname} onPick={closeMenu} />
          </div>
        )}
      </div>
    )
  }

  const grouped = SECTIONS.map((sec) => ({
    label: sec.label,
    modules: modules.filter((m) => sec.modules.includes(m.id)),
  }))

  const ungrouped = modules.filter((m) => !SECTIONS.some((sec) => sec.modules.includes(m.id)))
  if (ungrouped.length) grouped.push({ label: null, modules: ungrouped })

  return (
    <DraftContext.Provider value={{ openDraft: setDraft }}>
      <BookingContext.Provider value={{ openBooking: (preset) => setBooking(preset ?? {}) }}>
        <div className="flex min-h-screen flex-col bg-canvas text-ink md:flex-row">
          <aside
            className={`flex flex-col bg-sidebar text-white transition-all md:sticky md:top-0 md:h-screen md:shrink-0 ${
              collapsed ? 'md:w-[68px]' : 'md:w-60'
            }`}
          >
            <div className={`flex items-center gap-3 px-4 py-4 md:py-5 ${collapsed ? 'md:justify-center md:px-2' : ''}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-extrabold text-sidebar">
                G
              </span>

              <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
                <p className="text-[15px] font-bold leading-tight">Gastora</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-white/85" title={hotelName}>
                  {hotelName}
                </p>
                <p className="text-[10px] text-white/45">Hotel workspace</p>
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
                className={`hidden rounded-md px-1.5 py-0.5 text-sm text-white/50 hover:bg-white/10 hover:text-white md:block ${
                  collapsed ? 'md:absolute md:left-[52px] md:top-6 md:bg-sidebar md:shadow' : ''
                }`}
              >
                {collapsed ? '»' : '«'}
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto px-3 pb-4 ${mobileOpen ? 'block' : 'hidden'} md:block`}>
              <nav className="space-y-0.5">
                {grouped.map((g, gi) =>
                  g.modules.length === 0 ? null : (
                    <div key={g.label ?? `g${gi}`} className={gi > 0 ? 'pt-3' : ''}>
                      {g.label && (
                        <p
                          className={`px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40 ${
                            collapsed ? 'md:hidden' : ''
                          }`}
                        >
                          {g.label}
                        </p>
                      )}
                      {collapsed && gi > 0 && (
                        <div className="mx-3 mb-2 hidden border-t border-white/10 md:block" />
                      )}
                      <div className="space-y-0.5">{g.modules.map(renderModule)}</div>
                    </div>
                  ),
                )}
              </nav>

              {apps.length > 0 && (
                <div className={`mt-5 space-y-0.5 border-t border-white/10 pt-4 ${collapsed ? 'md:hidden' : ''}`}>
                  <p className="mb-1 flex items-center gap-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    <NavIcon name="apps" className="h-3.5 w-3.5" />
                    Other apps
                  </p>
                  {apps.map((a) => (
                    <NavLink
                      key={a.to}
                      to={a.to}
                      onClick={closeMenu}
                      className={({ isActive }) => childClass(isActive)}
                    >
                      {a.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`border-t border-white/10 px-4 py-4 ${mobileOpen ? 'block' : 'hidden'} md:block ${
                collapsed ? 'md:px-2' : ''
              }`}
            >
              <div className={`flex items-center gap-3 ${collapsed ? 'md:justify-center' : ''}`}>
                <span
                  title={user?.name}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold"
                >
                  {initials}
                </span>

                <div className={`min-w-0 flex-1 ${collapsed ? 'md:hidden' : ''}`}>
                  <p className="truncate text-sm font-semibold">{user?.name}</p>
                  <p className="truncate text-[11px] text-white/55">{actualRole?.label}</p>
                </div>
              </div>

              <div className={collapsed ? 'md:hidden' : ''}>
                {actualRole?.canViewAs && (
                  <label className="mt-3 block text-[11px] text-white/55">
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
                  className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-white/65 hover:bg-white/10 hover:text-white"
                >
                  Sign out
                </button>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {isViewingAs && role && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-warn/15 px-4 py-2 text-sm md:px-7">
                <span>
                  Viewing as <strong>{role.label}</strong>. This is a preview. Nothing changes for that person.
                </span>
                <button
                  type="button"
                  onClick={() => changeView(null)}
                  className="font-semibold text-brand hover:underline"
                >
                  Back to my view
                </button>
              </div>
            )}

            <header className="sticky top-0 z-30 flex min-h-[60px] flex-wrap items-center gap-3 border-b border-ink/10 bg-surface/95 px-4 py-2.5 backdrop-blur md:px-7">
              <div className="flex min-w-0 flex-col">
                <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
                  {currentModule && currentPage && currentModule.pages.length > 1 ? (
                    <>
                      <NavLink to={currentModule.to} className="truncate text-ink/55 hover:text-ink">
                        {currentModule.label}
                      </NavLink>
                      <span className="text-ink/30">/</span>
                      <span className="truncate font-semibold text-ink">{currentPage.label}</span>
                    </>
                  ) : (
                    <span className="truncate font-semibold text-ink">{pageTitle}</span>
                  )}
                </nav>

                <p className="mt-0.5 truncate text-[11px] text-ink/50" title={hotelName}>
                  {hotelName}
                </p>
              </div>

              {showDeskBar ? (
                <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                  <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:w-80 lg:w-96">
                    <CommandBar />
                  </div>
                  <NotificationBell />
                  <button
                    type="button"
                    onClick={() => setBooking({ walkin: true })}
                    className="rounded-lg border border-ink/15 bg-surface px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
                  >
                    Walk-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setBooking({})}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
                  >
                    + New booking
                  </button>
                </div>
              ) : inHousekeeping ? (
                <div className="ml-auto">
                  <HousekeepingRequests />
                </div>
              ) : null}
            </header>

            <main className="mx-auto w-full max-w-[1480px] flex-1 p-4 pb-24 md:px-7 md:py-6">
              {allowed ? (
                <Outlet />
              ) : (
                <div className="mx-auto mt-10 max-w-md rounded-xl border border-ink/10 bg-surface p-6 text-center shadow-sm">
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

          {currentModule && currentModule.pages.length > 1 && (
            <nav
              aria-label={currentModule.label}
              className="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
            >
              {currentModule.pages
                .filter((p) => !p.more)
                .slice(0, 4)
                .map((p) => (
                  <NavLink
                    key={p.to}
                    to={p.to}
                    end={p.end}
                    className={({ isActive }) =>
                      `flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[11px] font-semibold ${
                        isActive ? 'text-brand' : 'text-ink/50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`h-1 w-6 rounded-full ${isActive ? 'bg-brand' : 'bg-transparent'}`} />
                        <span className="w-full truncate text-center">{p.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(true)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[11px] font-semibold text-ink/50"
              >
                <span className="h-1 w-6" />
                Menu
              </button>
            </nav>
          )}

          {draft && <DraftPanel key={draft.title} draft={draft} onClose={() => setDraft(null)} />}
          {booking && <BookingPanel preset={booking} onClose={() => setBooking(null)} />}
        </div>
      </BookingContext.Provider>
    </DraftContext.Provider>
  )
}
