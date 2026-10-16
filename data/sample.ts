import type { Reservation, Room } from '../types'

// Demo clock. Follows the real date (local time) so the demo never goes stale.
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()
export const TODAY = ymd(now)
// Sample dates are written as "days from today" so they move with the clock
const day = (offset: number) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))

export const rooms: Room[] = [
  { number: '101', type: 'Standard', status: 'clean' },
  { number: '102', type: 'Standard', status: 'occupied' },
  { number: '103', type: 'Standard', status: 'clean' },
  { number: '104', type: 'Standard', status: 'dirty' },
  { number: '105', type: 'Standard', status: 'clean' },
  { number: '201', type: 'Deluxe', status: 'clean' },
  { number: '202', type: 'Deluxe', status: 'clean' },
  { number: '203', type: 'Deluxe', status: 'occupied' },
  { number: '204', type: 'Deluxe', status: 'clean' },
  { number: '205', type: 'Deluxe', status: 'blocked' },
  { number: '301', type: 'Suite', status: 'clean' },
  { number: '302', type: 'Suite', status: 'clean' },
]

export const reservations: Reservation[] = [
  { id: 'R-1042', guest: 'Amina Nakato', roomType: 'Deluxe', room: null, arrival: day(0), departure: day(2), status: 'booked', total: 520000, paid: 156000, source: 'online' },
  { id: 'R-1044', guest: 'Grace Namukasa', roomType: 'Suite', room: null, arrival: day(0), departure: day(1), status: 'booked', total: 420000, paid: 126000, source: 'ota' },
  { id: 'R-1045', guest: 'Moses Kato', roomType: 'Standard', room: null, arrival: day(0), departure: day(3), status: 'booked', total: 540000, paid: 50000, source: 'phone' },
  { id: 'R-1043', guest: 'David Okello', roomType: 'Standard', room: '102', arrival: day(-2), departure: day(1), status: 'in-house', total: 624000, paid: 162000, source: 'walk-in' },
  { id: 'R-1041', guest: 'Peter Mugisha', roomType: 'Deluxe', room: '203', arrival: day(-1), departure: day(0), status: 'in-house', total: 380000, paid: 78000, source: 'front desk' },
  { id: 'R-1046', guest: 'Sarah Achieng', roomType: 'Deluxe', room: null, arrival: day(2), departure: day(5), status: 'booked', total: 540000, paid: 160000, source: 'online' },
  { id: 'R-1047', guest: 'John Ssemwogerere', roomType: 'Suite', room: '301', arrival: day(1), departure: day(3), status: 'booked', total: 700000, paid: 0, source: 'ota' },
  { id: 'R-1048', guest: 'Esther Auma', roomType: 'Standard', room: null, arrival: day(3), departure: day(6), status: 'booked', total: 450000, paid: 135000, source: 'phone' },
  { id: 'R-1049', guest: 'Brian Kigozi', roomType: 'Standard', room: null, arrival: day(2), departure: day(4), status: 'booked', total: 300000, paid: 0, source: 'front desk' },
]