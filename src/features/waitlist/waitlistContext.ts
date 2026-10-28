import { createContext, useContext } from 'react'
import type { NewWaitEntry, WaitEntry } from '../../lib/waitlist'

export interface WaitlistValue {
  entries: WaitEntry[]
  add: (input: NewWaitEntry, by: string) => WaitEntry
  /** The room is offered for a stated time. It is not held: the desk can still sell it. */
  offer: (id: string) => WaitEntry | undefined
  /** They took it. The booking that came out of it is recorded against the entry. */
  booked: (id: string, reservationId: string) => void
  /** They did not take it, or could not be reached. */
  close: (id: string, reason: string) => void
  /** The offer ran out: back to waiting, so the next person can be told. */
  lapse: (id: string) => void
}

export const WaitlistContext = createContext<WaitlistValue | null>(null)

export function useWaitlist(): WaitlistValue {
  const v = useContext(WaitlistContext)
  if (!v) throw new Error('useWaitlist must be used inside WaitlistProvider')
  return v
}
