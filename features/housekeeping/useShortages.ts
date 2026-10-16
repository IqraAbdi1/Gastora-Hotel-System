import { useMemo } from 'react'
import { TODAY } from '../../data/sample'
import { useHotel } from '../../lib/hotelContext'
import { useHousekeeping } from './hkContext'
import { estimateReady } from './hkModel'
import type { HkRoom } from './hkModel'

export type Shortage = {
  type: string
  arriving: number
  ready: number
  cleaning: number
  dirty: number
  firstReady?: string // earliest time a room of this type should be ready
  candidate?: HkRoom // best room to rush: one already being cleaned first, then the lowest number
  alreadyRushed?: HkRoom
}

// Room types where today's arrivals outnumber the rooms that are clean and free.
export function useShortages(): Shortage[] {
  const { reservations } = useHotel()
  const { rooms } = useHousekeeping()

  return useMemo(() => {
    const arriving = new Map<string, number>()
    for (const r of reservations) {
      if (r.status === 'booked' && r.arrival === TODAY) arriving.set(r.roomType, (arriving.get(r.roomType) ?? 0) + 1)
    }
    const out: Shortage[] = []
    for (const [type, count] of arriving) {
      const ofType = rooms.filter((r) => r.type === type)
      const ready = ofType.filter((r) => r.status === 'Clean' || r.status === 'Inspected').length
      if (count <= ready) continue
      const waiting = ofType
        .filter((r) => r.status === 'Dirty' || r.status === 'Being Cleaned')
        .sort(
          (a, b) =>
            Number(b.status === 'Being Cleaned') - Number(a.status === 'Being Cleaned') || a.room.localeCompare(b.room),
        )
      const times = waiting.map((r) => r.readyBy ?? estimateReady(r)).sort()
      out.push({
        type,
        arriving: count,
        ready,
        cleaning: waiting.filter((r) => r.status === 'Being Cleaned').length,
        dirty: waiting.filter((r) => r.status === 'Dirty').length,
        firstReady: times[0],
        candidate: waiting.find((r) => !r.rushed),
        alreadyRushed: waiting.find((r) => r.rushed),
      })
    }
    return out
  }, [reservations, rooms])
}