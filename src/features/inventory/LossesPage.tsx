import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import {
  DISPUTE_STALE_DAYS,
  LOSS_REASONS,
  REVERSAL_MIN_SAMPLE,
  canReverse,
  formatUGX,
  lossValue,
} from '../procurement/requestsModel'
import type { LossReason, LossReport } from '../procurement/requestsModel'
import { Disclosure, LossInsights, ReversalGauge } from './LossCharts'
import LossSettingsDialog from './LossSettingsDialog'
import FilterBar from '../../components/FilterBar'
import { isDisputed, isReReported, isReversed, isStale, isToReview, reversalStats, sameMonth } from './lossStats'

type Tab = 'waiting' | 'review' | 'disputed' | 'reversed' | 'all'
type Extra =
  | { kind: 'month' | 'reversedMonth' | 'reReported' | 'stale' }
  | { kind: 'reversedBy'; who: string }
const PAGE = 12
/** A little longer than the panel's close animation, so the list scrolls into view after the page has settled. */
const SETTLE = 340

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function extraLabel(e: Extra) {
  switch (e.kind) {
    case 'month':
      return 'Written off this month'
    case 'reversedMonth':
      return 'Reversed this month'
    case 'reReported':
      return 'Reported again after reversal'
    case 'stale':
      return `Disputed over ${DISPUTE_STALE_DAYS} days`
    case 'reversedBy':
      return `Reversed by ${e.who}`
  }
}

function matchesExtra(l: LossReport, e: Extra, all: LossReport[]) {
  switch (e.kind) {
    case 'month':
      return l.status === 'Posted' && sameMonth(l.at)
    case 'reversedMonth':
      return l.status === 'Reversed' && sameMonth(l.at)
    case 'reReported':
      return isReReported(l, all)
    case 'stale':
      return isStale(l)
    case 'reversedBy':
      return l.reversal?.by === e.who
  }
}

function statusOf(l: LossReport): { label: string; cls: string } {
  if (l.status === 'Waiting approval') return { label: 'Waiting approval', cls: 'bg-warn/15 text-warn' }
  if (l.status === 'Rejected') return { label: 'Rejected', cls: 'bg-bad/15 text-bad' }
  if (l.status === 'Reversed') return { label: 'Reversed', cls: 'bg-ink/10 text-ink/70' }
  if (isDisputed(l)) return { label: 'Disputed', cls: 'bg-bad/15 text-bad' }
  if (!l.review) return { label: 'To review', cls: 'bg-brand/10 text-brand' }
  return { label: 'Written off', cls: 'bg-good/15 text-good' }
}

const svg = 'h-5 w-5'
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
const FlagIcon = () => (
  <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
  </svg>
)
const CoinIcon = () => (
  <svg viewBox="0 0 24 24" className={svg} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9 10c0-1 1-2 3-2s3 1 3 2-1 2-3 2-3 1-3 2 1 2 3 2 3-1 3-2" />
  </svg>
)

const TILE = {
  warn: { on: 'border-warn/40 bg-linear-to-br from-warn/20 to-warn/5', icon: 'bg-warn text-white' },
  brand: { on: 'border-brand/30 bg-linear-to-br from-brand/15 to-brand/5', icon: 'bg-brand text-white' },
  bad: { on: 'border-bad/40 bg-linear-to-br from-bad/20 to-bad/5', icon: 'bg-bad text-white' },
}

export default function LossesPage() {
  const { can } = useAuth()
  const { losses, lossLimit } = useRequests()
  const { features } = useFeatures()
  const approver = can('approveRequest')
  const admin = can('changeSettings')
  // Disputes, reversals and the reversal watch only exist when the hotel's plan has write-off reversal.
  const oversight = features.lossReversal

  const [tab, setTab] = useState<Tab>(approver ? 'waiting' : 'all')
  const [reason, setReason] = useState<LossReason | 'all'>('all')
  const [person, setPerson] = useState('all')
  const [query, setQuery] = useState('')
  const [extra, setExtra] = useState<Extra | null>(null)
  const [shown, setShown] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const [settings, setSettings] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [watchOpen, setWatchOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const waiting = losses.filter((l) => l.status === 'Waiting approval')
  const waitingValue = waiting.reduce((s, l) => s + lossValue(l), 0)
  const toReview = losses.filter(isToReview)
  const disputed = losses.filter(isDisputed)
  const reversed = losses.filter(isReversed)
  // Reversed write-offs are not in this total: the stock went back.
  const monthList = losses.filter((l) => l.status === 'Posted' && sameMonth(l.at))
  const monthValue = monthList.reduce((sum, l) => sum + lossValue(l), 0)
  const people = [...new Set(losses.map((l) => l.by))].sort()
  const insight = approver || admin

  const allTabs: { id: Tab; label: string; count: number }[] = [
    { id: 'waiting', label: 'Waiting approval', count: waiting.length },
    { id: 'review', label: 'To review', count: toReview.length },
    { id: 'disputed', label: 'Disputed', count: disputed.length },
    { id: 'reversed', label: 'Reversed', count: reversed.length },
    { id: 'all', label: 'All', count: losses.length },
  ]
  const tabs = oversight ? allTabs : allTabs.filter((t) => t.id !== 'disputed' && t.id !== 'reversed')

  const list = losses
    .filter((l) =>
      tab === 'waiting'
        ? l.status === 'Waiting approval'
        : tab === 'review'
          ? isToReview(l)
          : tab === 'disputed'
            ? isDisputed(l)
            : tab === 'reversed'
              ? isReversed(l)
              : true,
    )
    .filter((l) => !extra || matchesExtra(l, extra, losses))
    .filter((l) => reason === 'all' || l.reason === reason)
    .filter((l) => person === 'all' || l.by === person)
    .filter((l) => {
      const q = query.trim().toLowerCase()
      return !q || `${l.id} ${l.item} ${l.by} ${l.note} ${l.lastSeen ?? ''}`.toLowerCase().includes(q)
    })
    .sort((a, b) => b.at.localeCompare(a.at))

  function reset() {
    setShown(PAGE)
  }

  function focusList(delay = 30) {
    window.setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), delay)
  }

  /** Closes the insights and the reversal watch so the list is in view. Returns true if one was open. */
  function closePanels() {
    const was = insightsOpen || watchOpen
    setInsightsOpen(false)
    setWatchOpen(false)
    return was
  }

  /** Jump to a tab with clean filters, then bring the list into view. */
  function openTab(next: Tab, e: Extra | null = null) {
    const was = closePanels()
    setTab(next)
    setExtra(e)
    setReason('all')
    setPerson('all')
    setQuery('')
    reset()
    focusList(was ? SETTLE : 30)
  }

  function pickReason(r: LossReason) {
    const was = closePanels()
    setTab('all')
    setExtra(null)
    setPerson('all')
    setQuery('')
    setReason(reason === r ? 'all' : r)
    reset()
    focusList(was ? SETTLE : 30)
  }

  const allTiles: {
    id: string
    label: string
    value: string
    sub: string
    hot: boolean
    pulse: boolean
    tone: keyof typeof TILE
    icon: ReactNode
    go: () => void
  }[] = [
    {
      id: 'waiting',
      label: 'Waiting approval',
      value: String(waiting.length),
      sub: formatUGX(waitingValue),
      hot: waiting.length > 0,
      pulse: approver && waiting.length > 0,
      tone: 'warn',
      icon: <ClockIcon />,
      go: () => openTab('waiting'),
    },
    {
      id: 'month',
      label: 'Written off this month',
      value: formatUGX(monthValue),
      sub: `${monthList.length} reports`,
      hot: true,
      pulse: false,
      tone: 'brand',
      icon: <CoinIcon />,
      go: () => openTab('all', { kind: 'month' }),
    },
    {
      id: 'disputed',
      label: 'Disputed',
      value: String(disputed.length),
      sub: disputed.length > 0 ? 'Needs a decision' : 'None open',
      hot: disputed.length > 0,
      pulse: false,
      tone: 'bad',
      icon: <FlagIcon />,
      go: () => openTab('disputed'),
    },
  ]
  const tiles = oversight ? allTiles : allTiles.filter((t) => t.id !== 'disputed')

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Damaged &amp; lost</h1>
          <p className="text-sm text-ink/60">
            Small write-offs post at once and are reviewed later. Large ones wait for the general manager.
          </p>
        </div>
        {admin && (
          <button
            type="button"
            onClick={() => setSettings(true)}
            className="rounded-lg border border-ink/20 bg-surface px-3 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5"
          >
            Approval limit: {lossLimit > 0 ? formatUGX(lossLimit) : 'none'} · Change
          </button>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-3 ${oversight ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={t.go}
            className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-md ${
              t.hot ? TILE[t.tone].on : 'border-ink/10 bg-surface'
            }`}
          >
            {t.pulse && (
              <span className="absolute right-3 top-3 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warn opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warn" />
              </span>
            )}
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                t.hot ? TILE[t.tone].icon : 'bg-ink/10 text-ink/60'
              }`}
            >
              {t.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold sm:text-xl">{t.value}</span>
              <span className="block text-xs text-ink/60">
                {t.label} · {t.sub}
              </span>
            </span>
          </button>
        ))}
      </div>

      {insight && (
        <LossInsights
          losses={losses}
          activeReason={reason}
          onPickReason={pickReason}
          open={insightsOpen}
          onToggle={() => setInsightsOpen(!insightsOpen)}
        />
      )}

      {admin && oversight && (
        <Oversight losses={losses} open={watchOpen} onToggle={() => setWatchOpen(!watchOpen)} onOpen={openTab} />
      )}

      <div ref={listRef} className="scroll-mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                setExtra(null)
                reset()
              }}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                tab === t.id ? 'bg-brand text-white' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {extra && (
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-brand/10 px-3 py-1 font-medium text-brand">Filtered: {extraLabel(extra)}</span>
            <button
              type="button"
              onClick={() => {
                setExtra(null)
                reset()
              }}
              className="text-ink/60 underline"
            >
              Clear
            </button>
          </div>
        )}

                <FilterBar
          query={query}
          onQuery={(v) => {
            setQuery(v)
            reset()
          }}
          placeholder="Search item, report ID, person or note"
          active={(reason !== 'all' ? 1 : 0) + (person !== 'all' ? 1 : 0)}
        >
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as LossReason | 'all')
              reset()
            }}
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All reasons</option>
            {LOSS_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select
            value={person}
            onChange={(e) => {
              setPerson(e.target.value)
              reset()
            }}
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Everyone</option>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </FilterBar>

        {list.length === 0 ? (
          <p className="rounded-xl border border-ink/10 bg-surface p-6 text-center text-sm text-ink/60">
            {losses.length === 0 ? 'No damaged or lost stock has been reported.' : 'No reports match.'}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink/5 text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2">Reported</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {list.slice(0, shown).map((l) => {
                  const st = statusOf(l)
                  return (
                    <tr key={l.id} onClick={() => setOpenId(l.id)} className="cursor-pointer hover:bg-ink/5">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          {l.evidence ? (
                            <img src={l.evidence} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-ink/5 text-[10px] text-ink/40">
                              No photo
                            </span>
                          )}
                          <span>
                            <button type="button" className="block text-left font-medium">
                              {l.qty} {l.unit} × {l.item}
                            </button>
                            <span className="block text-xs text-ink/50">{l.id}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2">{l.reason}</td>
                      <td className="px-4 py-2 text-right">{formatUGX(lossValue(l))}</td>
                      <td className="px-4 py-2 text-ink/60">
                        {l.by}
                        <span className="block text-xs">{time(l.at)}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
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

      {openId && <LossDetail id={openId} onClose={() => setOpenId(null)} />}
      {settings && admin && <LossSettingsDialog onClose={() => setSettings(false)} />}
    </div>
  )
}

/** For the owner and hotel admin only: how often the general manager reverses write-offs. */
function Oversight({
  losses,
  open,
  onToggle,
  onOpen,
}: {
  losses: LossReport[]
  open: boolean
  onToggle: () => void
  onOpen: (tab: Tab, extra?: Extra | null) => void
}) {
  const { reversalAlert } = useRequests()
  const stats = reversalStats(losses, reversalAlert)
  const reReported = losses.filter((l) => isReReported(l, losses)).length
  const stale = losses.filter(isStale).length

  const byPerson = new Map<string, { n: number; value: number }>()
  for (const l of stats.reversed) {
    const name = l.reversal?.by ?? 'Unknown'
    const row = byPerson.get(name) ?? { n: 0, value: 0 }
    byPerson.set(name, { n: row.n + 1, value: row.value + lossValue(l) })
  }

  const badge = stats.high
    ? { text: 'High reversal rate', cls: 'bg-white text-bad' }
    : reversalAlert === 0
      ? { text: 'Flag off', cls: 'bg-white/15 text-white' }
      : stats.accepted < REVERSAL_MIN_SAMPLE
        ? { text: `Needs ${REVERSAL_MIN_SAMPLE} write-offs`, cls: 'bg-white/15 text-white' }
        : { text: 'Within limit', cls: 'bg-good text-white' }

  const items: { label: string; value: string; sub: string; hot: boolean; go: () => void }[] = [
    {
      label: 'Reversed this month',
      value: String(stats.reversed.length),
      sub: formatUGX(stats.reversedValue),
      hot: stats.reversed.length > 0,
      go: () => onOpen('reversed', { kind: 'reversedMonth' }),
    },
    {
      label: 'Reported again after reversal',
      value: String(reReported),
      sub: 'Possible wrong reversals',
      hot: reReported > 0,
      go: () => onOpen('reversed', { kind: 'reReported' }),
    },
    {
      label: `Disputed over ${DISPUTE_STALE_DAYS} days`,
      value: String(stale),
      sub: 'Still open',
      hot: stale > 0,
      go: () => onOpen('disputed', { kind: 'stale' }),
    },
  ]

  return (
    <Disclosure
      open={open}
      onToggle={onToggle}
      tone={stats.high ? 'bg-linear-to-r from-bad to-ink/90' : 'bg-linear-to-r from-ink/90 to-brand'}
      panel={
        <div className="space-y-3">
          <p className="text-xs text-ink/60">Only the owner and hotel admin see this. Tap a number to see the reports.</p>
          <div className="grid gap-4 md:grid-cols-[210px_1fr]">
            <ReversalGauge rate={stats.rate} alert={reversalAlert} count={stats.accepted} high={stats.high} />

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {items.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={t.go}
                    className={`rounded-lg border p-3 text-left transition hover:shadow-md ${
                      t.hot ? 'border-bad/30 bg-linear-to-br from-bad/15 to-bad/5' : 'border-ink/10 bg-ink/5'
                    }`}
                  >
                    <span className="block text-xl font-bold">{t.value}</span>
                    <span className="block text-xs text-ink/70">{t.label}</span>
                    <span className="block text-[11px] text-ink/50">{t.sub}</span>
                  </button>
                ))}
              </div>

              {byPerson.size > 0 && (
                <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10 text-sm">
                  {[...byPerson.entries()].map(([name, row]) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => onOpen('reversed', { kind: 'reversedBy', who: name })}
                        className="flex w-full justify-between px-3 py-2 text-left hover:bg-ink/5"
                      >
                        <span className="font-medium">{name}</span>
                        <span className="text-ink/60">
                          {row.n} reversed · {formatUGX(row.value)} →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      }
    >
      <span className="block text-sm font-semibold">Reversal watch · this month</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/80">
        <span>
          {stats.rate}% reversed ({stats.reversed.length} of {stats.accepted})
        </span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${badge.cls}`}>{badge.text}</span>
      </span>
    </Disclosure>
  )
}

function LossDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAuth()
  const { losses, decideLoss, reviewLoss, reverseLoss } = useRequests()
  const { features } = useFeatures()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const l = losses.find((x) => x.id === id)
  if (!l) return null

  const approver = can('approveRequest')
  const st = statusOf(l)
  const fact = 'text-xs text-ink/50'
  const open = isToReview(l) || isDisputed(l)
  const oversight = features.lossReversal

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4">
      <div className="my-6 w-full max-w-lg space-y-4 rounded-xl bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              {l.id} · {l.qty} {l.unit} × {l.item}
            </h2>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm font-medium text-ink/70"
          >
            Close
          </button>
        </div>

        {l.evidence && (
          <img src={l.evidence} alt="Evidence" className="max-h-72 w-full rounded-lg bg-ink/5 object-contain" />
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className={fact}>Reason</dt>
            <dd className="font-medium">{l.reason}</dd>
          </div>
          <div>
            <dt className={fact}>Value written off</dt>
            <dd className="font-medium">
              {formatUGX(lossValue(l))} ({l.qty} × {formatUGX(l.unitCost)})
            </dd>
          </div>
          <div>
            <dt className={fact}>Reported by</dt>
            <dd className="font-medium">{l.by}</dd>
          </div>
          <div>
            <dt className={fact}>Reported</dt>
            <dd className="font-medium">{time(l.at)}</dd>
          </div>
          {l.lastSeen && (
            <div className="col-span-2">
              <dt className={fact}>Last seen</dt>
              <dd className="font-medium">{l.lastSeen}</dd>
            </div>
          )}
        </dl>

        <div>
          <p className={fact}>What happened</p>
          <p className="text-sm">{l.note}</p>
        </div>

        <ul className="space-y-1 border-t border-ink/10 pt-3 text-sm text-ink/70">
          <li>
            {time(l.at)} · {l.by} · Reported
          </li>
          {l.decidedBy && l.decidedAt && (
            <li>
              {time(l.decidedAt)} · {l.decidedBy} · {l.status === 'Rejected' ? 'Rejected' : 'Approved'}
              {l.decisionNote ? `: ${l.decisionNote}` : ''}
            </li>
          )}
          {l.earlierReview && (
            <li>
              {time(l.earlierReview.at)} · {l.earlierReview.by} · {l.earlierReview.verdict}
              {l.earlierReview.note ? `: ${l.earlierReview.note}` : ''}
            </li>
          )}
          {l.review && (
            <li>
              {time(l.review.at)} · {l.review.by} ·{' '}
              {l.review.verdict === 'Reviewed' && l.earlierReview ? 'Dispute cleared' : l.review.verdict}
              {l.review.note ? `: ${l.review.note}` : ''}
            </li>
          )}
          {l.reversal && (
            <li>
              {time(l.reversal.at)} · {l.reversal.by} · Reversed, stock put back: {l.reversal.note}
            </li>
          )}
        </ul>

        {l.status === 'Reversed' && (
          <p className="rounded-lg bg-ink/5 p-3 text-sm text-ink/70">
            The stock was put back and this report is closed. If the goods really are missing, report them again or the
            next stock count will show it.
          </p>
        )}

        {error && <p className="text-sm text-bad">{error}</p>}

        {l.status === 'Waiting approval' && !approver && (
          <p className="text-sm text-ink/60">Waiting for the general manager. Stock is unchanged until it is approved.</p>
        )}

        {approver && l.status === 'Waiting approval' && (
          <div className="space-y-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (needed to reject)"
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setError(decideLoss(l.id, true, note) ?? '')}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              >
                Approve write-off
              </button>
              <button
                type="button"
                onClick={() => setError(decideLoss(l.id, false, note) ?? '')}
                className="rounded-lg border border-bad px-3 py-1.5 text-sm font-semibold text-bad"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {approver && open && (
          <div className="space-y-2">
            {(oversight || isDisputed(l)) && (
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isDisputed(l) ? 'Note (needed to clear the dispute or reverse)' : 'Note (needed to dispute or reverse)'
                }
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {isToReview(l) ? (
                <>
                  <button
                    type="button"
                    onClick={() => setError(reviewLoss(l.id, 'Reviewed', note) ?? '')}
                    className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Mark reviewed
                  </button>
                  {oversight && (
                    <button
                      type="button"
                      onClick={() => setError(reviewLoss(l.id, 'Disputed', note) ?? '')}
                      className="rounded-lg border border-bad px-3 py-1.5 text-sm font-semibold text-bad"
                    >
                      Dispute (flag only)
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setError(reviewLoss(l.id, 'Reviewed', note) ?? '')}
                  className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Clear dispute
                </button>
              )}
              {oversight && canReverse(l) && !confirming && (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="rounded-lg bg-bad px-3 py-1.5 text-sm font-semibold text-white"
                >
                  {isToReview(l) ? 'Dispute and reverse…' : 'Reverse write-off…'}
                </button>
              )}
            </div>

            {confirming && canReverse(l) && (
              <div className="space-y-2 rounded-lg border border-bad/40 bg-bad/5 p-3 text-sm">
                <p>
                  This puts {l.qty} {l.unit} of {l.item} back into stock. A reversed write-off cannot be reviewed or reversed
                  again. Check the evidence and the store first.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const result = reverseLoss(l.id, note)
                      setError(result ?? '')
                      if (!result) setConfirming(false)
                    }}
                    className="rounded-lg bg-bad px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Yes, put it back
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm font-medium text-ink/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}