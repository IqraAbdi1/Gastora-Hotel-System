import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'

/**
 * What a guest asked the hotel for, from their own page.
 *
 * Kept apart from the desk's own tasks on purpose: a guest asking is not yet a thing the hotel has
 * agreed to do. It becomes one when somebody at the desk says yes.
 */
export interface GuestRequest {
  id: string
  at: string
  reservationId: string
  guestId?: string
  guestName: string
  room?: string
  /** An offer the guest accepted, or something they typed themselves. */
  kind: 'offer' | 'ask'
  offerId?: string
  offerKind?: string
  title: string
  detail?: string
  price?: number
  state: 'new' | 'agreed' | 'declined'
  by?: string
  decidedAt?: string
  /** True once the money is on the folio. A bill that is not open yet cannot take a charge. */
  posted?: boolean
  /** Why the desk said no, in words the guest could be told. */
  reason?: string
}

const KEY = 'gastora:hotel:guestRequests'

export function useGuestRequests() {
  const [requests, setRequests] = useBrowserSyncedState<GuestRequest[]>(KEY, [])
  const add = (r: GuestRequest) => setRequests([r, ...requests])
  const update = (id: string, patch: Partial<GuestRequest>) =>
    setRequests(requests.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return { requests, setRequests, add, update }
}

export function newRequestId(list: GuestRequest[]): string {
  let n = list.length + 1
  while (list.some((r) => r.id === `GR-${String(n).padStart(3, '0')}`)) n += 1
  return `GR-${String(n).padStart(3, '0')}`
}
