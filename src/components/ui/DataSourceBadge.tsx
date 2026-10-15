import { dataSource } from '../../lib/dataSource'
import Badge from './Badge'

// Tells staff where the numbers on a page come from, so sample data is never mistaken for the live hotel.
export default function DataSourceBadge() {
  return (
    <span title={dataSource.note}>
      <Badge tone={dataSource.kind === 'live' ? 'good' : 'accent'} dot>
        {dataSource.label}
      </Badge>
    </span>
  )
}
