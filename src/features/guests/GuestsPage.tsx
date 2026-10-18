import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { loyaltyKnown, stayHistory, tierFor } from '../../lib/loyalty'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import GuestEditPanel from './GuestEditPanel'
import MergeDialog from './MergeDialog'
import { duplicatePairs } from '../../lib/mergeGuests'
import type { DuplicatePair } from '../../lib/mergeGuests'

const PAGE = 12

/**
 * Everybody the hotel knows.
 *
 * Search first: a hotel of any size has more guests than anyone will scroll, and the question is always
 * about one person. The list carries what a clerk needs to recognise them - how often they come, what
 * they have spent, when they were last here - and the profile carries the rest.
 */
export default function GuestsPage() {
  const { guests, reservations } = useHotel()
  const { options } = useFeatures()
  const { can } = useAuth()
  const full = can('seeGuestRecord')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState<DuplicatePair | null>(null)

  const q = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)

  function setParam(key: string, value: string, fallback = '') {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const rows = useMemo(() => {
    const text = q.trim().toLowerCase()
    const bare = (s: string) => s.replace(/\s/g, '')
    return guests
      .filter(
        (g) =>
          text === '' ||
          g.name.toLowerCase().includes(text) ||
          bare(g.phone ?? '').includes(bare(text)) ||
          (g.email ?? '').toLowerCase().includes(text),
      )
      .map((g) => ({ guest: g, history: stayHistory(g, reservations) }))
      .sort((a, b) => (b.history.lastStay ?? '').localeCompare(a.history.lastStay ?? ''))
  }, [guests, reservations, q])

  // Narrow on purpose: same telephone or the same name written the same way. A looser rule would bury
  // the real duplicates under a list of common surnames.
  const dupes = useMemo(() => (full ? duplicatePairs(guests) : []), [guests, full])
  const returning = rows.filter((r) => r.history.stays > 1).length
  const vips = guests.filter((g) => g.vip).length
  const spent = rows.reduce((n, r) => n + r.history.spent, 0)

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE)

  type Row = (typeof rows)[number]
  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Guest',
      cell: ({ guest, history }) => {
        const tier = loyaltyKnown(guest) ? tierFor(history, options.loyalty) : null
        return (
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-semibold text-ink">
              {guest.name}
              {guest.vip && <Badge tone="warn">VIP</Badge>}
              {tier && <Badge tone="good">{tier.name}</Badge>}
            </p>
            <p className="truncate text-xs text-ink/55">
              {guest.phone}
              {guest.email ? ` · ${guest.email}` : ''}
            </p>
          </div>
        )
      },
    },
    {
      key: 'stays',
      header: 'Stays',
      align: 'right',
      cell: ({ history }) => (
        <div>
          <p className="tabular-nums text-ink/85">{history.stays}</p>
          <p className="text-xs text-ink/50">
            {history.nights} night{history.nights === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    ...(full
      ? ([
          {
            key: 'spent',
            header: 'Spent',
            align: 'right',
            hideBelow: 'sm',
            cell: ({ history }) => <span className="tabular-nums">{ugx(history.spent)}</span>,
          },
        ] as Column<Row>[])
      : []),
    {
      key: 'last',
      header: 'Last here',
      align: 'right',
      hideBelow: 'md',
      cell: ({ history }) => (
        <span className="text-xs text-ink/60">{history.lastStay ? dayMonth(history.lastStay) : 'Never'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Guest profiles"
        description="Everybody the hotel knows. Search by name, telephone or email."
        actions={<Button onClick={() => setCreating(true)}>New guest</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Guests" icon="guests" value={String(guests.length)} hint="On file" />
        <StatCard label="Come back" icon="occupancy" value={String(returning)} hint="More than one stay" tone={returning > 0 ? 'good' : 'default'} />
        <StatCard label="VIP" icon="alert" value={String(vips)} hint="Marked by the hotel" />
        {full ? (
          <StatCard label="Spent altogether" icon="money" value={ugx(spent)} hint="Finished stays" />
        ) : (
          <StatCard label="Known here" icon="calendar" value={String(rows.filter((r) => r.history.stays > 0).length)} hint="Have stayed before" />
        )}
      </div>

      {dupes.length > 0 && (
        <Card
          title="Possibly the same person"
          icon="alert"
          count={dupes.length}
          padded
          description="One guest recorded twice splits their history and their tier, and counts them twice in every figure."
        >
          <ul className="space-y-2">
            {dupes.map((d) => (
              <li
                key={`${d.a.id}-${d.b.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 p-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium text-ink">{d.a.name}</span>
                  <span className="mx-2 text-ink/40">and</span>
                  <span className="font-medium text-ink">{d.b.name}</span>
                  <span className="ml-2 text-xs text-ink/55">{d.reason}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => setJoining(d)}>
                  Look at them
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <FilterBar query={q} onQuery={(v) => setParam('q', v)} placeholder="Search name, telephone or email" />

      <Card title="Guests" icon="guests" count={rows.length} padded={false}>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={({ guest }) => guest.id}
          onRowClick={({ guest }) => navigate(`/desk/guests/${guest.id}`)}
          empty={{
            title: q ? 'Nobody matches that' : 'No guests yet',
            hint: q ? 'Try part of a name or the telephone number.' : 'A guest is created the first time somebody books.',
          }}
        />
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2.5 text-sm">
            <span className="text-ink/60">
              Page {page + 1} of {pages} · {rows.length} guests
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setParam('page', String(page - 1), '0')}>
                Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= pages - 1} onClick={() => setParam('page', String(page + 1), '0')}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {joining && (
        <MergeDialog
          a={joining.a}
          b={joining.b}
          onClose={() => setJoining(null)}
          onMerged={(keptId) => navigate(`/desk/guests/${keptId}`)}
        />
      )}

      {creating && (
        <GuestEditPanel
          onClose={() => setCreating(false)}
          onSaved={(g) => {
            setCreating(false)
            if (g?.id) navigate(`/desk/guests/${g.id}`)
          }}
        />
      )}
    </div>
  )
}
