import { useState } from 'react'
import { useRequests } from './requestsContext'
import { formatUGX, requestTotal, statusLabel, statusStyles } from './requestsModel'
import type { RequestStatus, SupplyRequest } from './requestsModel'

type View = 'all' | 'open' | 'closed'
const PAGE = 6
const STEPS = ['Raised', 'Endorsed', 'Store check', 'Approved', 'Ordered', 'Received', 'Issued']

const DOT = { brand: 'bg-brand', good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', ink: 'bg-ink/40' }
const CHIP = {
  brand: 'bg-brand/10 text-brand',
  good: 'bg-good/15 text-good',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  ink: 'bg-ink/10 text-ink/70',
}
type Tone = keyof typeof DOT

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function kindOf(text: string): { label: string; tone: Tone } {
  const s = text.toLowerCase()
  if (s.startsWith('raised')) return { label: 'Raised', tone: 'ink' }
  if (s.includes('not needed')) return { label: 'Endorsement skipped', tone: 'ink' }
  if (s.includes('endorsed')) return { label: 'Endorsed', tone: 'brand' }
  if (s.startsWith('part issued')) return { label: 'Part issued', tone: 'good' }
  if (s.includes('requisition raised')) return { label: 'Requisition', tone: 'warn' }
  if (s.includes('sent to finance')) return { label: 'Sent to Finance', tone: 'warn' }
  if (s.startsWith('approved')) return { label: s.includes('over budget') ? 'Approved over budget' : 'Approved', tone: 'good' }
  if (s.includes('raised with')) return { label: 'Purchase order', tone: 'brand' }
  if (s.includes('goods received')) return { label: 'Received', tone: 'brand' }
  if (s.startsWith('issued')) return { label: 'Issued', tone: 'good' }
  if (s.startsWith('rejected')) return { label: 'Rejected', tone: 'bad' }
  return { label: 'Update', tone: 'ink' }
}

type StepState = 'done' | 'current' | 'todo' | 'skipped'

function stepStates(r: SupplyRequest): StepState[] {
  const reached: Partial<Record<RequestStatus, number>> = {
    'With head': 0,
    Endorsed: 1,
    Requisition: 2,
    'Needs finance': 2,
    Approved: 3,
    Ordered: 4,
    Received: 5,
    Issued: 6,
  }
  const rejected = r.status === 'Rejected'
  const idx = rejected ? (r.requisitionAt ? 2 : r.history.some((h) => /endorsed/i.test(h.text)) ? 1 : 0) : (reached[r.status] ?? 0)
  const direct = r.status === 'Issued' && !r.requisitionAt // issued straight from the store
  return STEPS.map((_, n) => {
    if (direct && n >= 3 && n <= 5) return 'skipped'
    if (n < idx) return 'done'
    if (n === idx) return r.status === 'Issued' ? 'done' : 'current'
    return 'todo'
  })
}

export default function AuditLogPage() {
  const { requests } = useRequests()
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const lastAt = (r: SupplyRequest) => r.history[r.history.length - 1]?.at ?? r.createdAt
  const isOpen = (r: SupplyRequest) => r.status !== 'Issued' && r.status !== 'Rejected'

  const list = requests
    .filter((r) => (view === 'all' ? true : view === 'open' ? isOpen(r) : !isOpen(r)))
    .filter((r) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      const hay = `${r.id} ${r.department} ${r.requester} ${r.items.map((i) => i.name).join(' ')} ${r.history
        .map((h) => `${h.by} ${h.text}`)
        .join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)))

  const stats = [
    { label: 'In progress', value: requests.filter(isOpen).length },
    { label: 'Waiting for approval', value: requests.filter((r) => r.status === 'Requisition' || r.status === 'Needs finance').length },
    { label: 'Issued', value: requests.filter((r) => r.status === 'Issued').length },
    { label: 'Rejected', value: requests.filter((r) => r.status === 'Rejected').length },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">Audit log</h1>
        <p className="text-sm text-ink/60">
          Every request from ask to issue, with who did what and when. Search a request ID, such as SR-1006.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-ink/10 bg-surface p-3">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-ink/60">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'open', 'closed'] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setView(v)
              setShown(PAGE)
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              view === v ? 'bg-brand text-white' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
            }`}
          >
            {v === 'all' ? 'All' : v === 'open' ? 'In progress' : 'Closed'}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShown(PAGE)
          }}
          placeholder="Search request ID, item, person or action"
          className="min-w-48 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
        />
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">Nothing matches.</p>
      ) : (
        <div className="space-y-3">
          {list.slice(0, shown).map((r) => (
            <TrailCard key={r.id} r={r} />
          ))}
          {list.length > shown && (
            <button
              type="button"
              onClick={() => setShown(shown + PAGE)}
              className="w-full rounded-lg border border-ink/15 py-2 text-sm font-medium text-ink/70"
            >
              Show more ({list.length - shown})
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TrailCard({ r }: { r: SupplyRequest }) {
  const [all, setAll] = useState(false)
  const states = stepStates(r)
  const rejected = r.status === 'Rejected'
  const total = requestTotal(r)
  const events = all ? r.history : r.history.slice(-3)
  const hidden = r.history.length - events.length

  return (
    <div className="rounded-xl border border-ink/10 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{r.id}</p>
          <p className="font-semibold">
            {r.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}
          </p>
          <p className="text-sm text-ink/60">
            {r.department} · {r.requester}
            {total > 0 && ` · ${formatUGX(total)}`}
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[r.status]}`}>
          {statusLabel(r.status)}
        </span>
      </div>

      <ol className="mt-4 flex items-start">
        {STEPS.map((label, n) => {
          const st = states[n]
          const dot =
            st === 'done'
              ? 'bg-good border-good'
              : st === 'current'
                ? rejected
                  ? 'bg-bad border-bad'
                  : 'bg-brand border-brand'
                : st === 'skipped'
                  ? 'border-dashed border-ink/30 bg-transparent'
                  : 'border-ink/20 bg-transparent'
          return (
            <li key={label} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={`h-px flex-1 ${n === 0 ? 'bg-transparent' : st === 'todo' ? 'bg-ink/15' : 'bg-good/50'}`} />
                <span className={`h-3 w-3 rounded-full border-2 ${dot}`} />
                <span
                  className={`h-px flex-1 ${n === STEPS.length - 1 ? 'bg-transparent' : states[n + 1] === 'todo' ? 'bg-ink/15' : 'bg-good/50'}`}
                />
              </div>
              <span className={`mt-1 text-[11px] leading-tight ${st === 'todo' ? 'text-ink/40' : st === 'skipped' ? 'text-ink/40 line-through' : 'text-ink/70'}`}>
                {label}
              </span>
            </li>
          )
        })}
      </ol>

      <ul className="mt-4 space-y-3 border-l border-ink/10 pl-4 text-sm">
        {events.map((h, n) => {
          const k = kindOf(h.text)
          return (
            <li key={n} className="relative">
              <span className={`absolute -left-5.25 top-1.5 h-2.5 w-2.5 rounded-full ${DOT[k.tone]}`} />
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP[k.tone]}`}>{k.label}</span>
                <span className="text-xs text-ink/50">
                  {h.by} · {time(h.at)}
                </span>
              </div>
              <p className="mt-0.5 text-ink/80">{h.text}</p>
            </li>
          )
        })}
      </ul>

      {r.history.length > 3 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-sm font-semibold text-brand hover:underline">
          {all ? 'Show less' : `Show full trail (${hidden} earlier)`}
        </button>
      )}
    </div>
  )
}