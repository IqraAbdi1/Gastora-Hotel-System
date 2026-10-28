// Check-in and check-out times and the late check-out charge. Rules, not AI.
// Set per hotel by the hotel admin or owner in Hotel settings. Each hotel can differ.
export interface StayTimes {
  /** Rooms are promised from this time, for example 14:00. */
  checkInTime: string
  /** Guests must leave by this time, for example 11:00. */
  checkOutTime: string
  /** Rule: leaving after check-out time is free until this hour. */
  lateFreeUntil: string
  /** Rule: until this hour half a night is charged. After it, a full night. */
  lateHalfUntil: string
  /**
   * Rule: arriving before the check-in time is free from this hour, when a clean room is ready. Before
   * it the guest has slept in the room on a night the hotel could have sold, so half a night is
   * charged, and before the early hour below, a full one.
   */
  earlyFreeFrom: string
  /** Until this hour an early arrival costs a full night, because the room was held overnight. */
  earlyFullBefore: string
  /** A nearby hotel guests can be moved to when nothing is free. Empty means none. */
  partnerHotel: string
}

export const DEFAULT_STAY_TIMES: StayTimes = {
  checkInTime: '14:00',
  checkOutTime: '11:00',
  lateFreeUntil: '14:00',
  lateHalfUntil: '18:00',
  earlyFreeFrom: '10:00',
  earlyFullBefore: '06:00',
  partnerHotel: '',
}

/** The clock now, as HH:MM. The prototype uses the computer's clock. */
export const nowTime = () => new Date().toTimeString().slice(0, 5)

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const t = (((h * 60 + m + minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export const laterOf = (a: string, b: string) => (a >= b ? a : b)

export interface LateFee {
  kind: 'none' | 'half' | 'full'
  amount: number
  label: string
}

/** What leaving late costs, from the hotel's rules. The rate is one night's room charge. */
export function lateCheckoutFee(s: StayTimes, time: string, nightlyRate: number): LateFee {
  if (time <= s.lateFreeUntil) return { kind: 'none', amount: 0, label: `Free until ${s.lateFreeUntil}` }
  if (time <= s.lateHalfUntil)
    return { kind: 'half', amount: Math.round(nightlyRate / 2), label: `Half night, left after ${s.lateFreeUntil}` }
  return { kind: 'full', amount: Math.round(nightlyRate), label: `Full night, left after ${s.lateHalfUntil}` }
}

export interface EarlyFee {
  kind: 'none' | 'half' | 'full'
  amount: number
  label: string
}

/**
 * What arriving early costs. A guest who walks in at eleven for a two o'clock room has cost the hotel
 * nothing if a room is clean. One who arrives at four in the morning has slept a night the hotel could
 * have sold, and every hotel charges for that.
 */
export function earlyArrivalFee(s: StayTimes, time: string, nightlyRate: number): EarlyFee {
  if (time >= s.checkInTime) return { kind: 'none', amount: 0, label: 'Arrived at or after check-in time' }
  if (time >= s.earlyFreeFrom) return { kind: 'none', amount: 0, label: `Free from ${s.earlyFreeFrom} when a room is ready` }
  if (time >= s.earlyFullBefore)
    return { kind: 'half', amount: Math.round(nightlyRate / 2), label: `Half night, arrived before ${s.earlyFreeFrom}` }
  return { kind: 'full', amount: Math.round(nightlyRate), label: `Full night, arrived before ${s.earlyFullBefore}` }
}

/** When a room would be ready for the waiting guest: a dirty room rushed now, or an occupied one cleaned after check-out time. */
export function readyEstimate(kind: 'dirty' | 'leaving', s: StayTimes, cleanMins: number, now: string): string {
  const start = kind === 'dirty' ? now : laterOf(now, s.checkOutTime)
  return addMinutes(start, cleanMins)
}
