import type { ReactNode } from 'react'
import { REVERSAL_MIN_SAMPLE, formatUGX } from '../procurement/requestsModel'
import type { LossReason, LossReport } from '../procurement/requestsModel'
import { monthlySeries, shortUGX, valueByReason } from './lossStats'

const card = 'rounded-xl border border-ink/10 bg-surface p-4'

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
)

/**
 * A gradient bar that always shows its headline (children) and drops down the full panel when tapped.
 * `tone` is the gradient classes for the bar.
 */
export function Disclosure({
  open,
  onToggle,
  tone,
  children,
  panel,
}: {
  open: boolean
  onToggle: () => void
  tone: string
  children: ReactNode
  panel: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-white ${tone}`}
      >
        <span className="min-w-0">{children}</span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          {open ? 'Hide' : 'Show'}
          <Chevron open={open} />
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden" inert={!open}>
          <div className="p-4">{panel}</div>
        </div>
      </div>
    </section>
  )
}

/** Collapsed: one line with the headline numbers. Open: value by reason (tap a bar to filter) and the last six months. */
export function LossInsights({
  losses,
  activeReason,
  onPickReason,
  open,
  onToggle,
}: {
  losses: LossReport[]
  activeReason: LossReason | 'all'
  onPickReason: (r: LossReason) => void
  open: boolean
  onToggle: () => void
}) {
  const reasons = valueByReason(losses)
  const peak = reasons[0]?.value ?? 0
  const reasonTotal = reasons.reduce((s, r) => s + r.value, 0)

  const series = monthlySeries(losses)
  const max = Math.max(...series.map((s) => s.value), 0)
  const monthsTotal = series.reduce((s, r) => s + r.value, 0)

  // Rule: plain sums of posted write-offs. This month is only part of a month so far.
  const nowValue = series[series.length - 1].value
  const before = series[series.length - 2].value
  const change =
    before > 0
      ? `${nowValue >= before ? '▲' : '▼'} ${Math.abs(Math.round(((nowValue - before) / before) * 100))}% vs last month`
      : nowValue > 0
        ? 'New this month'
        : ''

  const W = 300
  const H = 130
  const pad = 16
  const base = 100
  const step = (W - pad * 2) / (series.length - 1)
  const pts = series.map((s, i) => ({
    ...s,
    x: pad + i * step,
    y: max > 0 ? base - (s.value / max) * (base - 30) : base,
  }))
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `M ${pts[0].x} ${base} ${pts.map((p) => `L ${p.x} ${p.y}`).join(' ')} L ${pts[pts.length - 1].x} ${base} Z`

  return (
    <Disclosure
      open={open}
      onToggle={onToggle}
      tone="bg-linear-to-r from-brand to-ink/90"
      panel={
        <div className="grid gap-3 md:grid-cols-2">
          <div className={card}>
            <p className="text-sm font-semibold">Lost to damage, by reason</p>
            <p className="mb-3 text-xs text-ink/60">Last 6 months · {formatUGX(reasonTotal)} · tap a bar to filter</p>
            {reasons.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink/60">No write-offs in the last 6 months.</p>
            ) : (
              <ul className="space-y-2">
                {reasons.map((r) => (
                  <li key={r.reason}>
                    <button
                      type="button"
                      onClick={() => onPickReason(r.reason)}
                      className={`block w-full rounded-lg p-1.5 text-left hover:bg-ink/5 ${
                        activeReason === r.reason ? 'bg-brand/10 ring-1 ring-brand/40' : ''
                      }`}
                    >
                      <span className="flex justify-between text-xs">
                        <span className="font-medium">{r.reason}</span>
                        <span className="text-ink/60">{formatUGX(r.value)}</span>
                      </span>
                      <span className="mt-1 block h-3 overflow-hidden rounded-full bg-ink/10">
                        <span
                          className="block h-full rounded-full bg-linear-to-r from-brand to-brand/50"
                          style={{ width: `${Math.max(4, (r.value / peak) * 100)}%` }}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={card}>
            <p className="text-sm font-semibold">Written off over time</p>
            <p className="mb-2 text-xs text-ink/60">Value per month · {formatUGX(monthsTotal)} in 6 months</p>
            {max === 0 ? (
              <p className="py-6 text-center text-sm text-ink/60">No write-offs in the last 6 months.</p>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-brand" role="img" aria-label="Written-off value per month">
                <defs>
                  <linearGradient id="lossArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1={pad} y1={base} x2={W - pad} y2={base} className="stroke-ink/15" strokeWidth="1" />
                <path d={areaD} fill="url(#lossArea)" />
                <path d={lineD} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                {pts.map((p) => (
                  <g key={p.key}>
                    <circle cx={p.x} cy={p.y} r="4" fill="currentColor">
                      <title>
                        {p.label}: {formatUGX(p.value)} ({p.count} reports)
                      </title>
                    </circle>
                    {p.value > 0 && (
                      <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="9" className="fill-ink/70">
                        {shortUGX(p.value)}
                      </text>
                    )}
                    <text x={p.x} y={H - 8} textAnchor="middle" fontSize="10" className="fill-ink/50">
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>
        </div>
      }
    >
      <span className="block text-sm font-semibold">Insights</span>
      <span className="mt-0.5 block text-xs text-white/80">
        {monthsTotal === 0
          ? 'No write-offs in the last 6 months'
          : `${formatUGX(monthsTotal)} lost in 6 months · Top reason: ${reasons[0]?.reason ?? '-'}${
              change ? ` · This month so far ${change}` : ''
            }`}
      </span>
    </Disclosure>
  )
}

/** Half-circle gauge: this month's reversal rate against the owner's flag limit. */
export function ReversalGauge({
  rate,
  alert,
  count,
  high,
}: {
  rate: number
  alert: number
  count: number
  high: boolean
}) {
  const len = Math.PI * 60
  const dash = `${(Math.min(rate, 100) / 100) * len} ${len}`
  const tone = high ? 'stroke-bad' : alert > 0 && rate > alert ? 'stroke-warn' : 'stroke-good'
  const angle = Math.PI * (1 - Math.min(alert, 100) / 100)
  const tick = (r: number) => ({ x: 80 + r * Math.cos(angle), y: 80 - r * Math.sin(angle) })
  const a = tick(50)
  const b = tick(70)

  return (
    <div className="text-center">
      <svg viewBox="0 0 160 96" className="mx-auto w-full max-w-52" role="img" aria-label={`Reversal rate ${rate} percent`}>
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" className="stroke-ink/10" strokeWidth="14" strokeLinecap="round" />
        {rate > 0 && (
          <path
            d="M 20 80 A 60 60 0 0 1 140 80"
            fill="none"
            className={tone}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={dash}
          />
        )}
        {alert > 0 && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-ink" strokeWidth="2.5" />}
        <text x="80" y="76" textAnchor="middle" fontSize="26" fontWeight="700" className="fill-ink">
          {rate}%
        </text>
      </svg>
      <p className="text-xs text-ink/60">{alert > 0 ? `Flag above ${alert}% (the black mark)` : 'Flag is off'}</p>
      <p className="text-xs text-ink/50">
        {count < REVERSAL_MIN_SAMPLE
          ? `${count} write-offs so far. The flag needs ${REVERSAL_MIN_SAMPLE}.`
          : `${count} write-offs this month`}
      </p>
    </div>
  )
}