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
  /** A nearby hotel guests can be moved to when nothing is free. Empty means none. */
  partnerHotel: string
}

export const DEFAULT_STAY_TIMES: StayTimes = {
  checkInTime: '14:00',
  checkOutTime: '11:00',
  lateFreeUntil: '14:00',
  lateHalfUntil: '18:00',
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

/** When a room would be ready for the waiting guest: a dirty room rushed now, or an occupied one cleaned after check-out time. */
export function readyEstimate(kind: 'dirty' | 'leaving', s: StayTimes, cleanMins: number, now: string): string {
  const start = kind === 'dirty' ? now : laterOf(now, s.checkOutTime)
  return addMinutes(start, cleanMins)
}
