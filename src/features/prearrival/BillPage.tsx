import { useParams } from 'react-router-dom'
import { TODAY } from '../../data/sample'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { folioOf } from '../../lib/folio'
import { useHotel } from '../../lib/hotelContext'
import { tokenFor } from '../../lib/preRegistration'
import GuestFeedbackForm from '../feedback/GuestFeedbackForm'
import { useFeatures } from '../platform/featuresContext'

// The guest's own copy of the bill, opened from the link in the message after an express checkout.
// Read only, no sign-in, and it shows one stay: the one whose link the guest is holding.
export default function BillPage() {
  const { token = '' } = useParams()
  const { reservations } = useHotel()
  const { tenant } = useFeatures()
  const stay = reservations.find((r) => tokenFor(r.id, r.arrival) === token)

  if (!stay) {
    return (
      <Shell hotel={tenant.name}>
        <p className="text-sm text-ink/70">This bill is no longer available. Please ask the hotel for a copy.</p>
      </Shell>
    )
  }

  const f = folioOf(stay)
  const charges = stay.charges ?? []
  const payments = stay.payments ?? []

  return (
    <Shell hotel={tenant.name}>
      <div className="rounded-xl border border-ink/10 bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-base font-semibold text-ink">{stay.guest}</p>
            <p className="text-xs text-ink/60">
              Room {stay.room} · {dayMonth(stay.arrival)} to {dayMonth(stay.departure)} · {nightsBetween(stay.arrival, stay.departure)} night(s)
            </p>
          </div>
          {stay.invoice && <p className="text-xs text-ink/60">Invoice {stay.invoice.number}</p>}
        </div>

        <dl className="mt-4 space-y-1.5 text-sm">
          <Line label="Room" value={ugx(f.roomCharge)} />
          {charges.map((ch) => (
            <Line key={ch.id} label={`${ch.description} (${ch.category})`} value={ugx(ch.amount)} />
          ))}
          <div className="border-t border-ink/10 pt-1.5">
            <Line label="Total" value={ugx(f.total)} strong />
          </div>
          {payments.map((p) => (
            <Line key={p.id} label={`Paid · ${p.method}${p.reference ? ` · ${p.reference}` : ''}`} value={`− ${ugx(p.amount)}`} />
          ))}
          {f.earlier > 0 && <Line label="Paid earlier" value={`− ${ugx(f.earlier)}`} />}
          <div className="border-t border-ink/10 pt-1.5">
            <Line label="Balance" value={ugx(f.balance)} strong />
          </div>
        </dl>

        {stay.invoice?.fiscalCode && (
          <p className="mt-4 text-xs text-ink/55">
            Fiscal code {stay.invoice.fiscalCode}. Issued {stay.invoice.issuedAt}.
          </p>
        )}
      </div>
      <p className="mt-4 text-xs text-ink/55">
        Shown as at {TODAY}. If anything here is not as you expected, reply to the message and the hotel will look at it.
      </p>

      <GuestFeedbackForm stay={stay} />
    </Shell>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-semibold text-ink' : 'text-ink/65'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-bold text-ink' : 'text-ink/80'}`}>{value}</dd>
    </div>
  )
}

function Shell({ hotel, children }: { hotel: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-br from-brand to-brand-deep px-5 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Your bill</p>
        <h1 className="text-xl font-bold">{hotel}</h1>
      </header>
      <main className="mx-auto max-w-xl px-5 py-6">{children}</main>
    </div>
  )
}
