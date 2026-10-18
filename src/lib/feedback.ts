// What guests said, and what the hotel did about it.
//
// A complaint and a compliment are the same record with a different face, so they are kept together. A
// hotel that files complaints somewhere separate ends up with a drawer nobody opens, and the first
// anybody hears of a pattern is a review.
//
// Three things make this worth keeping rather than nodding at:
//
//   - It is attached to the guest and the stay. "Room 204 was noisy" is a shrug; "room 204 was noisy,
//     from three different guests this month" is a decision about room 204.
//   - It is open until somebody closes it, and a complaint left open is visible. Service recovery is
//     almost entirely about speed: a guest whose problem was fixed badly but quickly forgives more
//     than one whose problem was fixed well a week later.
//   - What was done is recorded beside what was wrong, including anything the hotel gave away, so the
//     cost of putting things right can be seen.
//
// Pure rules only: no React.

export type FeedbackKind = 'complaint' | 'compliment' | 'suggestion'

export const KIND_LABEL: Record<FeedbackKind, string> = {
  complaint: 'Something went wrong',
  compliment: 'Something was good',
  suggestion: 'A suggestion',
}

export const KIND_TONE: Record<FeedbackKind, 'bad' | 'good' | 'neutral'> = {
  complaint: 'bad',
  compliment: 'good',
  suggestion: 'neutral',
}

/** What it was about. Kept short on purpose: a long list is a list nobody picks from honestly. */
export const ABOUT = ['The room', 'Cleanliness', 'Noise', 'Food and drink', 'Service', 'The bill', 'Something else'] as const
export type About = (typeof ABOUT)[number]

export type FeedbackState = 'open' | 'put right' | 'closed'

export const STATE_TONE: Record<FeedbackState, 'bad' | 'good' | 'neutral'> = {
  open: 'bad',
  'put right': 'good',
  closed: 'neutral',
}

export interface Resolution {
  at: string
  by: string
  text: string
  /** What the hotel gave away to put it right, if anything. Recorded, not posted. */
  gesture?: string
  gestureAmount?: number
}

export interface Feedback {
  id: string
  at: string
  /** Who wrote it down: a member of staff, or the guest themselves. */
  by: string
  fromGuest: boolean
  kind: FeedbackKind
  about: About
  text: string
  /** Out of five, where the guest gave one. */
  rating?: number
  guestId?: string
  guestName: string
  reservationId?: string
  room?: string
  state: FeedbackState
  resolution?: Resolution
}

/** A complaint older than this and still open is late, in hours. */
export const LATE_AFTER = 24

export function hoursSince(at: string, now: Date): number {
  const then = Date.parse(at.replace(' ', 'T'))
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.round((now.getTime() - then) / 3600000))
}

/** Open complaints that have been open too long. Compliments are never late. */
export const lateOnes = (list: Feedback[], now: Date): Feedback[] =>
  list.filter((f) => f.kind === 'complaint' && f.state === 'open' && hoursSince(f.at, now) >= LATE_AFTER)

export const openOnes = (list: Feedback[]): Feedback[] => list.filter((f) => f.state === 'open')

export const forGuest = (list: Feedback[], guestId?: string, guestName?: string): Feedback[] =>
  list.filter((f) => (guestId && f.guestId === guestId) || (!!guestName && f.guestName === guestName))

/**
 * What a room has heard lately, which is the number that turns a shrug into a decision. Counted over
 * complaints only: compliments about a room do not argue for taking it out of service.
 */
export function byRoom(list: Feedback[]): { room: string; complaints: number }[] {
  const seen = new Map<string, number>()
  for (const f of list) {
    if (f.kind !== 'complaint' || !f.room) continue
    seen.set(f.room, (seen.get(f.room) ?? 0) + 1)
  }
  return [...seen.entries()]
    .map(([room, complaints]) => ({ room, complaints }))
    .sort((a, b) => b.complaints - a.complaints)
}

export function newFeedbackId(list: Feedback[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `FB-${String(n).padStart(3, '0')}`)) n += 1
  return `FB-${String(n).padStart(3, '0')}`
}

/** The average of the ratings guests gave, or nothing when nobody has rated anything. */
export function averageRating(list: Feedback[]): number | undefined {
  const rated = list.filter((f) => typeof f.rating === 'number')
  if (rated.length === 0) return undefined
  return Math.round((rated.reduce((n, f) => n + (f.rating ?? 0), 0) / rated.length) * 10) / 10
}
