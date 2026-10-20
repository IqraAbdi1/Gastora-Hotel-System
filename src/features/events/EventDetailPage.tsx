import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, ConfirmDialog, EmptyState, LoadingState, PageHeader, StatCard, Tabs, buttonClass } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth } from '../../lib/format'
import { eventMoney } from '../../services/events/eventsRules'
import type { EventStatus } from '../../services/events/eventsTypes'
import BeoTab from './BeoTab'
import { ErrorNote } from './ErrorNote'
import { EventForm } from './EventsListPage'
import { EVENT_STATUS_LABEL, EVENT_STATUS_TONE, EVENT_TYPE_LABEL, ugxShort } from './eventsUi'
import ResourcesTab from './ResourcesTab'
import RoomsTab from './RoomsTab'
import { useEvents, useRun } from './useEvents'

type Tab = 'beo' | 'resources' | 'rooms'

export default function EventDetailPage() {
  const { id } = useParams()
  const { data, loading, service, actor, sales } = useEvents()
  const [tab, setTab] = useState<Tab>('beo')
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<EventStatus | null>(null)
  const { error, run } = useRun()

  const booking = data.bookings.find((b) => b.id === id)
  if (!booking) {
    if (loading) return <LoadingState />
    return <EmptyState title="Event not found" action={<Link to="/events/bookings" className={buttonClass('secondary')}>All events</Link>} />
  }
  const beo = data.beos.find((b) => b.eventBookingId === booking.id)
  const money = eventMoney(booking.id, data)
  const sessions = data.sessions.filter((s) => s.eventBookingId === booking.id)
  const resources = data.resourceBookings.filter((r) => r.eventBookingId === booking.id)
  const closed = booking.status === 'cancelled' || booking.status === 'completed'
  const quote = data.quotes.find((q) => q.eventBookingId === booking.id)

  const STATUS_ACTION: Partial<Record<EventStatus, string>> = {
    definite: 'Make definite',
    tentative: 'Back to tentative',
    completed: 'Mark completed',
    cancelled: 'Cancel event',
  }
  const nextStatuses: EventStatus[] =
    booking.status === 'tentative'
      ? ['definite', 'cancelled']
      : booking.status === 'definite'
        ? booking.endDate <= TODAY
          ? ['completed', 'cancelled']
          : ['tentative', 'cancelled']
        : []

  return (
    <div className="space-y-5">
      <Link to="/events/bookings" className="text-sm font-semibold text-brand hover:underline">
        ‹ Events
      </Link>
      <PageHeader
        eyebrow="Events and sales"
        title={booking.name}
        meta={
          <Badge tone={EVENT_STATUS_TONE[booking.status]} dot>
            {EVENT_STATUS_LABEL[booking.status]}
          </Badge>
        }
        description={`${booking.clientName} · ${EVENT_TYPE_LABEL[booking.eventType]} · ${booking.startDate === booking.endDate ? dayMonth(booking.startDate) : `${dayMonth(booking.startDate)} to ${dayMonth(booking.endDate)}`}`}
        actions={
          <>
            {nextStatuses.map((s) => (
              <Button key={s} variant={s === 'cancelled' ? 'ghost' : 'secondary'} onClick={() => setConfirm(s)}>
                {STATUS_ACTION[s]}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Details
            </Button>
            {beo && (
              <Link to={`/events/beo/${booking.id}`} className={buttonClass('primary')}>
                Print BEO
              </Link>
            )}
          </>
        }
      />
      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Guests" value={String(booking.guaranteedGuests ?? booking.expectedGuests)} hint={booking.guaranteedGuests !== undefined ? `Guaranteed, ${booking.expectedGuests} expected` : 'Expected'} icon="guests" />
        <StatCard label="Sessions" value={String(sessions.length)} hint={`${new Set(sessions.map((s) => s.spaceId)).size} space(s)`} icon="calendar" />
        <StatCard label="Event value" value={ugxShort(money.forecastRevenue)} hint="BEO, resources, hire" icon="money" />
        <StatCard
          label="Paid"
          value={ugxShort(money.paid)}
          hint={quote ? `Quote ${quote.number}` : 'Deposits and payments'}
          to={sales ? '/events/quotes' : '/events/billing'}
          tone={money.paid > 0 ? 'good' : 'default'}
          icon="check"
        />
      </div>

      <Tabs
        label="Event"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'beo', label: 'BEO', alert: beo?.status === 'draft' && booking.startDate <= TODAY },
          { key: 'resources', label: 'Equipment and staff', count: resources.length },
          { key: 'rooms', label: 'Room block', alert: false },
        ]}
      />

      {tab === 'beo' && beo && <BeoTab booking={booking} beo={beo} data={data} closed={closed} />}
      {tab === 'resources' && <ResourcesTab booking={booking} data={data} closed={closed} />}
      {tab === 'rooms' && <RoomsTab booking={booking} />}

      {editing && <EventForm booking={booking} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {confirm && (
        <ConfirmDialog
          title={`${STATUS_ACTION[confirm]}?`}
          message={
            confirm === 'cancelled'
              ? 'The function spaces and equipment are released. Payments already taken stay on record.'
              : confirm === 'definite'
                ? 'The spaces are confirmed. Any clash with another event must be cleared first.'
                : `${booking.name} becomes ${EVENT_STATUS_LABEL[confirm].toLowerCase()}.`
          }
          confirmLabel={STATUS_ACTION[confirm]}
          danger={confirm === 'cancelled'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const s = confirm
            setConfirm(null)
            void run(() => service.setBookingStatus(booking.id, s, actor))
          }}
        />
      )}
    </div>
  )
}
