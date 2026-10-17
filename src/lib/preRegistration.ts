// Letting the guest fill in their own details before they arrive.
//
// A registration card is the same nine questions every time, and today a receptionist types them while
// a tired guest stands at the desk reading their own ID upside down. The guest can answer them at home,
// on their phone, the evening before. The desk then checks rather than types.
//
// Two lines that decide the shape of this. The guest may fill in facts about themselves and nothing
// else: not the dates, not the room, not the rate, because those cost money and belong to the hotel.
// And nothing the guest sends is believed on its own - it waits, marked as theirs, until a member of
// staff has seen it against the ID in their hand.
//
// Pure rules only: no React.

import type { GuestDetails } from '../types'

/** What the guest may answer about themselves. Everything here is a fact about the person, not the stay. */
export type PreRegDetails = Partial<
  Pick<
    GuestDetails,
    | 'idType'
    | 'idNumber'
    | 'idExpiry'
    | 'dateOfBirth'
    | 'gender'
    | 'nationality'
    | 'address'
    | 'email'
    | 'phone'
    | 'purpose'
    | 'comingFrom'
    | 'nextDestination'
    | 'vehiclePlate'
    | 'emergencyName'
    | 'emergencyPhone'
    | 'specialRequests'
    | 'adults'
    | 'children'
    | 'marketingConsent'
    | 'termsAccepted'
  >
> & {
  /** The guest agreeing to be remembered between stays, asked here in the same words as at the desk. */
  loyaltyConsent?: boolean
  /** Diet and access needs, which the law treats as sensitive and which are asked for separately. */
  sensitiveConsent?: boolean
  preferenceTags?: string[]
}

export interface PreReg {
  /** What the link carries. Long enough that a stay cannot be opened by guessing a booking number. */
  token: string
  sentAt?: string
  /** When the guest first opened the link. Tells the desk the message arrived. */
  openedAt?: string
  submittedAt?: string
  /** Set when a member of staff has checked it against the guest standing in front of them. */
  acceptedAt?: string
  acceptedBy?: string
  details?: PreRegDetails
}

export type PreRegState = 'not sent' | 'sent' | 'opened' | 'filled in' | 'checked'

export const PRE_REG_LABEL: Record<PreRegState, string> = {
  'not sent': 'Not sent',
  sent: 'Link sent',
  opened: 'Guest opened it',
  'filled in': 'Filled in by the guest',
  checked: 'Checked at the desk',
}

export const PRE_REG_TONE: Record<PreRegState, 'neutral' | 'info' | 'warn' | 'good'> = {
  'not sent': 'neutral',
  sent: 'info',
  opened: 'info',
  'filled in': 'warn',
  checked: 'good',
}

export function preRegState(pre: PreReg | undefined): PreRegState {
  if (!pre) return 'not sent'
  if (pre.acceptedAt) return 'checked'
  if (pre.submittedAt) return 'filled in'
  if (pre.openedAt) return 'opened'
  if (pre.sentAt) return 'sent'
  return 'not sent'
}

/**
 * The token in the link. A real one is a random string kept on the server and never derived from
 * anything; this one is worked out from the booking so a prototype with no server can still find the
 * stay again. It is the one part of this that a real build replaces.
 */
export function tokenFor(reservationId: string, arrival: string): string {
  let hash = 0
  const seed = `${reservationId}|${arrival}|gastora`
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return `${reservationId.toLowerCase().replace(/[^a-z0-9]/g, '')}${hash.toString(36)}`
}

export const preRegLink = (origin: string, reservationId: string, arrival: string): string =>
  `${origin}/arrive/${tokenFor(reservationId, arrival)}`

/** The questions the guest is asked, in the order they are asked. */
export const PRE_REG_FIELDS: { key: keyof PreRegDetails; label: string; required?: boolean }[] = [
  { key: 'idType', label: 'ID type', required: true },
  { key: 'idNumber', label: 'ID number', required: true },
  { key: 'idExpiry', label: 'ID expiry' },
  { key: 'dateOfBirth', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'nationality', label: 'Nationality', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Home address' },
  { key: 'purpose', label: 'Purpose of visit' },
  { key: 'comingFrom', label: 'Coming from' },
  { key: 'nextDestination', label: 'Next destination' },
  { key: 'vehiclePlate', label: 'Vehicle plate' },
  { key: 'emergencyName', label: 'Emergency contact' },
  { key: 'emergencyPhone', label: 'Emergency phone' },
]

const filled = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== ''

/** Enough to be worth the desk's while: the questions the register itself needs. */
export function preRegComplete(d: PreRegDetails | undefined): boolean {
  if (!d) return false
  return PRE_REG_FIELDS.filter((f) => f.required).every((f) => filled(d[f.key])) && d.termsAccepted === true
}

export function preRegProgress(d: PreRegDetails | undefined): { answered: number; total: number } {
  const total = PRE_REG_FIELDS.length
  if (!d) return { answered: 0, total }
  return { answered: PRE_REG_FIELDS.filter((f) => filled(d[f.key])).length, total }
}

/** What the guest said, ready to drop into the check-in form. Blank answers never overwrite anything. */
export function fromPreReg(d: PreRegDetails | undefined): Partial<GuestDetails> {
  if (!d) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(d)) {
    if (key === 'preferenceTags' || key === 'loyaltyConsent' || key === 'sensitiveConsent') continue
    if (filled(value)) out[key] = value
  }
  return out as Partial<GuestDetails>
}

/** Which answers differ from what the desk already had, so a receptionist can look at those first. */
export function changedFrom(d: PreRegDetails | undefined, had: Partial<GuestDetails>): string[] {
  if (!d) return []
  return PRE_REG_FIELDS.filter((f) => {
    const theirs = d[f.key]
    const ours = had[f.key as keyof GuestDetails]
    return filled(theirs) && filled(ours) && String(theirs).trim() !== String(ours).trim()
  }).map((f) => f.label)
}
