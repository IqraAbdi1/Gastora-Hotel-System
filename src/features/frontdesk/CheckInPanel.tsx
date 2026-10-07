import { useState } from 'react'
import { useHotel } from '../../lib/hotelContext'
import type { IdType, Reservation } from '../../types'

type Props = { reservation: Reservation; onClose: () => void }

const idTypes: IdType[] = ['NIN', 'Passport', 'Driving permit']
const field = 'w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'

export default function CheckInPanel({ reservation: r, onClose }: Props) {
  const { rooms, checkIn } = useHotel()
  const readyRooms = rooms.filter((x) => x.type === r.roomType && x.status === 'clean')

  const [room, setRoom] = useState(readyRooms[0]?.number ?? '')
  const [idType, setIdType] = useState<IdType>('NIN')
  const [idNumber, setIdNumber] = useState('')
  const [nationality, setNationality] = useState('Ugandan')
  const [phone, setPhone] = useState('')
  const [requests, setRequests] = useState('')
  const [doneRoom, setDoneRoom] = useState<string | null>(null)

  const valid = room !== '' && idNumber.trim() !== '' && phone.trim() !== ''

  function confirm() {
    checkIn(r.id, room, {
      idType,
      idNumber: idNumber.trim(),
      nationality: nationality.trim(),
      phone: phone.trim(),
      specialRequests: requests.trim(),
    })
    setDoneRoom(room)
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">Check in {r.guest}</h2>
          <p className="text-sm text-ink/60">
            {r.id} · {r.roomType}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      {doneRoom ? (
        <div className="flex-1 space-y-4 p-4">
          <p className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
            {r.guest} is checked in to room {doneRoom}. The room is now occupied and the guest details are saved on the booking.
          </p>
          <button type="button" onClick={onClose} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <label className="block text-sm font-medium">
              Room
              {readyRooms.length > 0 ? (
                <select value={room} onChange={(e) => setRoom(e.target.value)} className={`${field} mt-1`}>
                  {readyRooms.map((x) => (
                    <option key={x.number} value={x.number}>
                      {x.number} ({x.type}, clean)
                    </option>
                  ))}
                </select>
              ) : (
                <span className="mt-1 block rounded-lg bg-warn/10 p-3 text-sm text-warn">
                  No clean {r.roomType} room is ready. Ask housekeeping to clean one first.
                </span>
              )}
            </label>

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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Nationality
                <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={`${field} mt-1`} />
              </label>
              <label className="block text-sm font-medium">
                Phone
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${field} mt-1`} />
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

            <p className="text-xs text-ink/60">
              ID details are personal data. In the real system they are stored securely and shown only to authorised staff.
            </p>
          </div>

          <div className="border-t border-ink/10 p-4">
            <button
              type="button"
              onClick={confirm}
              disabled={!valid}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm check-in
            </button>
            {!valid && <p className="mt-2 text-xs text-ink/60">Enter the ID number and phone to continue.</p>}
          </div>
        </>
      )}
    </div>
  )
}