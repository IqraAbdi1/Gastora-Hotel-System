import { useId } from 'react'

// Small charts drawn as SVG, so the app keeps its own look and carries no charting library.
// Every one is given numbers that were worked out from the hotel's records.

const money = (n: number) => `UGX ${Math.round(n).toLocaleString('en-US')}`

/** Where a value sits between 0 and the top of the scale. */
const scale = (v: number, max: number) => (max <= 0 ? 0 : v / max)

export type Point = { label: string; value: number; hint?: string; muted?: boolean }

/**
 * A filled line over time. Days after today are drawn faded, because they are bookings, not earnings.
 */
export function AreaChart({ points, height = 120, suffix = '' }: { points: Point[]; height?: number; suffix?: string }) {
  const id = useId()
  if (points.length < 2) return <p className="text-sm text-ink/55">Not enough days to draw a line yet.</p>
  const max = Math.max(...points.map((p) => p.value), 1)
  const w = 100
  const step = w / (points.length - 1)
  const y = (v: number) => height - scale(v, max) * (height - 16) - 8
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')
  const area = `${path} L ${w} ${height} L 0 ${height} Z`
  const firstFuture = points.findIndex((p) => p.muted)

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="Trend">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {firstFuture > 0 && (
          <rect
            x={(firstFuture * step).toFixed(2)}
            y="0"
            width={(w - firstFuture * step).toFixed(2)}
            height={height}
            fill="var(--color-ink)"
            opacity="0.04"
          />
        )}
        <path d={area} fill={`url(#g${id})`} />
        <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={(i * step).toFixed(2)}
            cy={y(p.value).toFixed(2)}
            r="1.6"
            fill="var(--color-brand)"
            opacity={p.muted ? 0.4 : 1}
          >
            <title>{`${p.label}: ${p.value}${suffix}${p.hint ? ` · ${p.hint}` : ''}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink/50">
        <span>{points[0].label}</span>
        {firstFuture > 0 && <span className="text-ink/40">booked from {points[firstFuture].label}</span>}
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

export type StackedBar = { label: string; parts: { key: string; value: number }[] }

const SERIES_COLOUR: Record<string, string> = {
  Rooms: 'var(--color-brand)',
  'Food and drink': 'var(--color-accent)',
  Extras: 'var(--color-info)',
}

/** Money per day, split by where it came from. */
export function StackedBars({ bars, keys }: { bars: StackedBar[]; keys: string[] }) {
  const totals = bars.map((b) => b.parts.reduce((n, p) => n + p.value, 0))
  const max = Math.max(...totals, 1)

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 128 }}>
        {bars.map((b, i) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label}: ${money(totals[i])}`}>
            <div className="flex w-full shrink-0 flex-col-reverse overflow-hidden rounded-t" style={{ height: `${Math.max(scale(totals[i], max) * 100, totals[i] > 0 ? 2 : 0)}%` }}>
              {b.parts.map((p) =>
                p.value > 0 ? (
                  <div
                    key={p.key}
                    style={{ height: `${(p.value / Math.max(totals[i], 1)) * 100}%`, background: SERIES_COLOUR[p.key] ?? 'var(--color-brand)' }}
                  />
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink/50">
        <span>{bars[0]?.label}</span>
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-ink/70">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLOUR[k] ?? 'var(--color-brand)' }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}

export type Slice = { label: string; value: number; colour: string }

/** A ring showing how a whole splits up, with the total in the middle. */
export function Donut({ slices, centre, caption }: { slices: Slice[]; centre: string; caption?: string }) {
  const total = slices.reduce((n, s) => n + s.value, 0)
  const r = 42
  const c = 2 * Math.PI * r
  // Each slice starts where the last one ended: the start is the sum of the slices before it.
  const lengths = slices.map((s) => (total ? (s.value / total) * c : 0))
  const arcs = slices.map((slice, i) => ({
    slice,
    len: lengths[i],
    start: lengths.slice(0, i).reduce((n, x) => n + x, 0),
  }))

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 110 110" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label={caption ?? 'Breakdown'}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--color-ink)" strokeOpacity="0.08" strokeWidth="14" />
        {arcs.map(({ slice: s, len, start }) => (
          <circle
            key={s.label}
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke={s.colour}
            strokeWidth="14"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-start}
          >
            <title>{`${s.label}: ${s.value}`}</title>
          </circle>
        ))}
        <text x="55" y="52" textAnchor="middle" className="rotate-90 fill-ink text-[14px] font-bold" style={{ transformOrigin: '55px 55px' }}>
          {centre}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-ink/70">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.colour }} />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Simple horizontal bars for amounts, such as money owed by age. */
export function MoneyBars({ rows }: { rows: { label: string; amount: number; count?: number; tone?: 'bad' | 'warn' | 'brand' }[] }) {
  const max = Math.max(...rows.map((r) => r.amount), 1)
  const colour = { bad: 'var(--color-bad)', warn: 'var(--color-warn)', brand: 'var(--color-brand)' }
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-ink/70">
              {r.label}
              {r.count !== undefined && <span className="text-ink/45"> · {r.count}</span>}
            </span>
            <span className="font-semibold tabular-nums">{money(r.amount)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/8">
            <div
              className="h-full rounded-full"
              style={{ width: `${scale(r.amount, max) * 100}%`, background: colour[r.tone ?? 'brand'] }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
