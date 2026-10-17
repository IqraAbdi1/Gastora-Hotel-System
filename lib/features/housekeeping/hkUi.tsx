import type { ReactNode } from 'react'
import { priorityStyles, statusStyles, taskStatusStyles } from './hkModel'
import type { HkStatus, Priority, TaskStatus } from './hkModel'

export const PAGE = 25

export const btnPrimary =
  'rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50'
export const btnGhost =
  'rounded-lg border border-ink/15 bg-surface px-3 py-2 text-xs font-semibold text-ink/70 hover:bg-canvas'
export const btnWarn =
  'rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100'
export const field =
  'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand'
export const card = 'rounded-xl border border-ink/10 bg-surface shadow-sm'

export function StatusChip({ status }: { status: HkStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}>
      {status}
    </span>
  )
}

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[priority]}`}>
      {priority}
    </span>
  )
}

export function TaskChip({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${taskStatusStyles[status]}`}>
      {status}
    </span>
  )
}

export function Pager({
  page,
  total,
  onPage,
  noun,
}: {
  page: number
  total: number
  onPage: (page: number) => void
  noun: string
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE))
  const from = total === 0 ? 0 : page * PAGE + 1
  const to = Math.min(total, page * PAGE + PAGE)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink/10 px-4 py-3">
      <p className="text-xs text-ink/60">
        {total === 0 ? `No ${noun}` : `Showing ${from}–${to} of ${total} ${noun}`}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className={btnGhost}>
            Previous
          </button>
          <span className="text-xs text-ink/60">
            {page + 1} / {pages}
          </span>
          <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className={btnGhost}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
    </div>
  )
}

export function PageHeader({ title, hint, children }: { title: string; hint: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Housekeeping</p>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-ink/60">{hint}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Modal({
  children,
  onClose,
  side = false,
  label,
}: {
  children: ReactNode
  onClose: () => void
  side?: boolean
  label: string
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex bg-ink/40 ${side ? 'justify-end' : 'items-center justify-center p-4'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </div>
  )
}