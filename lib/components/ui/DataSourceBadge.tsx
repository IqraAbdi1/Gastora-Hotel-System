import { dataSource } from '../../lib/dataSource'
import Badge from './Badge'

// Tells staff where the numbers on a page come from, so sample data is never mistaken for the live hotel.
// `onDark` is for placing it on the green brand colour.
export default function DataSourceBadge({ onDark = false }: { onDark?: boolean }) {
  if (onDark) {
    return (
      <span
        title={dataSource.note}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-ink"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-ink/60" aria-hidden="true" />
        {dataSource.label}
      </span>
    )
  }
  return (
    <span title={dataSource.note}>
      <Badge tone={dataSource.kind === 'live' ? 'good' : 'accent'} dot>
        {dataSource.label}
      </Badge>
    </span>
  )
}
