import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FilterBar from '../../components/FilterBar'
import { Badge, Button, Card, Chip, DataTable, PageHeader, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { folioOf } from '../../lib/folio'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { defaultHouseRules } from '../../lib/rates'
import { isTaxCategory, vatInsideOf } from '../../lib/tax'
import type { Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import DocumentDialog from '../receipts/DocumentDialog'
import { folioDoc, registrationCardDoc } from '../receipts/documents'

const PAGE = 12

type View = 'invoices' | 'open' | 'today' | 'cards' | 'all'

const chips: { key: View; label: string; dot?: string }[] = [
  { key: 'invoices', label: 'Tax invoices', dot: 'bg-good' },
  { key: 'open', label: 'Open folios', dot: 'bg-brand' },
  { key: 'today', label: 'Issued today', dot: 'bg-warn' },
  { key: 'cards', label: 'Registration cards', dot: 'bg-info' },
  { key: 'all', label: 'All' },
]

/**
 * A stay has a registration card once somebody has checked in and the details were recorded. It is
 * not the key card: it opens no doors. It is the record of who stayed, which is what an inspector asks
 * for.
 */
const hasCard = (r: Reservation) => !!r.details && (r.status === 'in-house' || r.status === 'checked-out')

/** What kind of document a stay has right now. The folio becomes a receipt once it is settled, and a tax invoice at check-out. */
function kindOf(r: Reservation): { label: string; tone: 'good' | 'brand' | 'neutral' } {
  if (r.invoice) return { label: 'Tax invoice', tone: 'good' }
  if (r.total - r.paid <= 0) return { label: 'Guest receipt', tone: 'brand' }
  return { label: 'Guest folio', tone: 'neutral' }
}

// Every guest document in one place: invoices issued at check-out and the folios of guests still in the house.
// Search by guest, room or invoice number, then print. The sheet is the same one the folio prints.
export default function GuestDocumentsPage() {
  const { reservations, guests } = useHotel()
  const { tenant, tax, options, stayTimes } = useFeatures()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [printing, setPrinting] = useState<{ id: string; kind: 'folio' | 'card' } | null>(null)

  const view = (params.get('view') ?? 'invoices') as View
  const q = params.get('q') ?? ''
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0)

  function setParam(key: string, value: string, fallback = '') {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const withDocs = useMemo(
    () => reservations.filter((r) => r.invoice || r.status === 'in-house' || r.status === 'checked-out'),
    [reservations],
  )
  const counts = useMemo(
    () => ({
      invoices: withDocs.filter((r) => r.invoice).length,
      open: withDocs.filter((r) => r.status === 'in-house').length,
      today: withDocs.filter((r) => r.invoice?.issuedAt?.startsWith(TODAY)).length,
      cards: withDocs.filter(hasCard).length,
      all: withDocs.length,
    }),
    [withDocs],
  )

  const list = useMemo(() => {
    const text = q.trim().toLowerCase()
    return withDocs
      .filter((r) => {
        if (view === 'invoices' && !r.invoice) return false
        if (view === 'open' && r.status !== 'in-house') return false
        if (view === 'today' && !r.invoice?.issuedAt?.startsWith(TODAY)) return false
        if (view === 'cards' && !hasCard(r)) return false
        if (!text) return true
        return [r.guest, r.id, r.room ?? '', r.invoice?.number ?? '', r.corporate?.accountName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(text)
      })
      .sort((a, b) => (b.invoice?.issuedAt ?? b.arrival).localeCompare(a.invoice?.issuedAt ?? a.arrival))
  }, [withDocs, view, q])

  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice(page * PAGE, page * PAGE + PAGE)
  const open = printing ? reservations.find((r) => r.id === printing.id) : undefined

  const columns: Column<Reservation>[] = [
    {
      key: 'doc',
      header: 'Document',
      cell: (r) => {
        const k = kindOf(r)
        return (
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{r.invoice?.number ?? r.id}</p>
            <p className="text-xs text-ink/55">{k.label}</p>
          </div>
        )
      },
    },
    {
      key: 'guest',
      header: 'Guest',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{r.guest}</p>
          <p className="text-xs text-ink/55">
            {r.room ? `Room ${r.room}` : r.roomType}
            {r.corporate ? ` · ${r.corporate.accountName}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'when',
      header: 'Issued',
      hideBelow: 'sm',
      cell: (r) =>
        r.invoice ? (
          <span className="text-xs">{r.invoice.issuedAt}</span>
        ) : (
          <span className="text-xs text-ink/55">Open · leaves {dayMonth(r.departure)}</span>
        ),
    },
    {
      key: 'efris',
      header: 'EFRIS',
      hideBelow: 'md',
      cell: (r) =>
        !r.invoice ? null : r.invoice.fiscal === 'efris' ? (
          <Badge tone="good" dot>
            Fiscalised
          </Badge>
        ) : r.invoice.fiscal === 'exempt' ? (
          <Badge tone="neutral">Exempt</Badge>
        ) : (
          <Badge tone="warn">Not set up</Badge>
        ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => <span className="tabular-nums">{ugx(r.invoice?.amount ?? r.total)}</span>,
    },
    {
      key: 'print',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex flex-wrap justify-end gap-2">
          {hasCard(r) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                setPrinting({ id: r.id, kind: 'card' })
              }}
            >
              Registration card
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation()
              setPrinting({ id: r.id, kind: 'folio' })
            }}
          >
            Print
          </Button>
        </div>
      ),
    },
  ]

  const vatOf = (r: Reservation) => {
    if (!tax || !tax.vatOn || tax.vatMode !== 'included') return 0
    const f = folioOf(r)
    const taxLines = (r.charges ?? []).filter((c) => isTaxCategory(c.category)).reduce((n, c) => n + c.amount, 0)
    return vatInsideOf(f.total - taxLines, tax.vatRate)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Guest documents"
        description="Every registration card, folio, receipt and tax invoice. Search, open and print."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Tax invoices"
          icon="money"
          value={counts.invoices}
          hint="Issued at check-out"
          active={view === 'invoices'}
          onClick={() => setParam('view', 'invoices', 'invoices')}
        />
        <StatCard
          label="Open folios"
          icon="list"
          value={counts.open}
          hint="Guests in the house"
          active={view === 'open'}
          onClick={() => setParam('view', 'open', 'invoices')}
        />
        <StatCard
          label="Issued today"
          icon="calendar"
          value={counts.today}
          hint={TODAY}
          active={view === 'today'}
          onClick={() => setParam('view', 'today', 'invoices')}
        />
        <StatCard
          label="Registration cards"
          icon="guests"
          value={counts.cards}
          hint="Who stayed, and what they agreed"
          active={view === 'cards'}
          onClick={() => setParam('view', 'cards', 'invoices')}
        />
        <StatCard
          label="All documents"
          icon="tasks"
          value={counts.all}
          hint="Including checked out"
          active={view === 'all'}
          onClick={() => setParam('view', 'all', 'invoices')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.key} active={view === c.key} dot={c.dot} count={counts[c.key]} onClick={() => setParam('view', c.key, 'invoices')}>
            {c.label}
          </Chip>
        ))}
      </div>

      <FilterBar query={q} onQuery={(v) => setParam('q', v)} placeholder="Search guest, room, booking or invoice number" />

      <Card title={chips.find((c) => c.key === view)?.label ?? 'Documents'} icon="money" count={list.length} padded={false}>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(r) => r.id}
          onRowClick={(r) => setPrinting({ id: r.id, kind: view === 'cards' ? 'card' : 'folio' })}
          empty={{
            title:
              view === 'invoices'
                ? 'No invoice has been issued yet'
                : view === 'cards'
                  ? 'No registration card yet'
                  : 'No documents match',
            hint:
              view === 'invoices'
                ? 'An invoice is created when a guest checks out.'
                : view === 'cards'
                  ? 'A card is made when a guest is checked in.'
                  : 'Change the filter or the search.',
          }}
        />
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2.5 text-sm">
            <span className="text-ink/60">
              Page {page + 1} of {pages} · {list.length} documents
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

      {open && printing && (
        <DocumentDialog
          doc={
            printing.kind === 'card'
              ? registrationCardDoc(
                  open,
                  tenant.name,
                  user?.name ?? 'Front desk',
                  options.rates.houseRules || defaultHouseRules(stayTimes.checkInTime, stayTimes.checkOutTime),
                  guests.find((g) => g.id === open.guestId)?.loyaltyConsent,
                )
              : folioDoc(open, tenant.name, user?.name ?? 'Front desk', {
                  vatInside: vatOf(open),
                  vatRate: tax?.vatRate,
                })
          }
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  )
}
