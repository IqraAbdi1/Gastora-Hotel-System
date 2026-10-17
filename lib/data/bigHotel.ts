import type { Reservation, Room } from '../types'
import { TODAY } from './sample'
import { addDays, clashingStay } from '../lib/availability'

const first = ['Amina', 'Grace', 'Moses', 'David', 'Peter', 'Sarah', 'John', 'Esther', 'Brian', 'Ruth', 'Joel', 'Mary', 'Isaac', 'Faith']
const last = ['Nakato', 'Namukasa', 'Kato', 'Okello', 'Mugisha', 'Achieng', 'Ssemwogerere', 'Auma', 'Kigozi', 'Nabirye', 'Byaruhanga', 'Tumusiime']
const rate: Record<Room['type'], number> = { Standard: 150000, Deluxe: 180000, Suite: 350000 }
const sources: NonNullable<Reservation['source']>[] = ['walk-in', 'front desk', 'phone', 'email', 'online', 'ota']
const futureSources = sources.filter((s) => s !== 'walk-in')

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function makeBigHotel(): { rooms: Room[]; reservations: Reservation[] } {
  const rand = seeded(7)
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]
  const name = () => `${pick(first)} ${pick(last)}`

  const rooms: Room[] = []
  const reservations: Reservation[] = []
  let n = 5000

  for (let floor = 1; floor <= 20; floor++) {
    const type: Room['type'] = floor <= 10 ? 'Standard' : floor <= 17 ? 'Deluxe' : 'Suite'
    for (let i = 1; i <= 20; i++) {
      const number = String(floor * 100 + i)
      const roll = rand()
      if (roll < 0.02) {
        rooms.push({ number, type, status: 'blocked' })
      } else if (roll < 0.57) {
        const back = Math.floor(rand() * 4)
        const fwd = Math.max(Math.floor(rand() * 5), back === 0 ? 1 : 0)
        const nights = back + fwd
        const total = nights * rate[type]
        reservations.push({
          id: `R-${n++}`,
          guest: name(),
          roomType: type,
          room: number,
          arrival: addDays(TODAY, -back),
          departure: addDays(TODAY, fwd),
          status: 'in-house',
          source: pick(sources),
          total,
          paid: rand() < 0.8 ? total : Math.round((total * 0.5) / 1000) * 1000,
        })
        rooms.push({ number, type, status: 'occupied' })
      } else {
        rooms.push({ number, type, status: rand() < 0.2 ? 'dirty' : 'clean' })
      }
    }
  }

  const types: Room['type'][] = ['Standard', 'Deluxe', 'Suite']
  for (let i = 0; i < 200; i++) {
    const type = pick(types)
    const arrival = i < 40 ? TODAY : addDays(TODAY, 1 + Math.floor(rand() * 21))
    const departure = addDays(arrival, 1 + Math.floor(rand() * 5))
    const total = (new Date(departure).getTime() - new Date(arrival).getTime()) / 86400000 * rate[type]

    // Arrivals today get a room at check-in. Some later bookings are pre-assigned.
    let room: string | null = null
    if (i >= 40 && rand() < 0.4) {
      const candidate = pick(rooms.filter((r) => r.type === type && r.status !== 'blocked'))
      if (!clashingStay(candidate.number, arrival, departure, reservations)) room = candidate.number
    }

    reservations.push({
      id: `R-${n++}`,
      guest: name(),
      roomType: type,
      room,
      arrival,
      departure,
      status: 'booked',
      source: pick(futureSources),
      total,
      paid: rand() < 0.35 ? 0 : Math.round((total * 0.3) / 1000) * 1000,
    })
  }

  return { rooms, reservations }
}