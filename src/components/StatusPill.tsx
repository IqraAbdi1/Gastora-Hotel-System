import type { ReservationStatus } from '../types'

const style: Record<ReservationStatus, string> = {
  booked: 'bg-accent/20 text-ink',
  'in-house': 'bg-brand/15 text-brand',
  'checked-out': 'bg-ink/10 text-ink/70',
  cancelled: 'bg-bad/10 text-bad',
  'no-show': 'bg-bad/10 text-bad',
}

const label: Record<ReservationStatus, string> = {
  booked: 'Booked',
  'in-house': 'In house',
  'checked-out': 'Checked out',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
}

export default function StatusPill({ status }: { status: ReservationStatus }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${style[status]}`}>
      {label[status]}
    </span>
  )
}