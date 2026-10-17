import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TODAY } from '../../data/sample'
import { dayMonth, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { BIG_HOTEL } from '../../lib/rooms'
import FolioPanel from './FolioPanel'

const PAGE = 25
const chips = [
  { key: 'leaving', label: 'Leaving today' },
  { key: 'balance', label: 'Balance due' },
  { key: 'inhouse', label: 'All in house' },
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

  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice(page * PAGE, page * PAGE + PAGE)
  // Always the live record, so the panel updates as charges and payments are posted
  const selected = selectedId ? reservations.find((r) => r.id === selectedId) : undefined

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Folios</h1>
        <p className="text-sm text-ink/60">Charges, payments and check-out for guests in the house.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setParam('view', c.key, big ? 'leaving' : 'inhouse')}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              view === c.key ? 'bg-brand text-white' : 'bg-surface text-ink/70 hover:bg-ink/5'
            }`}
          >
            {c.label} ({counts[c.key]})
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="Search guest, room or booking"
          className="ml-auto w-64 rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/10 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">{view === 'out' ? 'Invoice' : 'Departure'}</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const balance = r.total - r.paid
              return (
                <tr
                  key={r.id}
                  onClick={() => setParam('r', r.id)}
                  className="cursor-pointer border-b border-ink/5 hover:bg-ink/5"
                >
                  <td className="px-4 py-3 font-medium text-brand">{r.guest}</td>
                  <td className="px-4 py-3">{r.room}</td>
                  <td className="px-4 py-3">{view === 'out' ? r.invoice?.number : dayMonth(r.departure)}</td>
                  <td className="px-4 py-3 text-right">{ugx(r.total)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${balance > 0 ? 'text-bad' : 'text-good'}`}>
                    {ugx(balance)}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/60">
                  {view === 'leaving' ? 'Nobody is due to leave today.' : 'No guests match.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink/60">
            Page {page + 1} of {pages} · {list.length} guests
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setParam('page', String(page - 1), '0')}
              className="rounded-lg border border-ink/15 px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages - 1}
              onClick={() => setParam('page', String(page + 1), '0')}
              className="rounded-lg border border-ink/15 px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && <FolioPanel reservation={selected} onClose={() => setParam('r', '')} />}
    </div>
  )
}