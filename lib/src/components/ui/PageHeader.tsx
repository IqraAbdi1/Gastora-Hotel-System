import type { ReactNode } from 'react'

// Title block at the top of a page: module name, page title, one line of context, and page actions.
export default function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: {
  /** The module, such as "Front desk". */
  eyebrow?: string
  title: string
  description?: ReactNode
  /** Small badges next to the title, such as the data source. */
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-0.5 text-sm text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
