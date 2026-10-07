import type { ReservationStatus } from '../types'

const styles: Record<ReservationStatus, string> = {
  booked: 'bg-accent/15 text-warn',
  'in-house': 'bg-brand/10 text-brand',
  'checked-out': 'bg-ink/10 text-ink/70',
}

const labels: Record<ReservationStatus, string> = {
  booked: 'Booked',
  'in-house': 'In house',
  'checked-out': 'Checked out',
}

export default function StatusPill({ status }: { status: ReservationStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>
}