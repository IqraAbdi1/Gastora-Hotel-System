import type { ReactNode } from 'react'
import Icon from './Icon'
import type { UiIconName } from './Icon'

export const cardClass = 'rounded-xl border border-ink/10 bg-surface shadow-sm'

// A white panel. Pass a title to get a header row; `padded={false}` lets a table run edge to edge.
export default function Card({
  title,
  icon,
  description,
  actions,
  count,
  padded = true,
  className = '',
  children,
}: {
  title?: ReactNode
  /** Small icon in front of the title. */
  icon?: UiIconName
  description?: ReactNode
  actions?: ReactNode
  /** Small number shown next to the title, such as how many rows the card lists. */
  count?: number
  padded?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`${cardClass} ${className}`}>
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 bg-linear-to-r from-brand/[0.06] via-brand/[0.02] to-transparent px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon name={icon} className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                {title}
                {count !== undefined && (
                  <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-semibold text-ink/60">{count}</span>
                )}
              </h2>
              {description && <p className="mt-0.5 text-xs text-ink/60">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  )
}
