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
        {/* The top bar already names the module, so the eyebrow is kept for screen readers only. */}
        {eyebrow && <p className="sr-only">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
