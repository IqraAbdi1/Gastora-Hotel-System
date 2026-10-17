import type { Room } from '../types'

// Above this many rooms the Board opens on "Needs action" instead of showing everything.
export const BIG_HOTEL = 60

// For now the floor comes from the room number (101 is floor 1, 1504 is floor 15).
// Later this becomes a real building, wing and floor field.
export function floorOf(room: Room) {
  const n = parseInt(room.number, 10)
  return Number.isNaN(n) ? 0 : Math.floor(n / 100)
}

export function floorLabel(floor: number) {
  return floor === 0 ? 'Other' : `Floor ${floor}`
}