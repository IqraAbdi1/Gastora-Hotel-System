// Rate parity: whether the hotel's own price is the one the public sees everywhere else.
//
// Why it matters more than it sounds. A channel showing a lower price than the hotel's own site teaches
// every guest to book through the channel, and the hotel then pays commission on business it already
// had. A channel showing a higher price loses the booking to somebody else entirely. Either way the
// hotel wants to know within the day, not at the end of the month.
//
// WHAT IS REAL HERE AND WHAT IS NOT.
//
// Monitoring parity for real means looking at what each channel is publishing, which is a rate-shopping
// feed bought from a company that does nothing else - OTA Insight, RateGain and their like. Nothing in
// this prototype can see another company's website, and inventing a figure and calling it Booking.com's
// price would be a lie a hotelier might act on.
//
// So every figure this file produces is marked sample, is worked out from the hotel's own rate by a
// fixed arithmetic rule, and is never presented as observed. What is honest and useful is the shape:
// which channel, which night, how far out of line, and what to do about it. Replacing `sampleSeen`
// with a real feed is the whole of the work, and it is one function.

import type { Channel } from './channels'
import type { Room } from '../types'

export type ParityState = 'in line' | 'cheaper there' | 'dearer there'

export const PARITY_TONE: Record<ParityState, 'good' | 'bad' | 'warn'> = {
  'in line': 'good',
  'cheaper there': 'bad',
  'dearer there': 'warn',
}

export const PARITY_NOTE: Record<ParityState, string> = {
  'in line': 'The channel is showing what the hotel shows.',
  'cheaper there':
    'The channel is undercutting the hotel. Guests learn to book there, and the hotel pays commission on business it already had.',
  'dearer there': 'The channel is dearer than the hotel. The booking goes to somebody else entirely.',
}

export interface ParityLine {
  channelId: string
  channelName: string
  date: string
  type: Room['type']
  /** What the hotel's own site is asking. */
  ours: number
  /** What the channel is showing. Sample in this prototype. */
  theirs: number
  /** Their price less ours. Negative means they are cheaper. */
  gap: number
  state: ParityState
  /** Always true here, so nothing on screen can pretend it was observed. */
  sample: boolean
}

/**
 * The one function a real build replaces.
 *
 * A fixed rule, not a random number, so the same night reads the same every time the page is opened: a
 * figure that danced about on each refresh would be obviously fake, and worse, unarguable.
 */
function sampleSeen(channelId: string, date: string, ours: number): number {
  let h = 11
  for (const ch of `${channelId}:${date}`) h = (h * 31 + ch.charCodeAt(0)) % 100000
  // Most nights match. Some drift a few percent either way, which is what parity breaks look like.
  const roll = h % 10
  if (roll < 6) return ours
  const drift = roll < 8 ? -(2 + (h % 6)) : 2 + (h % 5)
  return Math.max(0, Math.round((ours * (1 + drift / 100)) / 100) * 100)
}

/** How far out of line a price has to be before anyone should care. */
export const TOLERANCE = 0.01

export function parityFor(
  channels: Channel[],
  dates: string[],
  rateOn: (type: Room['type'], date: string) => number,
  typesOf: (c: Channel) => Room['type'][],
): ParityLine[] {
  const out: ParityLine[] = []
  for (const c of channels) {
    if (!c.on) continue
    for (const date of dates) {
      for (const type of typesOf(c)) {
        const ours = rateOn(type, date)
        if (ours <= 0) continue
        const theirs = sampleSeen(`${c.id}:${type}`, date, ours)
        const gap = theirs - ours
        const state: ParityState =
          Math.abs(gap) <= ours * TOLERANCE ? 'in line' : gap < 0 ? 'cheaper there' : 'dearer there'
        out.push({ channelId: c.id, channelName: c.name, date, type, ours, theirs, gap, state, sample: true })
      }
    }
  }
  return out
}

export const outOfLine = (list: ParityLine[]): ParityLine[] => list.filter((l) => l.state !== 'in line')
