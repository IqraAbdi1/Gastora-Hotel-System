import type { GuaranteeType, Room } from '../types'

// Sample prices. In the real system each hotel sets its own (FR-RMS-004).
export const roomRate: Record<Room['type'], number> = { Standard: 150000, Deluxe: 180000, Suite: 350000 }

export type RatePlan = { id: string; name: string; inclusions: string; extraPerNight: number }

export const ratePlans: RatePlan[] = [
  { id: 'room-only', name: 'Room only', inclusions: 'Room and Wi-Fi', extraPerNight: 0 },
  { id: 'bb', name: 'Bed and breakfast', inclusions: 'Room, Wi-Fi and breakfast for two', extraPerNight: 30000 },
  { id: 'hb', name: 'Half board', inclusions: 'Room, breakfast and dinner for two', extraPerNight: 70000 },
]

// Sample no-show and release rules (FR-RES-038). Each hotel will configure its own.
export const guarantees: { key: GuaranteeType; label: string; rule: string }[] = [
  { key: 'deposit', label: 'Deposit paid', rule: 'If the guest does not arrive, the deposit is kept as the no-show charge.' },
  { key: 'card', label: 'Card guarantee', rule: 'If the guest does not arrive, one night is charged to the card.' },
  { key: 'company', label: 'Company account', rule: 'If the guest does not arrive, the stay is billed to the company.' },
  { key: 'none', label: 'No guarantee', rule: 'The room is released at 18:00 on the arrival day if the guest has not arrived.' },
]

export const DEPOSIT_RATE = 0.3