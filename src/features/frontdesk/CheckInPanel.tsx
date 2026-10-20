import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import IdScanSheet from '../../components/IdScanSheet'
import type { ScanSource } from '../../components/IdScanSheet'
import SignaturePad from '../../components/SignaturePad'
import { Badge, Button, Card, Field, Input, Select, Stepper, Textarea } from '../../components/ui'
import type { Step } from '../../components/ui'
import { guarantees, ratePlans } from '../../data/rates'
import { isRoomFree } from '../../lib/availability'
import { checkInBlock } from '../../lib/corporate'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { folioOf, paymentMethods } from '../../lib/folio'
import { suggestedDeposit } from '../../lib/booking'
import { useHotel } from '../../lib/hotelContext'
import { expressCheck } from '../../lib/expressCheckout'
import { earlyArrivalFee, nowTime } from '../../lib/stayTimes'
import { idTypeFor } from '../../lib/mrz'
import type { MrzRead } from '../../lib/mrz'
import { stayTaxes } from '../../lib/tax'
import type { IdType, Reservation } from '../../types'
import { useAuth } from '../auth/authContext'
import { useCorporate } from '../corporate/corporateContext'
import { useFeatures } from '../platform/featuresContext'
import { isSensitiveTag } from '../../lib/loyalty'
import { stamp } from '../../lib/folio'
import GuestRecognition from '../guests/GuestRecognition'
import PreferenceChips from '../guests/PreferenceChips'
import { proposeRoom } from '../../lib/roomAssign'
import { TODAY } from '../../data/sample'
import CheckInRoomStep from './CheckInRoomStep'
import CompanyCheckIn from './CompanyCheckIn'

type Props = { reservation: Reservation; room?: string; onClose: () => void }

const idTypes: IdType[] = ['NIN', 'Passport', 'Driving permit']
const purposes = ['Leisure', 'Business', 'Conference', 'Transit', 'Other']
const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0

const sourceLabel: Record<ScanSource, string> = {
  camera: 'Read from the card by camera',
  photo: 'Read from the photograph of the ID',
  typed: 'Typed from the strip on the card',
}

/** The same person, written in a different order. A booking says Amina Nakato; an ID says NAKATO AMINA. */
const sameName = (a: string, b: string) => {
  const parts = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ')
  return parts(a) === parts(b)
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

function Row({ label, value, strong, tone }: { label: string; value: ReactNode; strong?: boolean; tone?: 'bad' | 'good' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-ink/60">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'font-bold' : 'font-medium'} ${tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : 'text-ink'}`}>
        {value}
      </dd>
    </div>
  )
}

// Check-in as a short wizard on its own page: guest, ID, room, payment, signature.
// A stay billed to a company starts with the company check, because nothing else matters until it clears.
export default function CheckInPanel({ reservation: initial, room: preferred, onClose }: Props) {
  const { rooms, reservations, guests, checkIn, addPayment, addCharge, updateGuest, acceptPreReg, agreeExpress } = useHotel()
  const { tax, features, options, stayTimes } = useFeatures()
  // Always read the latest booking, so the company checks show what was just confirmed.
  const r = reservations.find((x) => x.id === initial.id) ?? initial
  const { byId } = useCorporate()
  const { user } = useAuth()
  const known = guests.find((g) => g.id === r.guestId)
  // What the guest filled in from their own phone before arriving. It fills the form; it is not believed
  // until the receptionist has seen it against the ID in their hand.
  const pre = r.preReg?.submittedAt ? r.preReg.details : undefined

  // A company-billed stay cannot be checked in until the company side is cleared.
  const blocked = r.corporate ? checkInBlock(r, byId(r.corporate.accountId)) : null
  const companyPending =
    !!r.corporate && r.corporate.billTo !== 'guest' && (r.corporate.booker.status !== 'verified' || r.corporate.billing.status !== 'approved')

  // Rooms she can use: right type, clean, and free for the whole stay (BR-FO-01, BR-FO-02)
  const readyRooms = useMemo(
    () => rooms.filter((x) => x.type === r.roomType && x.status === 'clean' && isRoomFree(x, r.arrival, r.departure, reservations, r.id)),
    [rooms, reservations, r],
  )
  const dirtyRooms = useMemo(() => rooms.filter((x) => x.type === r.roomType && x.status === 'dirty'), [rooms, r.roomType])

  const steps: Step[] = [
    ...(companyPending ? [{ key: 'company', label: 'Company' }] : []),
    { key: 'details', label: 'Guest details' },
    { key: 'id', label: 'ID verification' },
    { key: 'room', label: 'Room' },
    { key: 'payment', label: 'Payment' },
    { key: 'confirm', label: 'Sign and confirm' },
  ]
  const [stepKey, setStepKey] = useState(() => (companyPending ? 'company' : 'details'))
  // If the company step disappears (it was cleared), fall back to the first step.
  const index = Math.max(0, steps.findIndex((s) => s.key === stepKey))
  const current = steps[index].key

  // The assignment rules' proposal, for a stay nobody has given a room yet. A room the desk chose stays chosen.
  const [suggestion] = useState(() =>
    features.roomAutoAssign && !r.room ? proposeRoom(r, { reservations, rooms, guests, today: TODAY }) : undefined,
  )
  const [room, setRoom] = useState(() => {
    const assigned = readyRooms.find((x) => x.number === (preferred ?? r.room))
    if (assigned) return assigned.number
    if (suggestion?.room && readyRooms.some((x) => x.number === suggestion.room)) return suggestion.room
    const sorted = [...readyRooms].sort((a, b) => Number(a.number) - Number(b.number))
    return sorted[0]?.number ?? ''
  })
  const [idType, setIdType] = useState<IdType>(pre?.idType ?? 'NIN')
  const [idNumber, setIdNumber] = useState(pre?.idNumber ?? '')
  const [idExpiry, setIdExpiry] = useState(pre?.idExpiry ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(pre?.dateOfBirth ?? '')
  const [gender, setGender] = useState(pre?.gender ?? '')
  const [nationality, setNationality] = useState(pre?.nationality ?? known?.nationality ?? 'Ugandan')
  const [address, setAddress] = useState(pre?.address ?? '')
  const [phone, setPhone] = useState(pre?.phone ?? known?.phone ?? '')
  const [email, setEmail] = useState(pre?.email ?? known?.email ?? '')
  const [purpose, setPurpose] = useState(pre?.purpose ?? 'Leisure')
  const [comingFrom, setComingFrom] = useState(pre?.comingFrom ?? '')
  const [nextDestination, setNextDestination] = useState(pre?.nextDestination ?? '')
  const [adults, setAdults] = useState(r.adults ?? 1)
  const [children, setChildren] = useState(r.children ?? 0)
  const [vehiclePlate, setVehiclePlate] = useState(pre?.vehiclePlate ?? '')
  const [emergencyName, setEmergencyName] = useState(pre?.emergencyName ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(pre?.emergencyPhone ?? '')
  const [requests, setRequests] = useState(pre?.specialRequests ?? '')
  // Preferences are saved on the guest, so the next stay starts with them already known.
  const [prefTags, setPrefTags] = useState<string[]>([])
  const [prefNote, setPrefNote] = useState('')
  const [idPhoto, setIdPhoto] = useState<string | undefined>()
  // Reading the ID instead of typing it. What was read is kept, because it says how the details got here.
  const [scanOpen, setScanOpen] = useState(false)
  const [scanned, setScanned] = useState<{ source: ScanSource; lines: string; idName: string } | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(pre?.marketingConsent ?? false)
  // Remembering a guest between stays is a programme they join, not something done to them quietly.
  const [loyaltyConsent, setLoyaltyConsent] = useState(pre?.loyaltyConsent ?? known?.loyaltyConsent ?? false)
  // Offered only when there is something the hotel could actually charge on the morning.
  const [wantsExpress, setWantsExpress] = useState(false)
  const [sensitiveConsent, setSensitiveConsent] = useState(known?.sensitiveConsent ?? false)
  const [method, setMethod] = useState(paymentMethods[0])
  const [payText, setPayText] = useState('')
  const [reference, setReference] = useState('')
  const [doneRoom, setDoneRoom] = useState<string | null>(null)

  const f = folioOf(r)
  const nights = nightsBetween(r.arrival, r.departure)
  // Taxes on top of the room charge (Local Hotel Tax, service charge, VAT when added). Empty when the Tax lines feature is off.
  const taxes = stayTaxes(tax, f.roomCharge, nights)
  const total = f.total + taxes.onTopTotal
  const balance = total - f.paid
  const planName = ratePlans.find((p) => p.id === r.plan)?.name
  const guaranteeLabel = guarantees.find((g) => g.key === r.guarantee)?.label
  // A deposit is suggested only when nothing is paid and no card or company guarantee covers the stay.
  const suggested = r.paid === 0 && r.guarantee !== 'card' && r.guarantee !== 'company' ? suggestedDeposit(total) : 0
  const payAmount = payText === '' ? 0 : digits(payText)
  const payOk = payAmount <= balance
  const afterBalance = balance - (payOk ? payAmount : 0)

  const valid: Record<string, boolean> = {
    company: true,
    details: phone.trim() !== '' && adults >= 1,
    id: idNumber.trim() !== '',
    room: room !== '',
    payment: payOk,
    confirm: !!signature && termsAccepted,
  }
  const hint: Record<string, string> = {
    details: 'Enter the guest phone number to continue.',
    id: 'Enter the ID number to continue.',
    room: 'Choose a room to continue.',
    payment: 'The payment cannot be more than the balance.',
    confirm: 'Add the signature and accept the terms.',
  }

  // The strip fills the form; it does not save anything. Every field stays editable and the receptionist
  // is the one who decides the details are right.
  function applyScan(read: MrzRead, source: ScanSource, photo?: string) {
    setIdType(idTypeFor(read))
    if (read.documentNumber.value) setIdNumber(read.documentNumber.value)
    if (read.dateOfBirth.value) setDateOfBirth(read.dateOfBirth.value)
    if (read.expiry.value) setIdExpiry(read.expiry.value)
    if (read.sex) setGender(read.sex)
    if (read.nationalityLabel) setNationality(read.nationalityLabel)
    if (!idPhoto && photo) setIdPhoto(photo)
    setScanned({ source, lines: read.lines.join('\n'), idName: read.fullName })
    setScanOpen(false)
  }

  const expressOk = expressCheck(r, r.corporate ? byId(r.corporate.accountId)?.name : undefined, options.expressMax)

  // Arriving before the room was promised. Free when a room is clean and the hour is reasonable;
  // charged when the guest has in effect slept a night the hotel could have sold.
  const early = earlyArrivalFee(stayTimes, nowTime(), f.roomCharge / Math.max(1, nights))

  function confirm() {
    checkIn(r.id, room, {
      idType,
      idNumber: idNumber.trim(),
      idExpiry,
      idPhoto,
      dateOfBirth,
      gender,
      nationality: nationality.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      purpose,
      comingFrom: comingFrom.trim(),
      nextDestination: nextDestination.trim(),
      adults,
      children,
      vehiclePlate: vehiclePlate.trim(),
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.trim(),
      specialRequests: requests.trim(),
      marketingConsent,
      termsAccepted,
      signature: signature ?? undefined,
      idReadFrom: scanned?.source,
      idMrz: scanned?.lines,
      idName: scanned && !sameName(scanned.idName, r.guest) ? scanned.idName : undefined,
    })
    // What the guest agreed to is recorded with the answer, so the hotel can show what was asked and when.
    if (known) {
      // Dietary and access needs are only kept while the guest allows it.
      const keptTags = sensitiveConsent ? prefTags : prefTags.filter((t) => !isSensitiveTag(t))
      const previous = (known.preferences?.tags ?? []).filter((t) => sensitiveConsent || !isSensitiveTag(t))
      updateGuest(known.id, {
        loyaltyConsent,
        sensitiveConsent,
        marketingConsent,
        consentAt: stamp(),
        // Nothing is carried between stays unless the guest joined the programme.
        preferences: loyaltyConsent
          ? {
              ...known.preferences,
              tags: [...new Set([...previous, ...keptTags])],
              other: prefNote.trim() || known.preferences?.other,
            }
          : undefined,
      })
    }
    // What the guest sent before arriving has now been seen against their ID by a person.
    if (r.preReg?.submittedAt && !r.preReg.acceptedAt) acceptPreReg(r.id, user?.name ?? 'Front desk')
    if (wantsExpress && expressOk.ok) agreeExpress(r.id, user?.name ?? 'Front desk', 'desk')
    if (early.amount > 0) addCharge(r.id, { category: 'Other', description: `Early arrival · ${early.label}`, amount: early.amount })
    // Taxes are posted first, so the balance the payment is taken against is the full one.
    for (const l of taxes.onTop) addCharge(r.id, { category: l.category, description: l.label, amount: l.amount })
    // The payment goes on the folio straight after check-in, so the balance everywhere is right.
    if (payAmount > 0) addPayment(r.id, { method, amount: payAmount, reference: reference.trim() || undefined })
    setDoneRoom(room)
  }

  const next = () => setStepKey(steps[Math.min(steps.length - 1, index + 1)].key)
  const back = () => setStepKey(steps[Math.max(0, index - 1)].key)
  const last = index === steps.length - 1
  const showNav = !doneRoom && !blocked && current !== 'company'

  const detailsCard = (
    <Card title={r.guest} description={`${r.id} · ${r.roomType}`} padded>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand to-brand-deep text-base font-bold text-white">
          {initials(r.guest)}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {r.corporate && <Badge tone="info">{r.corporate.accountName}</Badge>}
          {r.source && <Badge><span className="capitalize">{r.source}</span></Badge>}
          {guaranteeLabel && <Badge tone={r.guarantee === 'none' ? 'warn' : 'good'}>{guaranteeLabel}</Badge>}
        </div>
      </div>
      <dl className="mt-4 space-y-2.5 border-t border-ink/10 pt-4">
        <Row label="Arrival" value={dayMonth(r.arrival)} />
        <Row label="Departure" value={dayMonth(r.departure)} />
        <Row label="Nights" value={nights} />
        <Row label="Guests" value={`${adults} adult${adults === 1 ? '' : 's'}${children ? `, ${children} child${children === 1 ? '' : 'ren'}` : ''}`} />
        {planName && <Row label="Rate plan" value={planName} />}
        {r.upgrade && <Row label="Upgrade" value={`Free, from ${r.upgrade.from}`} />}
        {room && <Row label="Room" value={`Room ${room}`} />}
        {known?.phone && <Row label="Phone on file" value={known.phone} />}
      </dl>
      <div className="mt-3">
        <GuestRecognition guest={known} reservation={r} />
      </div>
    </Card>
  )

  const summaryCard = (
    <Card title="Stay summary" icon="money" padded>
      <dl className="space-y-2.5">
        <Row label={`Room${planName ? ` and ${planName.toLowerCase()}` : ''} (${nights} night${nights === 1 ? '' : 's'})`} value={ugx(f.roomCharge)} />
        {f.extras > 0 && <Row label="Extras" value={ugx(f.extras)} />}
        {taxes.onTop.map((l) => (
          <Row key={l.key} label={l.label} value={ugx(l.amount)} />
        ))}
        <div className="border-t border-ink/10 pt-2.5">
          <Row label="Total" value={ugx(total)} strong />
          {taxes.vatInside > 0 && tax && (
            <p className="mt-1 text-xs text-ink/55">
              Includes VAT {Math.round(tax.vatRate * 100)}%: {ugx(taxes.vatInside)} on the room charge
            </p>
          )}
        </div>
        <Row label="Paid so far" value={f.paid > 0 ? `− ${ugx(f.paid)}` : ugx(0)} tone={f.paid > 0 ? 'good' : undefined} />
        {payAmount > 0 && payOk && <Row label="Taking now" value={`− ${ugx(payAmount)}`} tone="good" />}
        <div className="border-t border-ink/10 pt-2.5">
          <Row label="Balance due" value={ugx(afterBalance)} strong tone={afterBalance > 0 ? 'bad' : 'good'} />
        </div>
      </dl>
      <p className="mt-3 text-xs text-ink/55">
        {tax
          ? 'Taxes are worked out from the hotel rules and posted to the folio when the guest checks in.'
          : 'Taxes are part of the total. This hotel does not itemise them.'}
      </p>
    </Card>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Check in ${r.guest}`}>
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-canvas shadow-2xl">
      <header className="bg-linear-to-r from-brand-deep to-brand text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/70">Front desk · Check-in</p>
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Check in {r.guest}</h1>
            <p className="text-sm text-white/80">
              {r.id} · {dayMonth(r.arrival)} to {dayMonth(r.departure)} · {nights} night{nights === 1 ? '' : 's'} · {r.roomType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {doneRoom ? 'Close' : 'Cancel'}
          </button>
        </div>
      </header>

      <div className="space-y-4 px-4 py-5 sm:px-6">
        {doneRoom ? (
          <Card padded>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-good/15 text-good">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-7 w-7" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              <h2 className="text-xl font-bold text-ink">{r.guest} is checked in to room {doneRoom}</h2>
              <p className="max-w-md text-sm text-ink/65">
                The room is now occupied. The guest's details, their ID number and their signature are saved on the booking
                {payAmount > 0 ? `, and ${ugx(payAmount)} is on the folio.` : '.'}
              </p>
              <Button onClick={onClose}>Done</Button>
            </div>
          </Card>
        ) : blocked ? (
          <Card padded>
            <div className="space-y-4">
              <div className="rounded-lg border border-bad/30 bg-bad/10 p-4 text-sm">
                <p className="font-semibold text-bad">Cannot check in on the company's account yet</p>
                <p className="mt-1 text-ink/80">{blocked}</p>
              </div>
              <p className="text-sm text-ink/60">Open the reservation and complete the company checks, then check in.</p>
              <Button variant="ghost" onClick={onClose}>
                Back
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="rounded-xl border border-ink/10 bg-surface px-4 py-3 shadow-sm">
              <Stepper
                steps={steps}
                current={index}
                onGo={(i) => setStepKey(steps[i].key)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_18rem]">
              <div className="order-2 lg:order-1">{detailsCard}</div>

              <div className="order-1 min-w-0 space-y-4 lg:order-2">
                {current === 'company' && (
                  <Card title="Company check" description="Confirm the company side before the guest's own details." padded={false}>
                    <CompanyCheckIn reservation={r} />
                  </Card>
                )}

                {current === 'details' && (
                  <Card title="Guest details" description="Contact and stay information." padded>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Phone" required>{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
                      <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
                      <div className="sm:col-span-2">
                        <Field label="Home address and country">{(id) => <Input id={id} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
                      </div>
                      <Field label="Emergency contact name">{(id) => <Input id={id} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />}</Field>
                      <Field label="Emergency contact phone">{(id) => <Input id={id} value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />}</Field>
                      <Field label="Purpose of visit">
                        {(id) => (
                          <Select id={id} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                            {purposes.map((p) => (
                              <option key={p}>{p}</option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Field label="Vehicle plate">{(id) => <Input id={id} value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />}</Field>
                      <Field label="Coming from">{(id) => <Input id={id} value={comingFrom} onChange={(e) => setComingFrom(e.target.value)} />}</Field>
                      <Field label="Next destination">{(id) => <Input id={id} value={nextDestination} onChange={(e) => setNextDestination(e.target.value)} />}</Field>
                      <Field label="Adults">
                        {(id) => <Input id={id} type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />}
                      </Field>
                      <Field label="Children">
                        {(id) => <Input id={id} type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />}
                      </Field>
                      <div className="sm:col-span-2">
                        <div className="sm:col-span-2">
                          <p className="mb-1.5 text-sm font-medium text-ink/80">What this guest likes</p>
                          <PreferenceChips
                            tags={prefTags}
                            onTags={setPrefTags}
                            note={prefNote}
                            onNote={setPrefNote}
                            sensitiveOk={sensitiveConsent}
                            onSensitiveOk={setSensitiveConsent}
                          />
                        </div>
                        <Field label="Special requests for this stay">
                          {(id) => (
                            <Textarea id={id} rows={3} value={requests} onChange={(e) => setRequests(e.target.value)} placeholder="For example: quiet room, late checkout, extra pillows" />
                          )}
                        </Field>
                      </div>
                    </div>
                  </Card>
                )}

                {early.amount > 0 && (
                  <div className="mb-4 rounded-xl bg-warn/[0.08] p-3">
                    <p className="text-sm font-semibold text-ink">Arriving early: {ugx(early.amount)}</p>
                    <p className="mt-0.5 text-xs text-ink/70">
                      {early.label}. It is posted to the folio when the check-in is confirmed. The hotel sets the hours in Hotel settings.
                    </p>
                  </div>
                )}

                {pre && (
                  <div className="mb-4 rounded-xl bg-good/[0.08] p-3">
                    <p className="text-sm font-semibold text-ink">Filled in by the guest before arriving</p>
                    <p className="mt-0.5 text-xs text-ink/70">
                      Sent {r.preReg?.submittedAt}. These are the guest's own answers and the form below starts from them. Check them against the ID
                      and correct anything wrong — nothing is recorded until you confirm the check-in.
                    </p>
                  </div>
                )}

                {current === 'id' && (
                  <Card title="ID verification" description="Check the ID against the guest, then record it." padded>
                    {features.idScan && (
                      <div className="mb-4 rounded-xl bg-brand/[0.06] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">Show the ID to the camera</p>
                            <p className="text-xs text-ink/60">
                              A national ID or passport fills these fields by itself. A driving permit is typed.
                            </p>
                          </div>
                          <Button variant={scanned ? 'ghost' : 'primary'} onClick={() => setScanOpen(true)}>
                            {scanned ? 'Read it again' : 'Read the ID'}
                          </Button>
                        </div>
                        {scanned && (
                          <div className="mt-3 space-y-2 border-t border-brand/15 pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="good" dot>
                                Filled from the ID
                              </Badge>
                              <span className="text-xs text-ink/60">{sourceLabel[scanned.source]}. Check it against the card and correct anything wrong.</span>
                            </div>
                            {!sameName(scanned.idName, r.guest) && (
                              <p className="rounded-lg bg-warn/[0.1] p-2.5 text-sm text-ink/80">
                                The ID is in the name <strong>{scanned.idName}</strong> and the booking is in the name <strong>{r.guest}</strong>. That is
                                normal when somebody else booked the room, but the person in front of you is the one whose ID this is.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="ID type">
                        {(id) => (
                          <Select id={id} value={idType} onChange={(e) => setIdType(e.target.value as IdType)}>
                            {idTypes.map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Field label="ID number" required>{(id) => <Input id={id} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />}</Field>
                      <Field label="ID expiry">{(id) => <Input id={id} type="date" value={idExpiry} onChange={(e) => setIdExpiry(e.target.value)} />}</Field>
                      <Field label="Date of birth">{(id) => <Input id={id} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />}</Field>
                      <Field label="Gender">
                        {(id) => (
                          <Select id={id} value={gender} onChange={(e) => setGender(e.target.value)}>
                            <option value="">Select</option>
                            <option>Female</option>
                            <option>Male</option>
                            <option>Other</option>
                          </Select>
                        )}
                      </Field>
                      <Field label="Nationality">{(id) => <Input id={id} value={nationality} onChange={(e) => setNationality(e.target.value)} />}</Field>
                    </div>
                    <p className="mt-4 text-xs text-ink/55">
                      The ID is checked against the guest in front of you. What the card reader captures is kept with the stay; the hotel does not
                      keep a separate photograph.
                    </p>
                    {scanOpen && <IdScanSheet photo={idPhoto} onUse={applyScan} onClose={() => setScanOpen(false)} />}
                  </Card>
                )}

                {current === 'room' && (
                  <Card title="Assign a room" description={`${r.roomType} · ${dayMonth(r.arrival)} to ${dayMonth(r.departure)}`} padded>
                    <CheckInRoomStep
                      type={r.roomType}
                      ready={readyRooms}
                      dirty={dirtyRooms}
                      booked={r.room}
                      reservation={r}
                      value={room}
                      onChange={setRoom}
                      suggestion={suggestion}
                    />
                  </Card>
                )}

                {current === 'payment' && (
                  <Card title="Payment and deposit" description="Optional. Anything taken now goes on the folio." padded>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Method">
                        {(id) => (
                          <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
                            {paymentMethods.map((m) => (
                              <option key={m}>{m}</option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Field label="Amount to take now (UGX)" error={!payOk ? `More than the balance of ${ugx(balance)}` : undefined}>
                        {(id) => <Input id={id} inputMode="numeric" value={payText} onChange={(e) => setPayText(e.target.value)} placeholder="0" />}
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Reference" hint="Mobile money transaction ID or card slip number, if any.">
                          {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} />}
                        </Field>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggested > 0 && (
                        <Button variant="secondary" size="sm" onClick={() => setPayText(String(Math.min(suggested, balance)))}>
                          Suggested deposit {ugx(Math.min(suggested, balance))}
                        </Button>
                      )}
                      {balance > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setPayText(String(balance))}>
                          Full balance {ugx(balance)}
                        </Button>
                      )}
                      {payText !== '' && (
                        <Button variant="ghost" size="sm" onClick={() => setPayText('')}>
                          Take nothing now
                        </Button>
                      )}
                    </div>
                  </Card>
                )}

                {current === 'confirm' && (
                  <Card title="Sign and confirm" description="The guest signs, then the room is handed over." padded>
                    <p className="mb-1.5 text-sm font-medium text-ink/80">
                      Guest signature <span className="text-bad">*</span>
                    </p>
                    <SignaturePad onChange={setSignature} />
                    <label className="mt-4 flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1" />
                      <span>The guest has read and accepted the hotel terms and conditions (required).</span>
                    </label>
                    <label className="mt-2 flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={loyaltyConsent}
                        onChange={(e) => setLoyaltyConsent(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium">Remember me for next time.</span> The guest joins the hotel's
                        returning-guest programme: their stays are counted, their preferences kept, and any reward
                        offered on the next visit (optional).
                      </span>
                    </label>
                    <label className="mt-2 flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1" />
                      <span>The guest agrees to receive offers and news from the hotel (optional).</span>
                    </label>
                    {features.expressCheckout && expressOk.ok && (
                      <label className="mt-2 flex items-start gap-2 text-sm">
                        <input type="checkbox" checked={wantsExpress} onChange={(e) => setWantsExpress(e.target.checked)} className="mt-1" />
                        <span>
                          <span className="font-medium">Leave without stopping at the desk.</span> On the morning they leave, the bill is charged
                          to {expressOk.chargeTo} and sent to them, so they can simply go (optional).
                        </span>
                      </label>
                    )}

                    <div className="mt-3 rounded-lg border border-ink/10 bg-canvas/60 p-2.5 text-xs text-ink/70">
                      <p className="font-semibold text-ink">What the hotel keeps, and why</p>
                      <p className="mt-0.5">
                        The booking, the ID shown at check-in and the bill are kept because the law and this stay
                        require them, whatever the guest answers above. The two optional ticks are the only parts the
                        guest chooses, and either can be withdrawn later.
                      </p>
                    </div>

                    <p className="mt-3 text-xs text-ink/55">
                      The signature is personal data. In this prototype it is kept in memory only. In the real system it is stored securely and shown only to authorised staff.
                    </p>
                  </Card>
                )}

                {showNav && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button variant="ghost" onClick={back} disabled={index === 0}>
                      Back
                    </Button>
                    <div className="flex items-center gap-3">
                      {!valid[current] && <span className="text-xs text-ink/60">{hint[current]}</span>}
                      {last ? (
                        <Button onClick={confirm} disabled={!valid[current]}>
                          Confirm check-in
                        </Button>
                      ) : (
                        <Button onClick={next} disabled={!valid[current]}>
                          Next: {steps[index + 1].label}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="order-3">{summaryCard}</div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
