import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { stamp } from '../../lib/folio'
import { DEFAULT_OFFER_HOURS, newWaitId } from '../../lib/waitlist'
import type { NewWaitEntry, WaitEntry } from '../../lib/waitlist'
import { WaitlistContext } from './waitlistContext'
import type { WaitlistValue } from './waitlistContext'

// The list of people the hotel could not take, kept above the app so the desk and the duty manager see
// the same queue.
export default function WaitlistProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<WaitEntry[]>([])

  const add = useCallback((input: NewWaitEntry, by: string) => {
    let made: WaitEntry | undefined
    setEntries((list) => {
      made = { ...input, id: newWaitId(list), at: stamp(), by, status: 'waiting', offerHours: DEFAULT_OFFER_HOURS }
      return [...list, made]
    })
    return made as WaitEntry
  }, [])

  const offer = useCallback((id: string) => {
    let made: WaitEntry | undefined
    setEntries((list) =>
      list.map((e) => {
        if (e.id !== id || e.status !== 'waiting') return e
        made = { ...e, status: 'offered', offeredAt: stamp() }
        return made
      }),
    )
    return made
  }, [])

  const booked = useCallback((id: string, reservationId: string) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, status: 'booked', bookedId: reservationId, closedAt: stamp() } : e)))
  }, [])

  const close = useCallback((id: string, reason: string) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, status: 'gone', closedAt: stamp(), closedReason: reason } : e)))
  }, [])

  // The offer ran out. Back to waiting rather than off the list: they are still a guest who wants a room,
  // and the hotel may reach them on the next cancellation.
  const lapse = useCallback((id: string) => {
    setEntries((list) => list.map((e) => (e.id === id && e.status === 'offered' ? { ...e, status: 'waiting', offeredAt: undefined } : e)))
  }, [])

  const value = useMemo<WaitlistValue>(() => ({ entries, add, offer, booked, close, lapse }), [entries, add, offer, booked, close, lapse])
  return <WaitlistContext.Provider value={value}>{children}</WaitlistContext.Provider>
}
