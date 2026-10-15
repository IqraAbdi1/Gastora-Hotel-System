import type { ReactNode } from 'react'
import { EmptyState } from './States'

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Hide below this screen width, for columns that are nice to have. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const hideClass = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

// A plain table: header row, one row per item, an empty message when there are none.
// Wide tables scroll inside their card, never the whole page.
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: { title: string; hint?: ReactNode }
  onRowClick?: (row: T) => void
}) {
  if (rows.length === 0 && empty) return <EmptyState title={empty.title} hint={empty.hint} />

  const hide = (c: Column<T>) => (c.hideBelow ? hideClass[c.hideBelow] : '')
  const align = (c: Column<T>) => (c.align === 'right' ? 'text-right' : 'text-left')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink/10 bg-canvas/60">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/55 ${align(c)} ${hide(c)}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/8">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-canvas/70' : ''}
            >
              {columns.map((c) => (
                <td key={c.key} className={`whitespace-nowrap px-4 py-3 align-middle ${align(c)} ${hide(c)} ${c.className ?? ''}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
