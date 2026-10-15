import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type StatTone = 'default' | 'good' | 'warn' | 'bad'

const toneClass: Record<StatTone, string> = {
  default: 'text-ink',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
}

// One summary number. With `to`, the whole card links to the list behind the number.
export default function StatCard({
  label,
  value,
  hint,
  to,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  to?: string
  tone?: StatTone
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-ink/60">{hint}</p>}
    </>
  )
  const box = 'block rounded-xl border border-ink/10 bg-surface px-4 py-3 shadow-sm'
  if (!to) return <div className={box}>{body}</div>
  return (
    <Link to={to} className={`${box} transition hover:border-brand/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand`}>
      {body}
    </Link>
  )
}
