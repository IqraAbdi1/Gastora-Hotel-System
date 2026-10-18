// Room keys, as far as software can honestly go.
//
// The lock on the door belongs to a vendor. What a hotel system owns is the record: which key opens
// which room, until when, who issued it, and whether it has been handed back. That record is worth
// having on its own - a hotel that can answer "who had a key to 204 on Tuesday night" has answered the
// question that matters after a theft, whatever brand of lock is on the door.
//
// Every key here is a card the desk writes and a guest carries. Where a real installation would call
// the lock vendor to encode it, there is one function and it is marked.
//
// Pure rules only: no React.

export type KeyState = 'active' | 'returned' | 'expired' | 'cancelled'

export const KEY_STATE_LABEL: Record<KeyState, string> = {
  active: 'Working',
  returned: 'Handed back',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

export const KEY_STATE_TONE: Record<KeyState, 'good' | 'neutral' | 'warn' | 'bad'> = {
  active: 'good',
  returned: 'neutral',
  expired: 'warn',
  cancelled: 'bad',
}

export interface RoomKey {
  id: string
  reservationId: string
  room: string
  guest: string
  /** A copy for a second guest, a colleague or a spouse. The first is not a copy. */
  copy: boolean
  issuedAt: string
  issuedBy: string
  /** The last moment it opens the door, which is the departure day's check-out time. */
  worksUntil: string
  state: KeyState
  returnedAt?: string
  cancelledReason?: string
}

export const activeKeys = (keys: RoomKey[], reservationId: string): RoomKey[] =>
  keys.filter((k) => k.reservationId === reservationId && k.state === 'active')

/** Every key ever cut for a room, newest first. The answer to "who could open 204 on Tuesday". */
export const keysForRoom = (keys: RoomKey[], room: string): RoomKey[] =>
  keys.filter((k) => k.room === room).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))

export function newKeyId(keys: RoomKey[]): string {
  let n = keys.length + 1
  while (keys.some((k) => k.id === `KEY-${n}`)) n += 1
  return `KEY-${n}`
}

/** A key stops working when the guest was due to leave, whether or not anybody took it back. */
export function expiredBy(key: RoomKey, now: string): boolean {
  return key.state === 'active' && key.worksUntil < now
}

/**
 * Where a real installation encodes the card. One call to the lock vendor, and the only thing in this
 * file that cannot be built without their hardware - everything above is the hotel's own record.
 */
export function encodeCard(key: RoomKey): { ok: boolean; note: string } {
  return {
    ok: true,
    note: `Prototype: no card was written. A real installation calls the door-lock vendor here with room ${key.room} and ${key.worksUntil}.`,
  }
}
