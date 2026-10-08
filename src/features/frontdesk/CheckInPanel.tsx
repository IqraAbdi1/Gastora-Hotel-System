import { useMemo, useState } from 'react'
import { useHotel } from '../../lib/hotelContext'
import { isRoomFree } from '../../lib/availability'
import type { IdType, Reservation } from '../../types'
import IdPhotoInput from '../../components/IdPhotoInput'
import SignaturePad from '../../components/SignaturePad'
import RoomPicker from './RoomPicker'

type Props = { reservation: Reservation; onClose: () => void }

const idTypes: IdType[] = ['NIN', 'Passport', 'Driving permit']
const purposes = ['Leisure', 'Business', 'Conference', 'Transit', 'Other']
const field = 'w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'
const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'

export default function CheckInPanel({ reservation: r, onClose }: Props) {
  const { rooms, reservations, checkIn } = useHotel()

  // Rooms she can use: right type, clean, and free for the whole stay (BR-FO-01, BR-FO-02)
  const readyRooms = useMemo(
    () =>
      rooms.filter(
        (x) =>
          x.type === r.roomType &&
          x.status === 'clean' &&
          isRoomFree(x, r.arrival, r.departure, reservations, r.id),
      ),
    [rooms, reservations, r],
  )
  const notReady = useMemo(
    () => rooms.filter((x) => x.type === r.roomType && x.status === 'dirty').length,
    [rooms, r.roomType],
  )

  const [step, setStep] = useState<1 | 2>(1)
  // Keep the room already assigned to the booking if it is ready, otherwise suggest the lowest number
  const [room, setRoom] = useState(() => {
    const assigned = readyRooms.find((x) => x.number === r.room)
    if (assigned) return assigned.number
    const sorted = [...readyRooms].sort((a, b) => Number(a.number) - Number(b.number))
    return sorted[0]?.number ?? ''
  })
  const [idType, setIdType] = useState<IdType>('NIN')
  const [idNumber, setIdNumber] = useState('')
  const [idExpiry, setIdExpiry] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [nationality, setNationality] = useState('Ugandan')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [purpose, setPurpose] = useState('Leisure')
  const [comingFrom, setComingFrom] = useState('')
  const [nextDestination, setNextDestination] = useState('')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [requests, setRequests] = useState('')
  const [idPhoto, setIdPhoto] = useState<string | undefined>()
  const [signature, setSignature] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [doneRoom, setDoneRoom] = useState<string | null>(null)

  const step1Valid = room !== '' && idNumber.trim() !== '' && phone.trim() !== ''
  const step2Valid = !!idPhoto && !!signature && termsAccepted

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
    })
    setDoneRoom(room)
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-ink/10 bg-surface shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">Check in {r.guest}</h2>
          <p className="text-sm text-ink/60">
            {r.id} · {r.roomType}
            {!doneRoom && ` · Step ${step} of 2`}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      {doneRoom ? (
        <div className="flex-1 space-y-4 p-4">
          <p className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
            {r.guest} is checked in to room {doneRoom}. The room is now occupied. Guest details, ID photo and signature are saved on the booking.
          </p>
          <button type="button" onClick={onClose} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {step === 1 && (
              <>
                <div>
                  <p className={`${heading} mb-1`}>Room</p>
                  <RoomPicker options={readyRooms} value={room} onChange={setRoom} notReady={notReady} type={r.roomType} />
                </div>

                <p className={heading}>Identity</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    ID type
                    <select value={idType} onChange={(e) => setIdType(e.target.value as IdType)} className={`${field} mt-1`}>
                      {idTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    ID number
                    <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    ID expiry
                    <input type="date" value={idExpiry} onChange={(e) => setIdExpiry(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Date of birth
                    <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Gender
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className={`${field} mt-1`}>
                      <option value="">Select</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Nationality
                    <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={`${field} mt-1`} />
                  </label>
                </div>

                <p className={heading}>Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Phone
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Email
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${field} mt-1`} />
                  </label>
                </div>
                <label className="block text-sm font-medium">
                  Home address and country
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className={`${field} mt-1`} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Emergency contact name
                    <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Emergency contact phone
                    <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={`${field} mt-1`} />
                  </label>
                </div>

                <p className={heading}>Stay</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium">
                    Purpose of visit
                    <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${field} mt-1`}>
                      {purposes.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium">
                    Vehicle plate
                    <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Coming from
                    <input value={comingFrom} onChange={(e) => setComingFrom(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Next destination
                    <input value={nextDestination} onChange={(e) => setNextDestination(e.target.value)} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Adults
                    <input type="number" min={1} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} className={`${field} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium">
                    Children
                    <input type="number" min={0} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} className={`${field} mt-1`} />
                  </label>
                </div>

                <label className="block text-sm font-medium">
                  Special requests
                  <textarea
                    value={requests}
                    onChange={(e) => setRequests(e.target.value)}
                    rows={3}
                    placeholder="For example: quiet room, late checkout, extra pillows"
                    className={`${field} mt-1`}
                  />
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <p className={heading}>ID photo</p>
                <IdPhotoInput value={idPhoto} onChange={setIdPhoto} />

                <p className={heading}>Guest signature</p>
                <SignaturePad onChange={setSignature} />

                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1" />
                  <span>The guest has read and accepted the hotel terms and conditions (required).</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1" />
                  <span>The guest agrees to receive offers and news from the hotel (optional).</span>
                </label>

                <p className="text-xs text-ink/60">
                  ID photo and signature are personal data. In this prototype they are kept in memory only and disappear on refresh. In the real system they are stored securely and shown only to authorised staff.
                </p>
              </>
            )}
          </div>

          <div className="border-t border-ink/10 p-4">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!step1Valid}
                  className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next: ID photo and signature
                </button>
                {!step1Valid && <p className="mt-2 text-xs text-ink/60">Choose a room and enter the ID number and phone to continue.</p>}
              </>
            ) : (
              <>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={!step2Valid}
                    className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Confirm check-in
                  </button>
                </div>
                {!step2Valid && <p className="mt-2 text-xs text-ink/60">Add the ID photo, the signature and accept the terms.</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}