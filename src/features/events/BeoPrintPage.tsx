import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { LoadingState } from '../../components/ui'
import { dayMonthYear, ugx } from '../../lib/format'
import { SETUP_LABEL, beoLineTotal } from '../../services/events/eventsRules'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { BEO_STATUS_LABEL, EVENT_STATUS_LABEL, EVENT_TYPE_LABEL, shortDate, stampText } from './eventsUi'
import { useEvents } from './useEvents'

// The BEO as the kitchen, banqueting and AV teams get it on paper. Outside the app shell so it prints clean.
export default function BeoPrintPage() {
  const { id } = useParams()
  const { user, canOpen } = useAuth()
  const { tenant } = useFeatures()
  const { data, loading } = useEvents()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />
  if (!canOpen('/events/bookings')) return <Navigate to="/" replace />
  const booking = data.bookings.find((b) => b.id === id)
  const beo = data.beos.find((b) => b.eventBookingId === id)
  if (!booking || !beo) return loading ? <LoadingState /> : <p className="p-8 text-sm">BEO not found.</p>

  const sessions = data.sessions.filter((s) => s.eventBookingId === booking.id).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
  const items = data.beoItems.filter((i) => i.beoId === beo.id).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
  const resources = data.resourceBookings.filter((r) => r.eventBookingId === booking.id).sort((a, b) => a.date.localeCompare(b.date))
  const space = (sid: string) => data.spaces.find((s) => s.id === sid)?.name ?? sid
  const equip = (eid: string) => data.equipment.find((e) => e.id === eid)
  const fb = items.reduce((s, i) => s + beoLineTotal(i), 0)
  const th = 'border-b border-black/30 py-1.5 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide'
  const td = 'border-b border-black/10 py-1.5 pr-3 align-top'

  return (
    <div className="min-h-screen bg-white text-black print:min-h-0">
      <div className="mx-auto max-w-[820px] px-4 py-6 text-[13px] sm:px-8">
        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
            Print
          </button>
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-black/20 px-4 py-2 text-sm font-semibold">
            Back
          </button>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-xs uppercase tracking-widest">{tenant.name}</p>
            <h1 className="text-2xl font-bold">Banquet event order</h1>
            <p className="mt-1 text-base font-semibold">{booking.name}</p>
          </div>
          <div className="text-right text-xs leading-5">
            <p>
              <span className="font-semibold">BEO</span> {beo.id} · v{beo.version}
            </p>
            <p>{BEO_STATUS_LABEL[beo.status]}</p>
            {beo.issuedAt && <p>Issued {stampText(beo.issuedAt)}</p>}
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          <Info label="Client" value={booking.clientName} />
          <Info label="Contact" value={`${booking.contactName} ${booking.contactPhone}`} />
          <Info label="Type" value={EVENT_TYPE_LABEL[booking.eventType]} />
          <Info label="Date" value={booking.startDate === booking.endDate ? dayMonthYear(booking.startDate) : `${dayMonthYear(booking.startDate)} to ${dayMonthYear(booking.endDate)}`} />
          <Info label="Guests" value={`${booking.guaranteedGuests ?? booking.expectedGuests}${booking.guaranteedGuests !== undefined ? ' guaranteed' : ' expected'}`} />
          <Info label="Status" value={EVENT_STATUS_LABEL[booking.status]} />
        </section>

        <h2 className="mt-6 text-sm font-bold uppercase">Function spaces</h2>
        <table className="mt-1 w-full">
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={th}>Session</th>
              <th className={th}>Space</th>
              <th className={th}>Setup</th>
              <th className={`${th} text-right`}>Pax</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className={td}>
                  {shortDate(s.date)} {s.startTime}-{s.endTime}
                </td>
                <td className={td}>{s.title}</td>
                <td className={td}>{space(s.spaceId)}</td>
                <td className={td}>{SETUP_LABEL[s.setup]}</td>
                <td className={`${td} text-right`}>{s.pax}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {beo.agenda.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-bold uppercase">Agenda</h2>
            <ul className="mt-1">
              {beo.agenda.map((a, i) => (
                <li key={i} className="flex gap-4 border-b border-black/10 py-1">
                  <span className="w-14 font-semibold">{a.time}</span>
                  <span>{a.item}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="mt-6 text-sm font-bold uppercase">Food and beverage</h2>
        <table className="mt-1 w-full">
          <thead>
            <tr>
              <th className={th}>Served</th>
              <th className={th}>Item</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className={td}>
                  {shortDate(i.date)} {i.time}
                </td>
                <td className={td}>
                  {i.description}
                  {i.packageId && (
                    <span className="block text-[11px] text-black/60">
                      {data.packageItems
                        .filter((p) => p.packageId === i.packageId)
                        .map((p) => p.description)
                        .join('; ')}
                    </span>
                  )}
                </td>
                <td className={`${td} text-right`}>{i.quantity}</td>
                <td className={`${td} whitespace-nowrap text-right`}>{ugx(beoLineTotal(i))}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="py-1.5 pr-3 text-right font-semibold">
                Food and beverage
              </td>
              <td className="whitespace-nowrap py-1.5 text-right font-semibold">{ugx(fb)}</td>
            </tr>
          </tbody>
        </table>

        {resources.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-bold uppercase">Equipment and staff</h2>
            <table className="mt-1 w-full">
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id}>
                    <td className={td}>{shortDate(r.date)}</td>
                    <td className={td}>{equip(r.equipmentId)?.name}</td>
                    <td className={`${td} text-right`}>× {r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {(beo.kitchenNotes || beo.setupNotes) && (
          <section className="mt-6 grid gap-4 sm:grid-cols-2">
            {beo.kitchenNotes && (
              <div>
                <h2 className="text-sm font-bold uppercase">Kitchen</h2>
                <p className="mt-1 whitespace-pre-line">{beo.kitchenNotes}</p>
              </div>
            )}
            {beo.setupNotes && (
              <div>
                <h2 className="text-sm font-bold uppercase">Room setup</h2>
                <p className="mt-1 whitespace-pre-line">{beo.setupNotes}</p>
              </div>
            )}
          </section>
        )}

        <section className="mt-10 grid grid-cols-2 gap-8 text-xs">
          <div className="border-t border-black pt-1">
            For the client{beo.signedBy ? `: ${beo.signedBy}` : ''}
          </div>
          <div className="border-t border-black pt-1">For {tenant.name}: {beo.issuedBy ?? booking.ownerName}</div>
        </section>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-[11px] uppercase tracking-wide text-black/60">{label}</span>
      <br />
      <span className="font-medium">{value}</span>
    </p>
  )
}
