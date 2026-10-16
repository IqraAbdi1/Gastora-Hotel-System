import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, EmptyState } from '../../components/ui'
import type { Tone } from '../../components/ui'
import { timeAgo } from '../../lib/format'
import { NOTIFICATION_LABELS } from '../../services/notifications/notificationTypes'
import type { AppNotification, NotificationSeverity } from '../../services/notifications/notificationTypes'
import { useFrontDesk } from './frontDeskContext'

const tone: Record<NotificationSeverity, Tone> = { info: 'info', warn: 'warn', bad: 'bad' }

// The bell in the front desk bar: unread count, and a panel to read and clear notifications.
export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead, now } = useFrontDesk()
  const [open, setOpen] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const list = onlyUnread ? notifications.filter((n) => !n.read) : notifications

  function openOne(n: AppNotification) {
    void markRead([n.id])
    setOpen(false)
    if (!n.link) return
    const [path, hash] = n.link.split('#')
    navigate(path)
    // The router does not scroll to #anchors, so do it once the page has drawn.
    if (hash) window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-ink/15 bg-surface text-ink/70 hover:bg-canvas hover:text-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-bad px-1 text-center text-[11px] font-bold leading-5 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-4 top-20 z-40 flex max-h-[70vh] flex-col rounded-xl border border-ink/10 bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
              <div>
                <p className="font-semibold text-ink">Notifications</p>
                <p className="text-xs text-ink/55">{unread ? `${unread} unread` : 'All caught up'}</p>
              </div>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={unread === 0}
                className="text-xs font-semibold text-brand hover:underline disabled:cursor-default disabled:text-ink/30 disabled:no-underline"
              >
                Mark all as read
              </button>
            </div>
            <div className="flex gap-1 border-b border-ink/10 px-4 py-2" role="tablist">
              {[
                { key: true, label: 'Unread' },
                { key: false, label: 'All' },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  role="tab"
                  aria-selected={onlyUnread === t.key}
                  onClick={() => setOnlyUnread(t.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    onlyUnread === t.key ? 'bg-brand text-white' : 'text-ink/65 hover:bg-canvas'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {list.length === 0 ? (
                <EmptyState
                  title={onlyUnread ? 'No unread notifications' : 'No notifications yet'}
                  hint={onlyUnread && notifications.length ? 'Switch to All to see earlier ones.' : undefined}
                />
              ) : (
                <ul className="divide-y divide-ink/8">
                  {list.map((n) => (
                    <li key={n.id} className={n.read ? '' : 'bg-brand/[0.03]'}>
                      <button type="button" onClick={() => openOne(n)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-canvas">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand'}`}
                          aria-label={n.read ? undefined : 'Unread'}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <Badge tone={tone[n.severity]}>{NOTIFICATION_LABELS[n.type]}</Badge>
                            <span className="text-xs text-ink/50">{timeAgo(n.createdAt, now)}</span>
                          </span>
                          <span className={`mt-1 block text-sm ${n.read ? 'text-ink/75' : 'font-semibold text-ink'}`}>{n.title}</span>
                          <span className="mt-0.5 block text-xs text-ink/60">{n.body}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="border-t border-ink/10 px-4 py-2 text-[11px] text-ink/50">
              Sample data: worked out in this browser from the current bookings and tasks. Not saved or shared.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
