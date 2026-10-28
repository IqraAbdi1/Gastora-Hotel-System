// Travel agents as a booking source, and the commission the hotel owes them.
//
// A tour operator in Kampala rings the desk and books three nights for a client. The hotel owes that
// agent a share of the room money, and somebody has to know how much, to whom, and for which stays -
// usually on a spreadsheet that is three months behind. This keeps the list of agents the hotel
// deals with and works the figure out from the bookings themselves.
//
// The same rules the hotel's points already follow (src/lib/points.ts), for the same reasons:
//
//   1. Commission is earned on the room money only, never on the bar, the laundry or the tax.
//   2. It is earned when the stay is completed. A booking that is still to come is shown as expected,
//      not owed; a cancelled booking or a no-show earns nothing.
//   3. The percentage is copied onto the booking when it is made, so changing an agent's rate later
//      does not rewrite what was agreed for stays already booked.
//
// Two ways an agent is paid, and they are opposite directions of money:
//
//   - Commission billing: the guest pays the hotel, and the hotel owes the agent its commission.
//   - Net billing: the agent collected from the guest, so the agent owes the hotel the room money less
//     its commission. Nothing is owed to the agent; it has already kept its share.
//
// Channels (online travel agents, src/lib/channels.ts) are a different thing: they reach the public
// through a connection. These are the agents who ring or email the desk. The commission arithmetic
// is shared.
//
// Honest limits: nothing is paid out or invoiced from here; the figures are what the hotel takes to
// its accounts. Pure rules only: no React.

import { commissionOn } from './channels'
import { roomMoneyOf } from './points'
import type { Reservation } from '../types'

export interface TravelAgent {
  id: string
  name: string
  contact: string
  phone: string
  email?: string
  /** What the agent earns, as a percentage of the room money. */
  commissionPercent: number
  /** True when the agent takes the guest's money and pays the hotel the net. */
  collectsPayment: boolean
  active: boolean
}

/** What a booking keeps about the agent that made it, frozen at the moment it was made. */
export type AgentLink = Pick<TravelAgent, 'id' | 'name' | 'commissionPercent' | 'collectsPayment'>

export const linkFor = (a: TravelAgent): AgentLink => ({
  id: a.id,
  name: a.name,
  commissionPercent: a.commissionPercent,
  collectsPayment: a.collectsPayment,
})

export const BILLING_LABEL = {
  commission: 'Guest pays the hotel; the hotel pays the agent its commission',
  net: 'The agent collects from the guest and pays the hotel the net',
}

export const SAMPLE_AGENTS: TravelAgent[] = [
  { id: 'AG-1', name: 'Pearl Horizon Safaris', contact: 'Ronald Mukasa', phone: '0772 610 220', email: 'bookings@pearlhorizon.example', commissionPercent: 10, collectsPayment: false, active: true },
  { id: 'AG-2', name: 'Kampala Travel Bureau', contact: 'Agnes Nalubega', phone: '0414 250 330', email: 'res@ktb.example', commissionPercent: 8, collectsPayment: true, active: true },
  { id: 'AG-3', name: 'Rwenzori Trails', contact: 'Simon Bwambale', phone: '0703 118 904', commissionPercent: 12, collectsPayment: false, active: true },
]

export function newAgentId(list: TravelAgent[]): string {
  let n = list.length + 1
  while (list.some((a) => a.id === `AG-${n}`)) n += 1
  return `AG-${n}`
}

export type CommissionState = 'earned' | 'expected' | 'none'

/** Where one booking's commission stands, and how much it is or will be. */
export function commissionOf(r: Reservation): { state: CommissionState; amount: number } {
  if (!r.agent) return { state: 'none', amount: 0 }
  if (r.status === 'cancelled' || r.status === 'no-show') return { state: 'none', amount: 0 }
  const amount = commissionOn(roomMoneyOf(r), r.agent)
  return { state: r.status === 'checked-out' ? 'earned' : 'expected', amount }
}

export interface AgentStatement {
  agent: TravelAgent
  bookings: number
  completed: number
  /** Room money on completed stays. */
  roomMoney: number
  /** Commission on completed stays. */
  earned: number
  /** Commission that will be earned if the booked and in-house stays complete. */
  expected: number
  /** Bookings that were cancelled or never arrived, which earn nothing. */
  lost: number
  /** Commission billing: what the hotel owes the agent. */
  owedToAgent: number
  /** Net billing: what the agent owes the hotel for completed stays. */
  owedByAgent: number
}

/** Each agent's account, from the bookings that carry its name. */
export function statements(agents: TravelAgent[], reservations: Reservation[]): AgentStatement[] {
  return agents.map((agent) => {
    const s: AgentStatement = { agent, bookings: 0, completed: 0, roomMoney: 0, earned: 0, expected: 0, lost: 0, owedToAgent: 0, owedByAgent: 0 }
    for (const r of reservations) {
      if (r.agent?.id !== agent.id) continue
      s.bookings += 1
      const c = commissionOf(r)
      if (r.status === 'cancelled' || r.status === 'no-show') s.lost += 1
      else if (c.state === 'earned') {
        const room = roomMoneyOf(r)
        s.completed += 1
        s.roomMoney += room
        s.earned += c.amount
        // The billing written on the booking decides, not today's setting.
        if (r.agent.collectsPayment) s.owedByAgent += room - c.amount
        else s.owedToAgent += c.amount
      } else s.expected += c.amount
    }
    return s
  })
}
