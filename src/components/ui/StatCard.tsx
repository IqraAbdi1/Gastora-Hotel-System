import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import type { UiIconName } from './Icon'

export type StatTone = 'default' | 'good' | 'warn' | 'bad'

const valueClass: Record<StatTone, string> = {
  default: 'text-ink',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
}

const tint: Record<StatTone, string> = {
  default: 'from-brand/[0.08]',
  good: 'from-good/[0.10]',
  warn: 'from-warn/[0.10]',
  bad: 'from-bad/[0.10]',
}

const iconClass: Record<StatTone, string> = {
  default: 'bg-brand/10 text-brand',
  good: 'bg-good/10 text-good',
  warn: 'bg-warn/10 text-warn',
  bad: 'bg-bad/10 text-bad',
}

// One summary number. With `to`, the whole card links to the list behind the number.
export default function StatCard({
  label,
  value,
  hint,
  to,
  onClick,
  active = false,
  icon,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  to?: string
  /** Makes the card a button, for cards that filter the list on the same page. */
  onClick?: () => void
  /** Marks the card whose filter is on. */
  active?: boolean
  icon?: UiIconName
  tone?: StatTone
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</p>
        {icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass[tone]}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className={`-mt-1 text-2xl font-bold tabular-nums ${valueClass[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-ink/60">{hint}</p>}
    </>
  )
  const box = `block rounded-xl border border-ink/10 bg-linear-to-br ${tint[tone]} via-surface to-surface px-4 py-3 shadow-sm`
  const hover =
    'text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand'
  if (onClick)
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`${box} w-full ${hover} ${active ? 'border-brand ring-2 ring-brand/30' : ''}`}
      >
        {body}
      </button>
    )
  if (!to) return <div className={box}>{body}</div>
  return (
    <Link
      to={to}
      className={`${box} transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand`}
    >
      {body}
    </Link>
  )
}
