import type { ReactNode } from 'react'
import { Badge } from '../../components/ui'
import type { JournalStatus } from '../../services/accounting/accountingTypes'
import { JOURNAL_LABEL, JOURNAL_TONE } from './accountingHelpers'

// Small pieces shared by the accounting pages.

/** Marks a figure that Trademate reported back. It is read-only here. */
export function FromTrademate({ at }: { at?: string }) {
  return (
    <span title={at ? `Last synced ${new Date(at).toLocaleString('en-GB')}` : undefined}>
      <Badge tone="info" dot>
        From Trademate
      </Badge>
    </span>
  )
}

export function JournalBadge({ status }: { status: JournalStatus }) {
  return (
    <Badge tone={JOURNAL_TONE[status]} dot>
      {JOURNAL_LABEL[status]}
    </Badge>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm font-medium text-bad">
      {children}
    </p>
  )
}

export function Notice({ tone = 'good', children }: { tone?: 'good' | 'warn'; children: ReactNode }) {
  return (
    <p role="status" className={`rounded-lg border px-3 py-2 text-sm font-medium ${tone === 'good' ? 'border-good/30 bg-good/5 text-good' : 'border-warn/30 bg-warn/5 text-warn'}`}>
      {children}
    </p>
  )
}


/** A line scaled between its own lowest and highest value, for figures like exchange rates that never touch zero. */
export function RateLine({ points }: { points: { label: string; value: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-ink/55">Not enough days yet.</p>
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const h = 100
  const step = 100 / (points.length - 1)
  const y = (v: number) => h - 10 - ((v - min) / span) * (h - 20)
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${(i * step).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' ')
  return (
    <div>
      <div className="flex justify-between text-[10px] text-ink/50">
        <span>High {max.toLocaleString('en-US')}</span>
        <span>Low {min.toLocaleString('en-US')}</span>
      </div>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="Rate history">
        <path d={`${path} L 100 ${h} L 0 ${h} Z`} fill="var(--color-brand)" opacity="0.08" />
        <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={p.label} cx={(i * step).toFixed(2)} cy={y(p.value).toFixed(2)} r="1.4" fill="var(--color-brand)">
            <title>{`${p.label}: ${p.value.toLocaleString('en-US')}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink/50">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}
