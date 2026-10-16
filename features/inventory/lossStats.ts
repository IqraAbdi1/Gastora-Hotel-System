import { DISPUTE_STALE_DAYS, LOSS_REASONS, REVERSAL_MIN_SAMPLE, lossValue } from '../procurement/requestsModel'
import type { LossReason, LossReport } from '../procurement/requestsModel'

export const sameMonth = (iso: string) => {
  const a = new Date(iso)
  const b = new Date()
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** A dispute that is still open: written off, flagged, not yet cleared or reversed. */
export const isDisputed = (l: LossReport) => l.status === 'Posted' && l.review?.verdict === 'Disputed'
export const isToReview = (l: LossReport) => l.status === 'Posted' && !l.review
export const isReversed = (l: LossReport) => l.status === 'Reversed'

/** An open dispute older than the stale limit. */
export const isStale = (l: LossReport) =>
  isDisputed(l) && !!l.review && Date.now() - new Date(l.review.at).getTime() > DISPUTE_STALE_DAYS * 86_400_000

/** Reversed, then the same person reported the same item again afterwards. */
export const isReReported = (r: LossReport, all: LossReport[]) => {
  const at = r.reversal?.at
  return (
    r.status === 'Reversed' &&
    !!at &&
    all.some((x) => x.id !== r.id && x.itemId === r.itemId && x.by === r.by && x.status !== 'Rejected' && x.at > at)
  )
}

/** Rule: of this month's write-offs that reached stock, the share that was reversed. */
export function reversalStats(losses: LossReport[], alertPct: number) {
  const accepted = losses.filter((l) => (l.status === 'Posted' || l.status === 'Reversed') && sameMonth(l.at))
  const reversed = accepted.filter(isReversed)
  const rate = accepted.length > 0 ? Math.round((reversed.length / accepted.length) * 100) : 0
  const high = alertPct > 0 && accepted.length >= REVERSAL_MIN_SAMPLE && rate > alertPct
  const reversedValue = reversed.reduce((s, l) => s + lossValue(l), 0)
  return { accepted: accepted.length, reversed, rate, high, reversedValue }
}

/** Written-off value per calendar month, oldest first. Reversed and waiting reports are not counted. */
export function monthlySeries(losses: LossReport[], months = 6) {
  const now = new Date()
  const rows: { key: string; label: string; value: number; count: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    rows.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString('en-GB', { month: 'short' }),
      value: 0,
      count: 0,
    })
  }
  for (const l of losses) {
    if (l.status !== 'Posted') continue
    const d = new Date(l.at)
    const row = rows.find((r) => r.key === `${d.getFullYear()}-${d.getMonth()}`)
    if (row) {
      row.value += lossValue(l)
      row.count += 1
    }
  }
  return rows
}

/** Written-off value per reason over the last months, biggest first. */
export function valueByReason(losses: LossReport[], months = 6) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).getTime()
  const totals = new Map<LossReason, number>()
  for (const l of losses) {
    if (l.status === 'Posted' && new Date(l.at).getTime() >= start) {
      totals.set(l.reason, (totals.get(l.reason) ?? 0) + lossValue(l))
    }
  }
  return LOSS_REASONS.map((reason) => ({ reason, value: totals.get(reason) ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
}

export const shortUGX = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n)