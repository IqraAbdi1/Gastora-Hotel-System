import type { ReservationStatus } from '../types'
import Badge from './ui/Badge'
import type { Tone } from './ui/Badge'

const tone: Record<ReservationStatus, Tone> = {
  booked: 'accent',
  'in-house': 'brand',
  'checked-out': 'neutral',
  cancelled: 'bad',
  'no-show': 'bad',
}

const label: Record<ReservationStatus, string> = {
  booked: 'Booked',
  'in-house': 'In house',
  'checked-out': 'Checked out',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
}

export default function StatusPill({ status }: { status: ReservationStatus }) {
  return <Badge tone={tone[status]}>{label[status]}</Badge>
}
