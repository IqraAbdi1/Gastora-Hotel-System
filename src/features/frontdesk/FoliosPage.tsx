import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, Chip, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { summarizeDay } from '../../lib/frontdesk'
import { nowTime } from '../../lib/stayTimes'
import { useFeatures } from '../platform/featuresContext'
import { useHotel } from '../../lib/hotelContext'
import { BIG_HOTEL } from '../../lib/rooms'
import type { Reservation } from '../../types'
import FolioPanel from './FolioPanel'

const PAGE = 25
const chips = [
  { key: 'leaving', label: 'Leaving today', dot: 'bg-warn' },
  { key: 'balance', label: 'Balance due', dot: 'bg-bad' },
  { key: 'inhouse', label: 'All in house', dot: 'bg-brand' },
  { key: 'out', label: 'Checked out' },
]

export default function FoliosPage() {
  const { reservations, rooms } = useHotel()
  const [params, setParams] = useSearchParams()

  const big = rooms.length > BIG_HOTEL
  const view = params.get('view') ?? (big ? 'leaving' : 'inhouse')
  const q = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)
  const selectedId = params.get('r')
  const startOn = params.get('tab') === 'charge' ? 'charge' : undefined

  // Open a guest's folio straight on the Add charge tab.
  function postChargeFor(id: string) {
    const next = new URLSearchParams(params)
    next.set('r', id)
    next.set('tab', 'charge')
    setParams(next, { replace: true })
  }
  function closeFolio() {
    const next = new URLSearchParams(params)
    next.delete('r')
    next.delete('tab')
    setParams(next, { replace: true })
  }

  function setParam(key: string, value: string, fallback = '') {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    if (key !== 'page' && key !== 'r') next.delete('page')
    setParams(next, { replace: true })
  }

  // Built once per data change
  const { inHouse, out } = useMemo(() => {
    const a = reservations.filter((r) => r.status === 'in-house')
    a.sort((x, y) => x.departure.localeCompare(y.departure) || (x.room ?? '').localeCompare(y.room ?? ''))
    const b = reservations.filter((r) => r.status === 'checked-out')
    b.sort((x, y) => (y.checkedOutAt ?? '').localeCompare(x.checkedOutAt ?? ''))
    return { inHouse: a, out: b }
  }, [reservations])

  const day = useMemo(() => summarizeDay(reservations, rooms, TODAY), [reservations, rooms])

  const counts: Record<string, number> = {
    leaving: inHouse.filter((r) => r.departure <= TODAY).length,
    balance: inHouse.filter((r) => r.total > r.paid).length,
    inhouse: inHouse.length,
    out: out.length,
  }

  const list = useMemo(() => {
    let base = inHouse
    if (view === 'leaving') base = inHouse.filter((r) => r.departure <= TODAY)
    else if (view === 'balance') base = inHouse.filter((r) => r.total > r.paid)
    else if (view === 'out') base = out
    const s = q.trim().toLowerCase()
    if (!s) return base
    return base.filter(
      (r) => r.guest.toLowerCase().includes(s) || (r.room ?? '').includes(s) || r.id.toLowerCase().includes(s),
    )
  }, [inHouse, out, view, q])

  const { stayTimes } = useFeatures()
  const pastCheckout = nowTime() > stayTimes.checkOutTime
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice(page * PAGE, page * PAGE + PAGE)
  // Always the live record, so the panel updates as charges and payments are posted
  const selected = selectedId ? reservations.find((r) => r.id === selectedId) : undefined

  const columns: Column<Reservation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.guest}</p>
          <p className="text-xs text-ink/55">{r.id}</p>
        </div>
      ),
    },
    { key: 'room', header: 'Room', cell: (r) => (r.room ? `Room ${r.room}` : '') },
    {
      key: 'when',
      header: view === 'out' ? 'Invoice' : 'Departure',
      cell: (r) =>
        view === 'out' ? (
          <span className="font-mono text-xs">{r.invoice?.number}</span>
        ) : r.departure < TODAY ? (
          <Badge tone="bad">Was due {dayMonth(r.departure)}</Badge>
        ) : r.departure === TODAY ? (
          pastCheckout && r.status === 'in-house' ? (
            <Badge tone="bad">Past check-out {stayTimes.checkOutTime}</Badge>
          ) : (
            <Badge tone="warn">Today</Badge>
          )
        ) : (
          dayMonth(r.departure)
        ),
    },
    { key: 'total', header: 'Total', align: 'right', hideBelow: 'sm', cell: (r) => <span className="tabular-nums">{ugx(r.total)}</span> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (r) => {
        const balance = r.total - r.paid
        return balance > 0 ? <Badge tone="bad">Owes {ugx(balance)}</Badge> : <Badge tone="good">Settled</Badge>
      },
    },
    {
      key: 'post',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status === 'in-house' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              postChargeFor(r.id)
            }}
          >
            Post charge
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Folios" description="Charges, payments and check-out for guests in the house." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="In house"
          icon="guests"
          value={day.inHouse.length}
          hint="Open folios"
          active={view === 'inhouse'}
          onClick={() => setParam('view', 'inhouse', big ? 'leaving' : 'inhouse')}
        />
        <StatCard
          label="Leaving today"
          icon="departure"
          value={day.leaving.length}
          hint={`${day.checkedOutCount} checked out today`}
          active={view === 'leaving'}
          onClick={() => setParam('view', 'leaving', big ? 'leaving' : 'inhouse')}
        />
        <StatCard
          label="Balances due"
          icon="money"
          value={day.owing.length}
          hint={day.owing.length ? `${ugx(day.owedTotal)} owed` : 'All settled'}
          tone={day.owing.length > 0 ? 'bad' : 'good'}
          active={view === 'balance'}
          onClick={() => setParam('view', 'balance', big ? 'leaving' : 'inhouse')}
        />
        <StatCard
          label="Checked out"
          icon="check"
          value={out.length}
          hint="Invoices issued"
          active={view === 'out'}
          onClick={() => setParam('view', 'out', big ? 'leaving' : 'inhouse')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip
            key={c.key}
            active={view === c.key}
            dot={c.dot}
            count={counts[c.key]}
            onClick={() => setParam('view', c.key, big ? 'leaving' : 'inhouse')}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <FilterBar query={q} onQuery={(v) => setParam('q', v)} placeholder="Search guest, room or booking" />

      <Card title={chips.find((c) => c.key === view)?.label ?? 'Folios'} icon="money" count={list.length} padded={false}>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(r) => r.id}
          onRowClick={(r) => setParam('r', r.id)}
          empty={{
            title: view === 'leaving' ? 'Nobody is due to leave today' : 'No guests match',
            hint: view === 'leaving' ? undefined : 'Change the filter or the search.',
          }}
        />
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2.5 text-sm">
            <span className="text-ink/60">
              Page {page + 1} of {pages} · {list.length} guests
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

      {selected && <FolioPanel key={`${selected.id}-${startOn ?? ''}`} reservation={selected} startOn={startOn} onClose={closeFolio} />}
    </div>
  )
}
