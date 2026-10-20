import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Field, Input, Select, Textarea } from '../../components/ui'
import { dayMonth, nightsBetween } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { preRegComplete, tokenFor } from '../../lib/preRegistration'
import type { PreRegDetails } from '../../lib/preRegistration'
import { useFeatures } from '../platform/featuresContext'
import type { IdType } from '../../types'

const idTypes: IdType[] = ['NIN', 'Passport', 'Driving permit']
const purposes = ['Leisure', 'Business', 'Conference', 'Transit', 'Other']

// The page the guest opens on their own phone, from the link the hotel sent. Nobody signs in here, so it
// shows only what the person holding the link already knows: their own name, their own dates, the hotel.
// No other guest, no room number, no money.
export default function ArrivePage() {
  const { token = '' } = useParams()
  const { reservations, openPreReg, submitPreReg } = useHotel()
  const { tenant, stayTimes } = useFeatures()

  const stay = useMemo(() => reservations.find((r) => tokenFor(r.id, r.arrival) === token), [reservations, token])

  useEffect(() => {
    if (stay) openPreReg(token)
    // Marked once, when the link is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stay?.id])

  const [d, setD] = useState<PreRegDetails>({ idType: 'NIN', nationality: 'Ugandan' })
  const [sent, setSent] = useState(false)
  const set = (patch: Partial<PreRegDetails>) => setD((cur) => ({ ...cur, ...patch }))

  if (!stay || stay.status !== 'booked') {
    return (
      <Shell hotel={tenant.name}>
        <p className="text-sm text-ink/70">
          This link is closed. The front desk will take your details.
        </p>
      </Shell>
    )
  }

  if (sent || stay.preReg?.submittedAt) {
    return (
      <Shell hotel={tenant.name}>
        <div className="rounded-xl bg-good/[0.08] p-4">
          <p className="text-base font-semibold text-ink">Thank you, {stay.guest.split(' ')[0]}.</p>
          <p className="mt-1 text-sm text-ink/75">
            We have your details. Please bring the ID itself so we can check it when you arrive. Check-in is from {stayTimes.checkInTime} on{' '}
            {dayMonth(stay.arrival)}.
          </p>
        </div>
      </Shell>
    )
  }

  const ready = preRegComplete(d)

  return (
    <Shell hotel={tenant.name}>
      <div className="rounded-xl bg-brand/[0.06] p-4">
        <p className="text-sm font-semibold text-ink">
          {stay.guest}, we are expecting you on {dayMonth(stay.arrival)}.
        </p>
        <p className="mt-0.5 text-sm text-ink/70">
          {nightsBetween(stay.arrival, stay.departure)} night(s), leaving {dayMonth(stay.departure)}. Filling this in now means you will not have to
          at the desk.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="ID type" required>
          {(id) => (
            <Select id={id} value={d.idType ?? 'NIN'} onChange={(e) => set({ idType: e.target.value as IdType })}>
              {idTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="ID number" required>{(id) => <Input id={id} value={d.idNumber ?? ''} onChange={(e) => set({ idNumber: e.target.value })} />}</Field>
        <Field label="ID expiry">{(id) => <Input id={id} type="date" value={d.idExpiry ?? ''} onChange={(e) => set({ idExpiry: e.target.value })} />}</Field>
        <Field label="Date of birth">
          {(id) => <Input id={id} type="date" value={d.dateOfBirth ?? ''} onChange={(e) => set({ dateOfBirth: e.target.value })} />}
        </Field>
        <Field label="Nationality" required>
          {(id) => <Input id={id} value={d.nationality ?? ''} onChange={(e) => set({ nationality: e.target.value })} />}
        </Field>
        <Field label="Phone" required>{(id) => <Input id={id} value={d.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={d.email ?? ''} onChange={(e) => set({ email: e.target.value })} />}</Field>
        <Field label="Home address">{(id) => <Input id={id} value={d.address ?? ''} onChange={(e) => set({ address: e.target.value })} />}</Field>
        <Field label="Purpose of visit">
          {(id) => (
            <Select id={id} value={d.purpose ?? 'Leisure'} onChange={(e) => set({ purpose: e.target.value })}>
              {purposes.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Vehicle plate">{(id) => <Input id={id} value={d.vehiclePlate ?? ''} onChange={(e) => set({ vehiclePlate: e.target.value })} />}</Field>
        <Field label="Emergency contact">
          {(id) => <Input id={id} value={d.emergencyName ?? ''} onChange={(e) => set({ emergencyName: e.target.value })} />}
        </Field>
        <Field label="Emergency phone">
          {(id) => <Input id={id} value={d.emergencyPhone ?? ''} onChange={(e) => set({ emergencyPhone: e.target.value })} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Anything we should know for this stay">
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={d.specialRequests ?? ''}
                onChange={(e) => set({ specialRequests: e.target.value })}
                placeholder="For example: arriving late, quiet room, extra pillows"
              />
            )}
          </Field>
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-xl bg-ink/[0.03] p-4">
        <label className="flex items-start gap-2 text-sm text-ink/80">
          <input type="checkbox" className="mt-1" checked={d.termsAccepted ?? false} onChange={(e) => set({ termsAccepted: e.target.checked })} />
          <span>
            I accept the house rules of {tenant.name}. <span className="text-bad">*</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink/80">
          <input type="checkbox" className="mt-1" checked={d.loyaltyConsent ?? false} onChange={(e) => set({ loyaltyConsent: e.target.checked })} />
          <span>Remember me for next time, so I do not fill this in again.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink/80">
          <input type="checkbox" className="mt-1" checked={d.marketingConsent ?? false} onChange={(e) => set({ marketingConsent: e.target.checked })} />
          <span>I would like to hear from the hotel about offers.</span>
        </label>
        <p className="pt-1 text-xs text-ink/60">
          Your booking, ID and bill are kept by law. The last two ticks are optional.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          disabled={!ready}
          onClick={() => {
            submitPreReg(token, d)
            setSent(true)
          }}
        >
          Send to the hotel
        </Button>
        {!ready && <span className="text-xs text-ink/60">ID type, ID number, nationality, phone and the house rules are needed.</span>}
      </div>
      <p className="mt-3 text-xs text-ink/55">
        Please bring your ID. The desk still needs to see it.
      </p>
    </Shell>
  )
}

function Shell({ hotel, children }: { hotel: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-linear-to-br from-brand to-brand-deep px-5 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Before you arrive</p>
        <h1 className="text-xl font-bold">{hotel}</h1>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>
    </div>
  )
}
