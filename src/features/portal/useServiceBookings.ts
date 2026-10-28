import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { TODAY } from '../../data/sample'
import { sampleServiceBookings } from '../../lib/services'
import type { ServiceBooking } from '../../lib/services'

/**
 * Dining, spa and activity bookings guests made from their own pages. Kept in this browser beside the
 * hotel's own record, like guest requests, so the guest page and the desk agree in a one-browser
 * demonstration. A real build keeps them on the server, where two guests booking at once are settled.
 */
const KEY = 'gastora:hotel:serviceBookings'

export function useServiceBookings() {
  const [bookings, setBookings] = useBrowserSyncedState<ServiceBooking[]>(KEY, sampleServiceBookings(TODAY))
  const add = (b: ServiceBooking) => setBookings((list) => [b, ...list])
  const update = (id: string, patch: Partial<ServiceBooking>) =>
    setBookings((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return { bookings, add, update }
}
