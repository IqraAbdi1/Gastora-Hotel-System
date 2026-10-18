// Talking to the guest without anybody remembering to.
//
// A hotel's relationship with a guest in this market runs on WhatsApp and SMS, and almost all of it is
// the same five messages written out again and again by whoever is at the desk. The system already knows
// when each one is due, so it writes them and puts them in an outbox; a person still presses send unless
// the hotel says otherwise.
//
// Two things this is careful about. The wording belongs to the hotel, not to us, so every message is a
// template the hotel edits. And the law separates a message the stay requires from a message the hotel
// would like to send: a booking confirmation needs no permission because it is part of the contract,
// while anything that is really marketing needs the guest to have agreed.
//
// Pure rules only: no React, no sending.

export type MessageChannel = 'whatsapp' | 'sms' | 'email'

export type MessageKind =
  | 'booking confirmed'
  | 'deposit reminder'
  | 'before arrival'
  | 'room ready'
  | 'mid stay'
  | 'before checkout'
  | 'bill sent'
  | 'room now free'
  | 'room released'
  | 'thank you'
  | 'how was it'

export type MessageStatus = 'queued' | 'sent' | 'failed' | 'cancelled'

/** Why the hotel is allowed to send it. */
export type MessageBasis = 'the stay' | 'marketing'

export const MESSAGE_BASIS: Record<MessageKind, MessageBasis> = {
  'booking confirmed': 'the stay',
  'deposit reminder': 'the stay',
  'before arrival': 'the stay',
  'room ready': 'the stay',
  'mid stay': 'the stay',
  'before checkout': 'the stay',
  'bill sent': 'the stay',
  'room now free': 'the stay',
  'room released': 'the stay',
  'thank you': 'marketing',
  // Asking a guest how their own stay was is part of that stay, not an advertisement.
  'how was it': 'the stay',
}

export const BASIS_NOTE: Record<MessageBasis, string> = {
  'the stay': 'The booking requires it, so no permission is needed.',
  marketing: 'Only to guests who agreed to hear from the hotel.',
}

export const CHANNEL_LABEL: Record<MessageChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
}

export interface GuestMessage {
  id: string
  kind: MessageKind
  channel: MessageChannel
  /** The number or address as it was when the message was written. */
  to: string
  guestName: string
  body: string
  /** When it was put in the outbox. */
  at: string
  status: MessageStatus
  sentAt?: string
  /** Why it could not be sent, in the words the desk should read. */
  problem?: string
  reservationId?: string
  /** Who pressed send. Empty when the hotel has the system sending by itself. */
  by?: string
  /** The system wrote it, rather than a person composing it. */
  auto: boolean
}

export interface MessageTemplate {
  kind: MessageKind
  label: string
  /** What it is for, so the hotel knows what it is editing. */
  blurb: string
  text: string
  /** A hotel can switch off any single message without switching off the rest. */
  on: boolean
}

/** What the hotel can put inside a message. Anything else is left exactly as typed. */
export const PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: 'guest', meaning: "The guest's name" },
  { key: 'hotel', meaning: 'The hotel name' },
  { key: 'room', meaning: 'The room number, once there is one' },
  { key: 'arrival', meaning: 'Arrival date' },
  { key: 'departure', meaning: 'Departure date' },
  { key: 'nights', meaning: 'How many nights' },
  { key: 'balance', meaning: 'What is still owed' },
  { key: 'deposit', meaning: 'The deposit asked for' },
  { key: 'time', meaning: 'Check-in or check-out time, whichever the message is about' },
  { key: 'link', meaning: 'A link for the guest to open' },
  { key: 'hours', meaning: 'How long the guest has to answer, on a waiting-list offer' },
]

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    kind: 'booking confirmed',
    label: 'Booking confirmed',
    blurb: 'Sent once, when the booking is made.',
    on: true,
    text: 'Dear {guest}, your booking at {hotel} is confirmed for {arrival} to {departure}, {nights} night(s). We look forward to welcoming you.',
  },
  {
    kind: 'deposit reminder',
    label: 'Deposit reminder',
    blurb: 'Sent before arrival when a deposit is still owed and nothing else secures the booking.',
    on: true,
    text: 'Dear {guest}, your booking at {hotel} for {arrival} is not yet secured. A deposit of {deposit} holds the room until {time} on the day of arrival.',
  },
  {
    kind: 'before arrival',
    label: 'Before you arrive',
    blurb: 'Sent the day before arrival, or by hand from the booking. Carries the link where the guest fills in their own details.',
    on: true,
    text: 'Dear {guest}, we are expecting you at {hotel} on {arrival}. Save time at the desk by filling in your details here: {link}',
  },
  {
    kind: 'room ready',
    label: 'Room ready',
    blurb: 'Sent on arrival day once the room is clean and assigned.',
    on: true,
    text: 'Dear {guest}, your room at {hotel} is ready. Check-in is from {time}. We will see you soon.',
  },
  {
    kind: 'mid stay',
    label: 'Halfway through',
    blurb: 'Sent in the middle of a stay of three nights or more, so anything wrong can still be put right while the guest is here.',
    on: true,
    text: 'Dear {guest}, we hope all is well in room {room}. If there is anything you need, reply to this message or call the front desk.',
  },
  {
    kind: 'before checkout',
    label: 'Before checkout',
    blurb: 'Sent the evening before departure.',
    on: true,
    text: 'Dear {guest}, we hope you have enjoyed your stay. Check-out is by {time} on {departure} and your balance is {balance}. Please tell us if you would like a later departure.',
  },
  {
    kind: 'bill sent',
    label: 'Bill sent',
    blurb: 'Sent when a guest checks out without stopping at the desk.',
    on: true,
    text: 'Dear {guest}, thank you for staying at {hotel}. Your bill of {balance} has been settled and a copy is attached: {link}',
  },
  {
    kind: 'room now free',
    label: 'A room has come free',
    blurb: 'Sent to a guest on the waiting list when a cancellation frees a room.',
    on: true,
    text: 'Dear {guest}, a room has come free at {hotel} for {arrival} to {departure}. Reply within {hours} hours and it is yours, otherwise it goes to the next guest waiting.',
  },
  {
    kind: 'room released',
    label: 'Room released',
    blurb: 'Sent when nobody confirmed and the hour the hotel set has passed, so the room went back on sale.',
    on: true,
    text: 'Dear {guest}, we held your room at {hotel} until {time} and could not reach you, so it has been released. We are sorry. Please call us if you are still coming and we will see what is free.',
  },
  {
    kind: 'thank you',
    label: 'After the stay',
    blurb: 'Sent a day after departure. This one is marketing, so only to guests who agreed.',
    on: false,
    text: 'Dear {guest}, thank you for staying at {hotel}. We would be glad to welcome you again.',
  },
  {
    kind: 'how was it',
    label: 'How was it',
    blurb:
      'Sent two days after departure, carrying the link to the guest\u2019s own bill where they can say how it went. Asking a guest about their own stay is part of that stay, so it needs no marketing permission.',
    on: true,
    text: 'Dear {guest}, we hope you travelled well. If you have a moment, tell us how your stay at {hotel} was: {link}',
  },
]

export interface MessagingSettings {
  /** How the hotel talks to guests. One channel for the whole hotel keeps the record simple. */
  channel: MessageChannel
  /** The name the guest sees the message coming from. */
  senderName: string
  /**
   * Off: the system writes the message and a person presses send. On: it goes by itself.
   * Most hotels start with it off, because the first week is when the wording gets fixed.
   */
  autoSend: boolean
  /** How many days before arrival the deposit reminder goes out. */
  depositDaysBefore: number
  templates: MessageTemplate[]
}

export const DEFAULT_MESSAGING: MessagingSettings = {
  channel: 'whatsapp',
  senderName: '',
  autoSend: false,
  depositDaysBefore: 3,
  templates: DEFAULT_TEMPLATES,
}

export type MessageVars = Record<string, string>

/** Put the stay's own details into the hotel's wording. */
export function fillTemplate(text: string, vars: MessageVars): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole)
}

/** Placeholders the hotel has typed that this message cannot fill. Shown while editing, not at send time. */
export function unknownPlaceholders(text: string): string[] {
  const known = new Set(PLACEHOLDERS.map((p) => p.key))
  const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  return [...new Set(found.filter((f) => !known.has(f)))]
}

export const templateFor = (templates: MessageTemplate[], kind: MessageKind): MessageTemplate | undefined =>
  templates.find((t) => t.kind === kind)

/**
 * Whether this guest may be sent this message. A message the stay requires always may. Marketing only
 * goes to a guest who said yes, and a guest with no number cannot be reached at all.
 */
export function mayReceive(kind: MessageKind, to: string, marketingConsent: boolean | undefined): { ok: boolean; why?: string } {
  if (to.trim() === '') return { ok: false, why: 'No phone number on the booking.' }
  if (MESSAGE_BASIS[kind] === 'marketing' && !marketingConsent) {
    return { ok: false, why: 'The guest has not agreed to hear from the hotel.' }
  }
  return { ok: true }
}

/** One message the system believes is due, before anybody has agreed to send it. */
export interface DueMessage {
  kind: MessageKind
  reservationId: string
  /** The reason, in the words the desk would use. */
  why: string
}

/**
 * Whether this message has already been written for this stay, whatever became of it. A message the desk
 * chose not to send is not written again, and neither is one that could not go: both are decisions, and
 * the system quietly repeating itself every few seconds would be worse than either.
 */
export const writtenAlready = (messages: GuestMessage[], reservationId: string, kind: MessageKind): boolean =>
  messages.some((m) => m.reservationId === reservationId && m.kind === kind)

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}

export interface DueInput {
  id: string
  status: string
  arrival: string
  departure: string
  room: string | null
  /** True when the room the guest is coming to is clean and can be given out. */
  roomReady: boolean
  /** What is still owed on the stay. */
  balance: number
  /** True when nothing secures the booking: no deposit, no card, no company. */
  unguaranteed: boolean
}

/**
 * Which messages are due today, for one stay. Each one is written once: a reminder the guest has already
 * had is not sent again because the balance is still there in the morning.
 */
export function dueForStay(r: DueInput, today: string, settings: MessagingSettings, sent: GuestMessage[]): DueMessage[] {
  const out: DueMessage[] = []
  const on = (kind: MessageKind) => templateFor(settings.templates, kind)?.on !== false
  const fresh = (kind: MessageKind) => !writtenAlready(sent, r.id, kind)
  const toArrival = daysBetween(today, r.arrival)
  const toDeparture = daysBetween(today, r.departure)

  if (r.status === 'booked') {
    if (on('booking confirmed') && fresh('booking confirmed')) {
      out.push({ kind: 'booking confirmed', reservationId: r.id, why: 'The booking has just been made.' })
    }
    if (
      on('deposit reminder') &&
      fresh('deposit reminder') &&
      r.unguaranteed &&
      r.balance > 0 &&
      toArrival >= 0 &&
      toArrival <= settings.depositDaysBefore
    ) {
      out.push({
        kind: 'deposit reminder',
        reservationId: r.id,
        why: toArrival === 0 ? 'Arriving today with nothing securing the room.' : `Arriving in ${toArrival} day(s) with nothing securing the room.`,
      })
    }
    if (on('before arrival') && fresh('before arrival') && toArrival === 1) {
      out.push({ kind: 'before arrival', reservationId: r.id, why: 'Arriving tomorrow.' })
    }
    if (on('room ready') && fresh('room ready') && toArrival === 0 && r.room && r.roomReady) {
      out.push({ kind: 'room ready', reservationId: r.id, why: `Room ${r.room} is clean and waiting.` })
    }
  }

  // Halfway through a stay long enough for something to go wrong and still be put right. A one or two
  // night stay is over before a message like this would help, so it is not sent.
  if (r.status === 'in-house' && on('mid stay') && fresh('mid stay')) {
    const nights = daysBetween(r.arrival, r.departure)
    const soFar = daysBetween(r.arrival, today)
    if (nights >= 3 && soFar >= Math.floor(nights / 2) && toDeparture >= 1) {
      out.push({ kind: 'mid stay', reservationId: r.id, why: `Night ${soFar} of ${nights}, with time to put anything right.` })
    }
  }

  if (r.status === 'in-house' && on('before checkout') && fresh('before checkout') && toDeparture <= 1 && toDeparture >= 0) {
    out.push({ kind: 'before checkout', reservationId: r.id, why: toDeparture === 0 ? 'Leaving today.' : 'Leaving tomorrow.' })
  }

  if (r.status === 'checked-out' && on('thank you') && fresh('thank you') && daysBetween(r.departure, today) === 1) {
    out.push({ kind: 'thank you', reservationId: r.id, why: 'Left yesterday.' })
  }

  // Two days after leaving: late enough that the journey is over, early enough that the stay is still
  // remembered. Deliberately after the thank you, so the two do not arrive together.
  if (r.status === 'checked-out' && on('how was it') && fresh('how was it') && daysBetween(r.departure, today) === 2) {
    out.push({ kind: 'how was it', reservationId: r.id, why: 'Left two days ago.' })
  }

  return out
}

export function newMessageId(messages: GuestMessage[]): string {
  let n = messages.length + 1
  while (messages.some((m) => m.id === `MSG-${n}`)) n += 1
  return `MSG-${n}`
}

export const KIND_LABEL: Record<MessageKind, string> = {
  'booking confirmed': 'Booking confirmed',
  'deposit reminder': 'Deposit reminder',
  'before arrival': 'Before you arrive',
  'room ready': 'Room ready',
  'mid stay': 'Halfway through',
  'before checkout': 'Before checkout',
  'bill sent': 'Bill sent',
  'room now free': 'A room has come free',
  'room released': 'Room released',
  'thank you': 'After the stay',
  'how was it': 'How was it',
}

/** The three parts of a stay a journey is built from, and what each is for. */
export type Stage = 'before' | 'during' | 'after'

export const STAGE_LABEL: Record<Stage, string> = {
  before: 'Before they arrive',
  during: 'While they are here',
  after: 'After they leave',
}

export const STAGE_NOTE: Record<Stage, string> = {
  before: 'Securing the booking and saving time at the desk.',
  during: 'Catching anything that is wrong while it can still be put right.',
  after: 'Thanking them, and asking how it went.',
}

/** Which part of the stay each message belongs to, and when in that part it goes. */
export const JOURNEY: { kind: MessageKind; stage: Stage; when: string }[] = [
  { kind: 'booking confirmed', stage: 'before', when: 'As soon as the booking is made' },
  { kind: 'deposit reminder', stage: 'before', when: 'While a deposit is still owed' },
  { kind: 'before arrival', stage: 'before', when: 'The day before arrival' },
  { kind: 'room ready', stage: 'before', when: 'Arrival day, once the room is clean' },
  { kind: 'mid stay', stage: 'during', when: 'Halfway through a stay of three nights or more' },
  { kind: 'room now free', stage: 'during', when: 'When a room the guest waited for comes free' },
  { kind: 'before checkout', stage: 'during', when: 'The day before they leave' },
  { kind: 'bill sent', stage: 'after', when: 'When the bill is settled' },
  { kind: 'thank you', stage: 'after', when: 'The day after they leave' },
  { kind: 'how was it', stage: 'after', when: 'Two days after they leave' },
]
