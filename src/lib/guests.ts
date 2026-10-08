import type { Guest, Reservation } from '../types'

export type Match = { guest: Guest; reason: string; likely: boolean }

const digits = (s: string) => s.replace(/\D/g, '')
const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')

function distance(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

// "likely" = probably the same person (same phone, same or very similar name): show as a duplicate warning.
// Otherwise it is just a name that contains what was typed: show as a search result.
export function findMatches(guests: Guest[], name: string, phone: string, limit = 6): Match[] {
  const text = name.trim().toLowerCase()
  const n = tokens(name)
  const p = digits(phone).slice(-9)
  if (text.length < 2 && p.length < 9) return []

  const found: Match[] = []
  for (const g of guests) {
    const gn = tokens(g.name)
    if (p.length >= 9 && digits(g.phone).slice(-9) === p) found.push({ guest: g, reason: 'Same phone number', likely: true })
    else if (n !== '' && gn === n) found.push({ guest: g, reason: 'Same name', likely: true })
    else if (n.length >= 4 && distance(gn, n) <= 2) found.push({ guest: g, reason: 'Very similar name', likely: true })
    else if (text.length >= 2 && g.name.toLowerCase().includes(text)) found.push({ guest: g, reason: 'Name matches', likely: false })
    if (found.length >= 30) break
  }
  return found.sort((a, b) => Number(b.likely) - Number(a.likely)).slice(0, limit)
}

// For the 400-room test hotel, which has bookings but no guest list.
export function deriveGuests(reservations: Reservation[]): Guest[] {
  const seen = new Map<string, Guest>()
  for (const r of reservations) {
    if (seen.has(r.guest)) continue
    const i = seen.size
    seen.set(r.guest, { id: `G-${i + 1}`, name: r.guest, phone: `07${String(10000000 + i * 7919).slice(-8)}` })
  }
  return Array.from(seen.values())
}