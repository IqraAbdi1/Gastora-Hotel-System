import type { Reservation, Room } from '../types'

export const TODAY = '2026-10-07'

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
  { id: 'R-1042', guest: 'Amina Nakato', roomType: 'Deluxe', room: null, arrival: TODAY, departure: '2026-10-09', status: 'booked', total: 520000, paid: 156000 },
  { id: 'R-1044', guest: 'Grace Namukasa', roomType: 'Suite', room: null, arrival: TODAY, departure: '2026-10-08', status: 'booked', total: 420000, paid: 126000 },
  { id: 'R-1045', guest: 'Moses Kato', roomType: 'Standard', room: null, arrival: TODAY, departure: '2026-10-10', status: 'booked', total: 540000, paid: 50000 },
  { id: 'R-1043', guest: 'David Okello', roomType: 'Standard', room: '102', arrival: '2026-10-05', departure: '2026-10-08', status: 'in-house', total: 624000, paid: 162000 },
  { id: 'R-1041', guest: 'Peter Mugisha', roomType: 'Deluxe', room: '203', arrival: '2026-10-06', departure: TODAY, status: 'in-house', total: 380000, paid: 78000 },
]