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
  { id: 'R-1042', guest: 'Amina Nakato', roomType: 'Deluxe', room: null, arrival: TODAY, departure: '2026-10-09', status: 'booked', total: 520000, paid: 156000, source: 'online' },
  { id: 'R-1044', guest: 'Grace Namukasa', roomType: 'Suite', room: null, arrival: TODAY, departure: '2026-10-08', status: 'booked', total: 420000, paid: 126000, source: 'ota' },
  { id: 'R-1045', guest: 'Moses Kato', roomType: 'Standard', room: null, arrival: TODAY, departure: '2026-10-10', status: 'booked', total: 540000, paid: 50000, source: 'phone' },
  { id: 'R-1043', guest: 'David Okello', roomType: 'Standard', room: '102', arrival: '2026-10-05', departure: '2026-10-08', status: 'in-house', total: 624000, paid: 162000, source: 'walk-in' },
  { id: 'R-1041', guest: 'Peter Mugisha', roomType: 'Deluxe', room: '203', arrival: '2026-10-06', departure: TODAY, status: 'in-house', total: 380000, paid: 78000, source: 'front desk' },
  { id: 'R-1046', guest: 'Sarah Achieng', roomType: 'Deluxe', room: null, arrival: '2026-10-09', departure: '2026-10-12', status: 'booked', total: 540000, paid: 160000, source: 'online' },
  { id: 'R-1047', guest: 'John Ssemwogerere', roomType: 'Suite', room: '301', arrival: '2026-10-08', departure: '2026-10-10', status: 'booked', total: 700000, paid: 0, source: 'ota' },
  { id: 'R-1048', guest: 'Esther Auma', roomType: 'Standard', room: null, arrival: '2026-10-10', departure: '2026-10-13', status: 'booked', total: 450000, paid: 135000, source: 'phone' },
  { id: 'R-1049', guest: 'Brian Kigozi', roomType: 'Standard', room: null, arrival: '2026-10-09', departure: '2026-10-11', status: 'booked', total: 300000, paid: 0, source: 'front desk' },
]