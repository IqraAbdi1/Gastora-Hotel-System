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

// A thin coloured rule on the left marks a number that needs a look; an ordinary number has none.
const edge: Record<StatTone, string> = {
  default: '',
  good: '',
  warn: 'before:bg-warn',
  bad: 'before:bg-bad',
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
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12.5px] font-medium text-ink/60">{label}</p>
        {icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconClass[tone]}`}>
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-[22px] font-bold leading-tight tracking-tight tabular-nums ${valueClass[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-ink/55">{hint}</p>}
    </>
  )
  const box = `relative block overflow-hidden rounded-xl border border-ink/10 bg-surface px-4 py-3 before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${edge[tone]}`
  const hover = 'text-left transition hover:border-brand/40 hover:bg-brand/[0.02] focus-visible:outline-2 focus-visible:outline-brand'
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
      className={`${box} ${hover}`}
    >
      {body}
    </Link>
  )
}
