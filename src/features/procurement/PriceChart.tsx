import { ugx } from '../../lib/format'

// Area I: a price line scaled to its own range, so a 2% rise is visible. A dashed line marks the
// contract price when there is one.
export default function PriceChart({ points, reference }: { points: { label: string; value: number; hint?: string }[]; reference?: number }) {
  if (points.length < 2) return <p className="text-sm text-ink/55">Not enough prices to draw a line yet.</p>
  const values = [...points.map((p) => p.value), ...(reference ? [reference] : [])]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || hi * 0.05 || 1) * 0.15
  const min = lo - pad
  const max = hi + pad
  const w = 100
  const h = 120
  const x = (i: number) => (i / (points.length - 1)) * w
  const y = (v: number) => h - ((v - min) / (max - min)) * h
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex w-24 shrink-0 flex-col justify-between text-right text-[10px] text-ink/50">
          <span>{ugx(Math.round(max))}</span>
          <span>{ugx(Math.round(min))}</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-32 min-w-0 flex-1" role="img" aria-label="Price over time">
          <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="var(--color-ink)" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" />
          {reference !== undefined && (
            <line x1="0" x2={w} y1={y(reference)} y2={y(reference)} stroke="var(--color-accent)" strokeDasharray="4 3" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
              <title>{`Contract ${ugx(reference)}`}</title>
            </line>
          )}
          <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.value)} r="1.4" fill="var(--color-brand)">
              <title>{`${p.label}: ${ugx(p.value)}${p.hint ? ` · ${p.hint}` : ''}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between pl-26 text-[10px] text-ink/50">
        <span>{points[0].label}</span>
        {reference !== undefined && <span className="text-ink/60">- - contract {ugx(reference)}</span>}
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}
