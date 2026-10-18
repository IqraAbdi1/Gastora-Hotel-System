import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StatusPill from '../../components/StatusPill'
import { Badge, Button, Card, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { benefitList, isSensitiveTag, loyaltyKnown, nextTier, stayHistory, tierFor } from '../../lib/loyalty'
import type { Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { forGuest, KIND_TONE, STATE_TONE } from '../../lib/feedback'
import { BAND_LABEL, BAND_RULE, BAND_TONE, sinceWords, valueOf } from '../../lib/guestValue'
import { useFeedback } from '../feedback/useFeedback'
import { useMessages } from '../messages/messagesContext'
import { useFeatures } from '../platform/featuresContext'
import GuestEditPanel from './GuestEditPanel'
import PointsCard from '../loyalty/PointsCard'
import RelationshipsCard from './RelationshipsCard'

/**
 * One guest, gathered: who they are, what they have asked for, what they have spent, what they agreed
 * to and when, what the hotel has sent them, and every stay.
 *
 * It is assembled from records the hotel already keeps rather than from a separate marketing store,
 * which is what keeps it true. A profile that disagrees with the folios is worse than none.
 */
export default function GuestProfilePage() {
  const { guestId } = useParams()
  const { guests, reservations } = useHotel()
  const { options, features } = useFeatures()
  const { messages } = useMessages()
  const { feedback } = useFeedback()
  const { can } = useAuth()
  // The desk recognises and serves. The whole record belongs to whoever answers for the hotel.
  const full = can('seeGuestRecord')
  // Worth is a bigger hotel's question: a small one knows its regulars by face.
  const showValue = full && features.guestValue
  const [editing, setEditing] = useState(false)

  const guest = guests.find((g) => g.id === guestId)

  const stays = useMemo(
    () =>
      guest
        ? reservations
            .filter((r) => (r.guestId ? r.guestId === guest.id : r.guest === guest.name))
            .sort((a, b) => b.arrival.localeCompare(a.arrival))
        : [],
    [guest, reservations],
  )

  const theirs = useMemo(() => {
    const ids = new Set(stays.map((s) => s.id))
    return messages.filter((m) => m.reservationId && ids.has(m.reservationId)).slice(0, 8)
  }, [messages, stays])

  if (!guest) {
    return (
      <div className="space-y-3">
        <PageHeader eyebrow="Front desk" title="Guest not found" />
        <Link to="/desk/guests" className="text-sm font-semibold text-brand">
          Back to the guests
        </Link>
      </div>
    )
  }

  const history = stayHistory(guest, reservations)
  const known = loyaltyKnown(guest)
  const tier = known ? tierFor(history, options.loyalty) : null
  const next = known ? nextTier(history, options.loyalty) : null
  const owing = stays.reduce((n, r) => n + (r.status === 'cancelled' ? 0 : Math.max(0, r.total - r.paid)), 0)
  const tags = guest.preferences?.tags ?? []
  // What this guest has said, so nobody walks up to them without knowing it went wrong last time.
  const said = forGuest(feedback, guest.id, guest.name)
  const value = valueOf(guest, reservations, feedback, TODAY)

  const details: [string, string | undefined][] = [
    ['Telephone', guest.phone],
    ['Email', guest.email],
    ['Nationality', guest.nationality],
    ...(full
      ? ([
          ['Date of birth', guest.dateOfBirth ? dayMonth(guest.dateOfBirth) : undefined],
          ['Gender', guest.gender],
          ['Address', guest.address],
          ['Identification', guest.idNumber ? `${guest.idType ?? 'ID'} ending ${guest.idNumber.slice(-4)}` : undefined],
        ] as [string, string | undefined][])
      : []),
  ]

  const columns: Column<Reservation>[] = [
    {
      key: 'stay',
      header: 'Stay',
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {dayMonth(r.arrival)} to {dayMonth(r.departure)}
          </p>
          <p className="text-xs text-ink/55">
            {r.id} · {r.room ? `Room ${r.room}` : r.roomType}
            {r.channel ? ` · ${r.channel.name}` : r.source ? ` · ${r.source}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} /> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => <span className="tabular-nums">{ugx(r.total)}</span>,
    },
    {
      key: 'balance',
      header: 'Owing',
      align: 'right',
      cell: (r) => {
        const balance = Math.max(0, r.total - r.paid)
        return (
          <span className={`tabular-nums ${balance > 0 && r.status !== 'cancelled' ? 'font-semibold text-bad' : 'text-ink/45'}`}>
            {balance > 0 && r.status !== 'cancelled' ? ugx(balance) : '—'}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title={guest.name}
        description={`${guest.id}${guest.phone ? ` · ${guest.phone}` : ''}`}
        meta={
          <div className="flex flex-wrap gap-2">
            {guest.vip && <Badge tone="warn">VIP</Badge>}
            {tier && <Badge tone="good">{tier.name}</Badge>}
            {!known && <Badge tone="neutral">Not in the programme</Badge>}
            {features.guestValue && value.stays > 0 && <Badge tone={BAND_TONE[value.band]}>{BAND_LABEL[value.band]}</Badge>}
          </div>
        }
        actions={<Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
      />

      <div className={`grid grid-cols-2 gap-3 ${full ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <StatCard label="Stays" icon="guests" value={String(history.stays)} hint={`${history.nights} nights altogether`} />
        {full && <StatCard label="Spent" icon="money" value={ugx(history.spent)} hint="Finished stays" />}
        <StatCard
          label="Last here"
          icon="calendar"
          value={history.lastStay ? dayMonth(history.lastStay) : '—'}
          hint={history.lastStay ? 'Departed' : 'Never stayed'}
        />
        <StatCard
          label="Owing now"
          icon="alert"
          value={ugx(owing)}
          hint={owing > 0 ? 'Across open stays' : 'Nothing outstanding'}
          tone={owing > 0 ? 'bad' : 'good'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Who they are" icon="guests" padded>
          <dl className="space-y-2 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink/60">{label}</dt>
                <dd className="text-right font-medium text-ink/85">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {!full && (
            <p className="mt-2 text-xs text-ink/55">
              The home address, the identification and what this guest has spent over the years are part of the
              hotel's record rather than the desk's work, so they are kept for the manager.
            </p>
          )}
        </Card>

        <Card title="What they like" icon="bed" padded description="Taken at check-in and kept between stays.">
          {tags.length === 0 && !guest.preferences?.other ? (
            <p className="text-sm text-ink/55">Nothing recorded yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {tags.filter((t) => full || !isSensitiveTag(t)).map((t) => (
                  <span
                    key={t}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                      isSensitiveTag(t) ? 'bg-warn/10 text-warn ring-warn/30' : 'bg-brand/10 text-brand ring-brand/30'
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              {guest.preferences?.other && <p className="mt-2 text-sm text-ink/75">{guest.preferences.other}</p>}
              {full && tags.some(isSensitiveTag) && (
                <p className="mt-2 text-xs text-ink/55">
                  The amber ones are dietary or access needs. The law treats those as sensitive, and the guest agreed
                  to the hotel keeping them.
                </p>
              )}
            </>
          )}
        </Card>

        {full && (
        <Card title="What they agreed to" icon="check" padded description="Kept with the date it was given.">
          <ul className="space-y-2 text-sm">
            {[
              ['Remembered between stays', guest.loyaltyConsent],
              ['Offers and news', guest.marketingConsent],
              ['Dietary and access needs kept', guest.sensitiveConsent],
            ].map(([label, yes]) => (
              <li key={String(label)} className="flex items-center justify-between gap-3">
                <span className="text-ink/70">{label}</span>
                <Badge tone={yes ? 'good' : 'neutral'} dot={!!yes}>
                  {yes ? 'Agreed' : 'No'}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink/55">
            {guest.consentAt ? `Last answered ${guest.consentAt}.` : 'Not answered yet.'} The booking, the
            identification shown at check-in and the bills are kept whatever these say, because the law and the stay
            require them.
          </p>
        </Card>
        )}

        {options.loyalty.on && (
          <Card title="The programme" icon="money" padded>
            {!known ? (
              <p className="text-sm text-ink/70">
                This guest has not agreed to be remembered between stays, so they earn nothing and no tier is counted.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink/80">
                  {tier ? (
                    <>
                      <strong>{tier.name}</strong> on {history.stays} stay{history.stays === 1 ? '' : 's'} and{' '}
                      {history.nights} night{history.nights === 1 ? '' : 's'}.
                    </>
                  ) : (
                    'No tier yet.'
                  )}
                </p>
                {next && (
                  <p className="mt-1 text-sm text-ink/65">
                    {next.staysToGo > 0 && `${next.staysToGo} more stay${next.staysToGo === 1 ? '' : 's'}`}
                    {next.staysToGo > 0 && next.nightsToGo > 0 && ' or '}
                    {next.nightsToGo > 0 && `${next.nightsToGo} more night${next.nightsToGo === 1 ? '' : 's'}`}
                    {' to reach '}
                    {next.tier.name}.
                  </p>
                )}
                {tier && benefitList(tier).length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink/70">
                    {benefitList(tier).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        )}
      </div>

      {showValue && value.stays > 0 && (
        <Card
          title="What they are worth"
          icon="money"
          padded
          description="Counted from what they actually paid. Nothing here guesses what they will spend next."
        >
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: 'Paid altogether', value: ugx(value.paid), hint: `${value.stays} stays, ${value.nights} nights` },
              { label: 'A year at this rate', value: ugx(value.perYear), hint: `Over ${value.monthsKnown} month${value.monthsKnown === 1 ? '' : 's'} of knowing them` },
              { label: 'A night', value: ugx(value.perNight), hint: 'Average of what they paid' },
              { label: 'Last here', value: sinceWords(value.daysSince), hint: value.lastStay ? dayMonth(value.lastStay) : '' },
            ].map((cell) => (
              <div key={cell.label} className="rounded-xl bg-linear-to-br from-brand/[0.06] to-surface p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">{cell.label}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{cell.value}</p>
                <p className="text-xs text-ink/55">{cell.hint}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-ink/75">
            <Badge tone={BAND_TONE[value.band]}>{BAND_LABEL[value.band]}</Badge>{' '}
            <span className="text-ink/60">{BAND_RULE[value.band]}</span>
          </p>

          {(value.fellThrough > 0 || value.complaints > 0 || value.owing > 0) && (
            <ul className="mt-2 space-y-0.5 text-sm text-ink/70">
              {value.fellThrough > 0 && (
                <li>
                  {value.fellThrough} booking{value.fellThrough === 1 ? '' : 's'} cancelled or never arrived.
                </li>
              )}
              {value.complaints > 0 && (
                <li>
                  {value.complaints} complaint{value.complaints === 1 ? '' : 's'} raised.
                </li>
              )}
              {value.owing > 0 && <li className="text-bad">{ugx(value.owing)} still owed across open stays.</li>}
            </ul>
          )}

          <p className="mt-2 text-xs text-ink/55">
            The yearly figure is money they have already paid, spread over the time the hotel has known them. It is
            the fair way to compare a guest of five years with a guest of five months, but it is a rate, not a
            promise: on a few months of history it moves a long way on one more stay.
          </p>
        </Card>
      )}

      {said.length > 0 && (
        <Card title="What they have said" icon="alert" count={said.length} padded={false}>
          <ul className="divide-y divide-ink/5">
            {said.map((f) => (
              <li key={f.id} className="p-3.5">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={KIND_TONE[f.kind]} dot>
                    {f.about}
                  </Badge>
                  <Badge tone={STATE_TONE[f.state]}>{f.state}</Badge>
                  {f.rating !== undefined && <span className="text-xs text-ink/55">{f.rating} out of 5</span>}
                </p>
                <p className="mt-1 text-sm text-ink/80">{f.text}</p>
                {f.resolution && <p className="mt-1 text-sm text-good">{f.resolution.text}</p>}
                <p className="mt-0.5 text-xs text-ink/45">
                  {f.at}
                  {f.room ? ` · room ${f.room}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {features.loyaltyPoints && <PointsCard guest={guest} />}

      <RelationshipsCard guest={guest} />

      <Card title="Every stay" icon="calendar" count={stays.length} padded={false}>
        <DataTable
          columns={columns}
          rows={stays}
          rowKey={(r) => r.id}
          empty={{ title: 'No stays yet', hint: 'A stay appears here as soon as a booking is made.' }}
        />
      </Card>

      {features.guestMessages && (
        <Card title="What the hotel has sent" icon="list" count={theirs.length} padded={false}>
          {theirs.length === 0 ? (
            <p className="p-4 text-sm text-ink/55">Nothing has been sent to this guest.</p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {theirs.map((m) => (
                <li key={m.id} className="p-3.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {m.kind}
                    <Badge tone={m.status === 'sent' ? 'good' : m.status === 'cancelled' ? 'neutral' : 'warn'}>
                      {m.status}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-ink/70">{m.body}</p>
                  <p className="mt-0.5 text-xs text-ink/45">
                    {m.sentAt ?? m.at}
                    {m.problem ? ` · ${m.problem}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {full && (guest.notes ?? []).length > 0 && (
        <Card title="Notes" icon="list" count={(guest.notes ?? []).length} padded>
          <ul className="space-y-2 text-sm">
            {(guest.notes ?? []).map((n) => (
              <li key={n.id}>
                <p className="text-ink/80">{n.text}</p>
                <p className="text-xs text-ink/45">
                  {n.by} · {n.at}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && <GuestEditPanel guest={guest} onClose={() => setEditing(false)} />}
    </div>
  )
}
