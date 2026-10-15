import { Fragment, useState } from 'react'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import {
  COUNT_REASONS,
  MAIN_STORE_ID,
  STOCK_CATEGORIES,
  countValue,
  countVariance,
  formatUGX,
  lossValue,
} from '../procurement/requestsModel'
import type { CountStatus, StockCount } from '../procurement/requestsModel'
import type { CountClass } from '../procurement/cycleCount'
import { EvidenceThumb } from './Evidence'

const STATUS: Record<CountStatus, { label: string; cls: string }> = {
  Counting: { label: 'Counting', cls: 'bg-warn/15 text-warn' },
  'Waiting approval': { label: 'Review and post', cls: 'bg-brand/10 text-brand' },
  Posted: { label: 'Posted', cls: 'bg-good/15 text-good' },
  Rejected: { label: 'Discarded', cls: 'bg-bad/15 text-bad' },
}

const ALL = 'All items'
/** A scope value that starts with this is a store id. Anything else is a category name. */
const STORE = 'store:'
const PAGE = 6
/** A cycle count takes at most this many items at once, most valuable first, so it stays a short job. */
const CYCLE_MAX = 20

const CLASSES: { id: CountClass; label: string }[] = [
  { id: 'A', label: 'A: highest value' },
  { id: 'B', label: 'B: middle' },
  { id: 'C', label: 'C: the rest' },
]

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

export function StockCountPage() {
  const q = useRequests()
  const { can } = useAuth()
  const { features } = useFeatures()
  const [scope, setScope] = useState(ALL)
  const [shown, setShown] = useState(PAGE)
  const [error, setError] = useState('')
  const counter = can('countStock')
  const admin = can('changeSettings')

  // Everyone else only sees counts that have been posted.
  const counts = [...q.counts]
    .filter((c) => counter || c.status === 'Posted')
    .sort((a, b) => b.at.localeCompare(a.at))

  // Cycle count: the items whose turn has come, class A first.
  const due = q.countsDue
  const cycle = due.slice(0, CYCLE_MAX)
  const open = q.counts.some((c) => c.status === 'Counting' || c.status === 'Waiting approval')

  function start() {
    if (scope.startsWith(STORE)) {
      const id = scope.slice(STORE.length)
      const ids = q.stock.filter((s) => (s.store ?? MAIN_STORE_ID) === id).map((s) => s.id)
      const res = q.startCount(q.storeName(id), ids)
      setError(res.ok ? '' : res.error)
      return
    }
    const ids = q.stock.filter((s) => scope === ALL || (s.category ?? 'Other') === scope).map((s) => s.id)
    const res = q.startCount(scope, ids)
    setError(res.ok ? '' : res.error)
  }

  function startCycle() {
    const res = q.startCount('Cycle count', cycle.map((d) => d.item.id))
    setError(res.ok ? '' : res.error)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Stock counts</h1>
          <p className="text-sm text-ink/60">
            {counter
              ? 'Count blind: the book quantity stays hidden until you submit. Then explain every variance and post the count.'
              : 'Counts are done by the general manager. Posted counts appear here.'}
          </p>
        </div>
        {counter && (
          <div className="flex items-center gap-2">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm"
            >
              <option value={ALL}>{ALL}</option>
              {features.stores && (
                <optgroup label="Stores">
                  {q.stores.map((s) => (
                    <option key={s.id} value={`${STORE}${s.id}`}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Categories">
                {STOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            </select>
            <button onClick={start} className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
              Start count
            </button>
          </div>
        )}
      </div>

      {counter && due.length > 0 && (
        <div className="rounded-xl border border-brand/20 bg-linear-to-r from-brand/10 to-good/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">
                {due.length} item{due.length === 1 ? '' : 's'} due for a count
              </p>
              <p className="text-xs text-ink/60">
                Items are ranked by value on hand. Class A is counted every {q.countDays.A} days, B every {q.countDays.B},
                C every {q.countDays.C}. Never counted comes first.
              </p>
            </div>
            <button
              onClick={startCycle}
              disabled={open}
              title={open ? 'Finish the count that is open first' : undefined}
              className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Start cycle count ({cycle.length}
              {due.length > cycle.length ? ` of ${due.length}` : ''})
            </button>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-ink/60">See the items</summary>
            <ul className="mt-2 divide-y divide-ink/10 rounded-lg bg-white/60 text-sm">
              {cycle.map((d) => (
                <li key={d.item.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span>
                    <span className="mr-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{d.cls}</span>
                    {d.item.name}
                  </span>
                  <span className="text-xs text-ink/60">
                    {d.last ? `last counted ${time(d.last)}` : 'never counted'} · {formatUGX(d.value)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {admin && (
        <details className="rounded-xl border border-ink/10 bg-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold">Count schedule</summary>
          <p className="mt-2 text-xs text-ink/60">Days between counts for each class. Class is set by value on hand.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {CLASSES.map((c) => (
              <label key={c.id} className="text-xs font-medium text-ink/60">
                {c.label}
                <input
                  key={q.countDays[c.id]}
                  defaultValue={q.countDays[c.id]}
                  inputMode="numeric"
                  onBlur={(e) => setError(q.setCountDays(c.id, parseInt(e.target.value, 10) || 1) ?? '')}
                  className="ml-2 w-20 rounded-lg border border-ink/15 bg-white px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>
        </details>
      )}

      {error && <p className="text-sm text-bad">{error}</p>}

      {counts.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">
          {counter
            ? `No counts yet. Pick ${features.stores ? 'a store, a category' : 'a category'} (or all items) and start one.`
            : 'No posted counts yet.'}
        </div>
      )}

      {counts.slice(0, shown).map((c) => (
        <CountCard key={c.id} c={c} />
      ))}

      {counts.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full rounded-lg border border-ink/15 py-2 text-sm text-ink/70"
        >
          Show more ({counts.length - shown} left)
        </button>
      )}
    </div>
  )
}

function CountCard({ c }: { c: StockCount }) {
  const q = useRequests()
  const { can } = useAuth()
  const [open, setOpen] = useState(c.status === 'Counting' || c.status === 'Waiting approval')
  const [error, setError] = useState('')

  const counter = can('countStock')
  const counting = c.status === 'Counting'
  const reviewing = c.status === 'Waiting approval'
  const canCount = counting && counter
  const done = c.lines.filter((l) => l.counted !== null).length
  const allCounted = done === c.lines.length
  const diff = countValue(c)
  const st = STATUS[c.status]
  const missing = c.lines.filter((l) => countVariance(l) !== 0 && !l.reason).length

  // Write-offs for an item since it was last counted, plus any still waiting approval.
  const lastPosted = (itemId: string) =>
    q.counts
      .filter((x) => x.status === 'Posted' && x.id !== c.id && x.lines.some((l) => l.itemId === itemId))
      .map((x) => x.decidedAt ?? x.at)
      .sort()
      .pop() ?? ''
  const related = (itemId: string) => {
    const since = lastPosted(itemId)
    return q.losses.filter(
      (l) => l.itemId === itemId && l.status !== 'Rejected' && (l.status === 'Waiting approval' || l.at > since),
    )
  }

  const cols = counting ? 2 : 6

  return (
    <div className="rounded-xl border border-ink/10 bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
      >
        <div>
          <div className="font-medium text-ink">
            {c.id} · {c.scope}
          </div>
          <div className="text-xs text-ink/60">
            {c.by} · {time(c.at)} · {counting ? `${done} of ${c.lines.length} counted` : `${c.lines.length} items`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!counting && (
            <span className={`text-sm font-medium ${diff < 0 ? 'text-bad' : diff > 0 ? 'text-good' : 'text-ink/60'}`}>
              {diff > 0 ? '+' : ''}
              {formatUGX(diff)}
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-ink/10 p-4">
          {counting && (
            <p className="mb-3 text-xs text-ink/60">
              Enter what you physically count. Leave an item blank if you have not counted it yet.
            </p>
          )}
          {reviewing && (
            <p className="mb-3 text-xs text-ink/60">
              Give a reason for every variance. Write-offs reported for an item are shown under it. A write-off waiting
              approval has not been taken out of the book quantity yet.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/60">
                  <th className="py-1.5 pr-3 font-medium">Item</th>
                  {!counting && <th className="py-1.5 pr-3 text-right font-medium">Book</th>}
                  <th className="py-1.5 pr-3 text-right font-medium">Counted</th>
                  {!counting && <th className="py-1.5 pr-3 text-right font-medium">Variance</th>}
                  {!counting && <th className="py-1.5 pr-3 text-right font-medium">Value</th>}
                  {!counting && <th className="py-1.5 font-medium">Reason</th>}
                </tr>
              </thead>
              <tbody>
                {c.lines.map((l) => {
                  const v = countVariance(l)
                  const rel = reviewing ? related(l.itemId) : []
                  const pendingQty = rel.filter((r) => r.status === 'Waiting approval').reduce((s, r) => s + r.qty, 0)
                  return (
                    <Fragment key={l.itemId}>
                      <tr className="border-t border-ink/5">
                        <td className="py-1.5 pr-3 text-ink">
                          {l.name} <span className="text-xs text-ink/50">({l.unit})</span>
                        </td>
                        {!counting && <td className="py-1.5 pr-3 text-right">{l.system}</td>}
                        <td className="py-1.5 pr-3 text-right">
                          {canCount ? (
                            <input
                              type="number"
                              min={0}
                              value={l.counted ?? ''}
                              onChange={(e) => {
                                const n = e.target.value === '' ? NaN : Number(e.target.value)
                                q.setCounted(c.id, l.itemId, Number.isNaN(n) ? null : Math.max(0, n))
                              }}
                              className="w-20 rounded border border-ink/15 bg-canvas px-2 py-1 text-right"
                            />
                          ) : (
                            (l.counted ?? '')
                          )}
                        </td>
                        {!counting && (
                          <td
                            className={`py-1.5 pr-3 text-right ${v < 0 ? 'text-bad' : v > 0 ? 'text-good' : 'text-ink/60'}`}
                          >
                            {signed(v)}
                          </td>
                        )}
                        {!counting && <td className="py-1.5 pr-3 text-right text-ink/70">{formatUGX(v * l.unitCost)}</td>}
                        {!counting && (
                          <td className="py-1.5">
                            {v === 0 ? (
                              <span className="text-ink/40">None</span>
                            ) : reviewing && counter ? (
                              <select
                                value={l.reason ?? ''}
                                onChange={(e) => q.setCountReason(c.id, l.itemId, e.target.value)}
                                className="rounded border border-ink/15 bg-canvas px-2 py-1 text-xs"
                              >
                                <option value="">Choose reason</option>
                                {COUNT_REASONS.map((r) => (
                                  <option key={r}>{r}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-ink/70">{l.reason ?? ''}</span>
                            )}
                          </td>
                        )}
                      </tr>
                      {reviewing && (rel.length > 0 || v < 0) && (
                        <tr>
                          <td colSpan={cols} className="pb-2 text-xs">
                            {rel.length === 0 && v < 0 && (
                              <p className="text-bad">No damaged or lost report for this item. Variance is unexplained.</p>
                            )}
                            {rel.map((r) => (
                              <div key={r.id} className="mt-1 flex items-start gap-2 rounded-lg bg-ink/5 p-2">
                                {r.evidence && <EvidenceThumb src={r.evidence} />}
                                <p className="flex-1 text-ink/80">
                                  <span className="font-medium">
                                    {r.id} · {r.qty} × {r.reason} · {formatUGX(lossValue(r))}
                                  </span>{' '}
                                  ·{' '}
                                  {r.status === 'Waiting approval'
                                    ? 'waiting approval (not yet taken out of the book)'
                                    : 'already taken out of the book'}{' '}
                                  · {r.by} · {time(r.at)}
                                  <br />
                                  {r.lastSeen ? `Last seen: ${r.lastSeen}. ` : ''}
                                  {r.note}
                                </p>
                              </div>
                            ))}
                            {pendingQty > 0 && (
                              <p className="mt-1 font-medium text-ink/70">
                                Variance not explained by waiting reports: {signed(v + pendingQty)}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {c.decidedBy && (
            <p className="mt-3 text-xs text-ink/60">
              {c.status === 'Posted' ? 'Posted' : 'Discarded'} by {c.decidedBy}
              {c.decidedAt ? ` · ${time(c.decidedAt)}` : ''}
              {c.note ? ` · ${c.note}` : ''}
            </p>
          )}

          {error && <p className="mt-3 text-sm text-bad">{error}</p>}

          {counting && canCount && (
            <div className="mt-4 flex justify-end">
              <button
                disabled={!allCounted}
                onClick={() => setError(q.submitCount(c.id) ?? '')}
                className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {allCounted ? 'Submit counts' : 'Count every item to submit'}
              </button>
            </div>
          )}

          {reviewing && counter && (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {missing > 0 && <span className="text-xs text-warn">{missing} variance(s) need a reason.</span>}
              <button
                onClick={() => setError(q.decideCount(c.id, false, '') ?? '')}
                className="rounded-lg border border-bad/40 px-3 py-2 text-sm font-medium text-bad"
              >
                Discard count
              </button>
              <button
                disabled={missing > 0}
                onClick={() => setError(q.decideCount(c.id, true, '') ?? '')}
                className="rounded-lg bg-good px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Post count and adjust stock
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default StockCountPage