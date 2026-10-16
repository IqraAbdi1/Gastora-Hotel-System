import { useState } from 'react'
import { useHotel } from '../../lib/hotelContext'
import type { Guest, IdType } from '../../types'

type Props = { guest?: Guest; onClose: () => void; onSaved?: (guest: Guest) => void }

const idTypes: IdType[] = ['NIN', 'Passport', 'Driving permit']
const field = 'w-full rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'
const heading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'
const digits = (s: string) => s.replace(/\D/g, '')
const optional = (v: string) => (v.trim() === '' ? undefined : v.trim())

export default function GuestEditPanel({ guest, onClose, onSaved }: Props) {
  const { guests, addGuest, updateGuest } = useHotel()

  const [name, setName] = useState(guest?.name ?? '')
  const [phone, setPhone] = useState(guest?.phone ?? '')
  const [email, setEmail] = useState(guest?.email ?? '')
  const [nationality, setNationality] = useState(guest?.nationality ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(guest?.dateOfBirth ?? '')
  const [gender, setGender] = useState(guest?.gender ?? '')
  const [address, setAddress] = useState(guest?.address ?? '')
  const [idType, setIdType] = useState<IdType>(guest?.idType ?? 'NIN')
  const [idNumber, setIdNumber] = useState(guest?.idNumber ?? '')
  const [vip, setVip] = useState(guest?.vip ?? false)
  const [marketingConsent, setMarketingConsent] = useState(guest?.marketingConsent ?? false)

  // Another guest with the same phone number is probably a duplicate.
  const phoneDigits = digits(phone)
  const clash =
    phoneDigits.length >= 9
      ? guests.find((g) => g.id !== guest?.id && digits(g.phone).slice(-9) === phoneDigits.slice(-9))
      : undefined
  const emailOk = email.trim() === '' || /^\S+@\S+\.\S+$/.test(email.trim())
  const valid = name.trim().length >= 2 && phoneDigits.length >= 9 && emailOk && !clash

  const problems: string[] = []
  if (name.trim().length < 2) problems.push('Enter the guest name.')
  if (phoneDigits.length < 9) problems.push('Enter a phone number with at least 9 digits.')
  if (clash) problems.push(`${clash.name} already uses this phone number.`)
  if (!emailOk) problems.push('Enter a valid email address, or leave it empty.')

  function save() {
    const values = {
      name: name.trim(),
      phone: phone.trim(),
      email: optional(email),
      nationality: optional(nationality),
      dateOfBirth: optional(dateOfBirth),
      gender: optional(gender),
      address: optional(address),
      idType: optional(idNumber) ? idType : undefined,
      idNumber: optional(idNumber),
      vip,
      marketingConsent,
    }
    if (guest) {
      updateGuest(guest.id, values)
    } else {
      const created = addGuest(values)
      onSaved?.(created)
    }
    onClose()
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-lg flex-col border-l border-ink/10 bg-surface shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
        <div>
          <h2 className="text-lg font-semibold">{guest ? `Edit ${guest.name}` : 'New guest'}</h2>
          <p className="text-sm text-ink/60">{guest ? guest.id : 'Creates a guest profile with no booking.'}</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className={heading}>Contact</p>
        <label className="block text-sm font-medium">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={`${field} mt-1`} />
          </label>
          <label className="block text-sm font-medium">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={`${field} mt-1`} />
          </label>
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
            Nationality
            <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="block text-sm font-medium">
            Date of birth
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-sm font-medium">
            Gender
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={`${field} mt-1`}>
              <option value="">Not stated</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={`${field} mt-1`} />
          </label>
        </div>

        <p className={heading}>Status and consent</p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} />
          VIP guest
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
          Agrees to receive offers by SMS and email
        </label>
      </div>

      <div className="space-y-2 border-t border-ink/10 p-4">
        {problems.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-bad/10 p-3 text-xs font-medium text-bad">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!valid}
            className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {guest ? 'Save changes' : 'Create guest'}
          </button>
        </div>
      </div>
    </div>
  )
}