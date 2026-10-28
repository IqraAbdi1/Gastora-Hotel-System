import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Badge, Button, DataTable, Modal } from '../../components/ui'
import type { Column } from '../../components/ui'
import { ugx } from '../../lib/format'
import type { DrillRow } from '../../services/reports/analytics'

export function SampleBadge({ label = 'Sample' }: { label?: string }) {
  return <Badge tone="warn">{label}</Badge>
}

/** Horizontal bars for any kind of figure, each row optionally clickable. */
export function Bars({
  rows,
  format = (n) => n.toLocaleString('en-US'),
}: {
  rows: { label: string; value: number; hint?: string; tone?: 'brand' | 'warn' | 'bad' | 'good' | 'accent'; onClick?: () => void }[]
  format?: (n: number) => string
}) {
  if (rows.length === 0) return <p className="text-sm text-ink/55">Nothing to show yet.</p>
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1)
  const colour = { brand: 'var(--color-brand)', warn: 'var(--color-warn)', bad: 'var(--color-bad)', good: 'var(--color-good)', accent: 'var(--color-accent)' }
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-ink/70">
                {r.label}
                {r.hint && <span className="text-ink/45"> · {r.hint}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{format(r.value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/8">
              <div className="h-full rounded-full" style={{ width: `${(Math.abs(r.value) / max) * 100}%`, background: colour[r.tone ?? 'brand'] }} />
            </div>
          </>
        )
        return (
          <li key={r.label}>
            {r.onClick ? (
              <button type="button" onClick={r.onClick} className="block w-full rounded-md text-left hover:bg-canvas/70">
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Simple vertical bars over time, two series side by side when `compare` is given. */
export function ColumnChart({ points, format = (n) => n.toLocaleString('en-US') }: { points: { label: string; value: number; compare?: number }[]; format?: (n: number) => string }) {
  if (points.length === 0) return <p className="text-sm text-ink/55">Nothing to show yet.</p>
  const max = Math.max(...points.flatMap((p) => [p.value, p.compare ?? 0]), 1)
  const hasCompare = points.some((p) => p.compare !== undefined)
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 128 }}>
        {points.map((p) => (
          <div key={p.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" title={`${p.label}: ${format(p.value)}${p.compare !== undefined ? ` · before ${format(p.compare)}` : ''}`}>
            {hasCompare && <div className="w-full rounded-t bg-ink/15" style={{ height: `${((p.compare ?? 0) / max) * 100}%` }} />}
            <div className="w-full rounded-t bg-brand" style={{ height: `${(Math.max(p.value, 0) / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-ink/50">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}

/** The records behind a figure. Each row opens its own page where there is one the person may open. */
export function DrillPanel({
  title,
  description,
  rows,
  canOpen,
  onClose,
  onExport,
}: {
  title: string
  description?: ReactNode
  rows: DrillRow[]
  canOpen: (path: string) => boolean
  onClose: () => void
  onExport: () => void
}) {
  const total = rows.reduce((n, r) => n + r.amount, 0)
  const columns: Column<DrillRow>[] = [
    { key: 'date', header: 'Date', cell: (r) => <span className="tabular-nums text-ink/70">{r.date}</span> },
    {
      key: 'ref',
      header: 'Record',
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {r.to && canOpen(r.to.split('?')[0]) ? (
              <Link to={r.to} className="text-brand hover:underline">
                {r.ref}
              </Link>
            ) : (
              r.ref
            )}{' '}
            <span className="font-normal text-ink/60">· {r.name}</span>
          </p>
          <p className="text-xs text-ink/55">{r.detail}</p>
        </div>
      ),
      className: 'whitespace-normal',
    },
    { key: 'kind', header: 'Kind', cell: (r) => <Badge tone={r.kind.includes('sample') || r.kind.includes('Cost') ? 'warn' : 'neutral'}>{r.kind}</Badge>, hideBelow: 'sm' },
    { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className={`tabular-nums font-semibold ${r.amount < 0 ? 'text-bad' : ''}`}>{ugx(r.amount)}</span> },
  ]
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      side
      wide
      footer={
        <>
          <span className="mr-auto self-center text-sm text-ink/70">
            {rows.length} row{rows.length === 1 ? '' : 's'} · <span className="font-semibold tabular-nums">{ugx(total)}</span>
          </span>
          <Button variant="ghost" onClick={onExport} disabled={rows.length === 0}>
            Export CSV
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="-mx-5 -my-4">
        <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.kind}-${r.id}`} empty={{ title: 'No records in this period' }} />
      </div>
    </Modal>
  )
}

const PRINT_STYLE_ID = 'gst-report-print-style'

/** A print-friendly copy of a report. The browser's print dialog saves it as PDF. */
export function PrintView({ title, subtitle, children, onDone }: { title: string; subtitle?: string; children: ReactNode; onDone: () => void }) {
  useEffect(() => {
    if (!document.getElementById(PRINT_STYLE_ID)) {
      const style = document.createElement('style')
      style.id = PRINT_STYLE_ID
      style.textContent =
        '.gst-print{display:none}@media print{body.gst-printing>*:not(.gst-print){display:none!important}body.gst-printing .gst-print{display:block}}'
      document.head.appendChild(style)
    }
    document.body.classList.add('gst-printing')
    const done = () => onDone()
    window.addEventListener('afterprint', done)
    const t = window.setTimeout(() => window.print(), 150)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('afterprint', done)
      document.body.classList.remove('gst-printing')
    }
  }, [onDone])

  return createPortal(
    <div className="gst-print bg-white p-8 text-black">
      <h1 className="text-xl font-bold">{title}</h1>
      {subtitle && <p className="mb-4 text-sm text-black/60">{subtitle}</p>}
      {children}
    </div>,
    document.body,
  )
}
