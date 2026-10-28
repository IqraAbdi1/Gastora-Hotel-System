// One owner, several hotels.
//
// A chain's booking office takes a call for Kampala, finds it full, and should be able to say "we have
// something in Entebbe on those nights" instead of losing the guest to whoever answers the phone next.
// That is a central reservation system, and it is a different shape from this product's usual one: a
// hotel on Gastora is a tenant sealed off from every other tenant, which is exactly what a hotel wants
// and exactly what a group does not.
//
// What belongs to a group, and what does not, is worth being strict about. The group sees whether a
// sister property has room and may send it a booking. It does not see that property's guests, its
// folios, its staff or its takings, because a group of hotels under one owner is still several hotels
// under the law and under each manager's own responsibility.
//
// Pure rules only: no React.

import type { Room } from '../types'

export type RequestState = 'sent' | 'accepted' | 'declined' | 'withdrawn'

export const REQUEST_LABEL: Record<RequestState, string> = {
  sent: 'Waiting for the other hotel',
  accepted: 'Taken',
  declined: 'They could not take it',
  withdrawn: 'Withdrawn',
}

export const REQUEST_TONE: Record<RequestState, 'warn' | 'good' | 'bad' | 'neutral'> = {
  sent: 'warn',
  accepted: 'good',
  declined: 'bad',
  withdrawn: 'neutral',
}

/** A booking one property in the group asks another to take. */
export interface CrossRequest {
  id: string
  /** The property that asked. */
  fromTenantId: string
  fromTenantName: string
  /** The property being asked. */
  toTenantId: string
  guest: string
  phone: string
  roomType: Room['type']
  arrival: string
  departure: string
  adults: number
  note?: string
  at: string
  by: string
  state: RequestState
  /** The booking the receiving property made out of it. */
  bookingId?: string
  /** Why they could not take it. */
  reason?: string
}

export const incoming = (requests: CrossRequest[], tenantId: string): CrossRequest[] =>
  requests.filter((r) => r.toTenantId === tenantId).sort((a, b) => b.at.localeCompare(a.at))

export const outgoing = (requests: CrossRequest[], tenantId: string): CrossRequest[] =>
  requests.filter((r) => r.fromTenantId === tenantId).sort((a, b) => b.at.localeCompare(a.at))

export const waitingFor = (requests: CrossRequest[], tenantId: string): number =>
  incoming(requests, tenantId).filter((r) => r.state === 'sent').length

export function newRequestId(requests: CrossRequest[]): string {
  let n = requests.length + 1
  while (requests.some((r) => r.id === `CR-${n}`)) n += 1
  return `CR-${n}`
}
