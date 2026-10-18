import type { Reservation, Room } from '../types'

// Demo clock. Follows the real date (local time) so the demo never goes stale.
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()
export const TODAY = ymd(now)
// Sample dates are written as "days from today" so they move with the clock
const day = (offset: number) => ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
export const YESTERDAY = day(-1)
/** The last few days, for records that were written before today. */
export const PAST = [day(-2), day(-4), day(-6)]

export const rooms: Room[] = [
  { number: '101', type: 'Standard', status: 'clean' },
  { number: '102', type: 'Standard', status: 'occupied' },
  { number: '103', type: 'Standard', status: 'clean' },
  { number: '104', type: 'Standard', status: 'dirty' },
  { number: '105', type: 'Standard', status: 'clean' },
  { number: '201', type: 'Deluxe', status: 'clean' },
  { number: '202', type: 'Deluxe', status: 'clean' },
  { number: '203', type: 'Deluxe', status: 'occupied' },
  { number: '204', type: 'Deluxe', status: 'occupied' },
  { number: '205', type: 'Deluxe', status: 'blocked' },
  { number: '301', type: 'Suite', status: 'clean' },
  { number: '302', type: 'Suite', status: 'clean' },
]

export const reservations: Reservation[] = [
  // Stays that are already finished. Loyalty counts completed stays only, so without these no guest
  // in the demo has a history and the recognition line can never appear.
  { id: 'R-0901', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '201', arrival: day(-210), departure: day(-203), status: 'checked-out', total: 1260000, paid: 1260000, source: 'online', checkedOutAt: `${day(-203)} 10:40` },
  { id: 'R-0902', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '202', arrival: day(-160), departure: day(-154), status: 'checked-out', total: 1080000, paid: 1080000, source: 'online', checkedOutAt: `${day(-154)} 09:55` },
  { id: 'R-0903', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Standard', room: '103', arrival: day(-120), departure: day(-115), status: 'checked-out', total: 750000, paid: 750000, source: 'phone', checkedOutAt: `${day(-115)} 11:05` },
  { id: 'R-0904', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '204', arrival: day(-70), departure: day(-65), status: 'checked-out', total: 900000, paid: 900000, source: 'online', checkedOutAt: `${day(-65)} 10:20` },
  { id: 'R-0905', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '201', arrival: day(-30), departure: day(-27), status: 'checked-out', total: 540000, paid: 540000, source: 'front desk', checkedOutAt: `${day(-27)} 10:15` },
  { id: 'R-0906', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: '101', arrival: day(-180), departure: day(-175), status: 'checked-out', total: 750000, paid: 750000, source: 'phone', checkedOutAt: `${day(-175)} 10:30` },
  { id: 'R-0907', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: '105', arrival: day(-100), departure: day(-95), status: 'checked-out', total: 750000, paid: 750000, source: 'phone', checkedOutAt: `${day(-95)} 10:50` },
  { id: 'R-0908', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: '103', arrival: day(-40), departure: day(-35), status: 'checked-out', total: 750000, paid: 750000, source: 'front desk', checkedOutAt: `${day(-35)} 11:10` },
  { id: 'R-0909', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '104', arrival: day(-150), departure: day(-148), status: 'checked-out', total: 300000, paid: 300000, source: 'walk-in', checkedOutAt: `${day(-148)} 10:05` },
  { id: 'R-0910', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '101', arrival: day(-90), departure: day(-88), status: 'checked-out', total: 300000, paid: 300000, source: 'walk-in', checkedOutAt: `${day(-88)} 10:45` },
  { id: 'R-0911', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '105', arrival: day(-20), departure: day(-18), status: 'checked-out', total: 300000, paid: 300000, source: 'front desk', checkedOutAt: `${day(-18)} 10:25` },

  { id: 'R-1042', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: null, arrival: day(0), departure: day(2), status: 'booked', total: 520000, paid: 156000, source: 'online' },
  { id: 'R-1044', guestId: 'G-2', guest: 'Grace Namukasa', roomType: 'Suite', room: null, arrival: day(0), departure: day(1), status: 'booked', total: 420000, paid: 126000, source: 'ota' },
  { id: 'R-1045', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: null, arrival: day(0), departure: day(3), status: 'booked', total: 540000, paid: 50000, source: 'phone' },
  { id: 'R-1043', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '102', arrival: day(-2), departure: day(1), status: 'in-house', total: 624000, paid: 162000, source: 'walk-in', guarantee: 'card' },
  { id: 'R-1052', guestId: 'G-10', guest: 'Ruth Nabirye', roomType: 'Deluxe', room: '204', arrival: day(-2), departure: day(0), status: 'in-house', total: 420000, paid: 126000, source: 'online', guarantee: 'card' },
  { id: 'R-1041', guestId: 'G-5', guest: 'Peter Mugisha', roomType: 'Deluxe', room: '203', arrival: day(-1), departure: day(0), status: 'in-house', total: 380000, paid: 78000, source: 'front desk' },
  { id: 'R-1046', guestId: 'G-6', guest: 'Sarah Achieng', roomType: 'Deluxe', room: null, arrival: day(2), departure: day(5), status: 'booked', total: 540000, paid: 160000, source: 'online' },
  { id: 'R-1047', guestId: 'G-7', guest: 'John Ssemwogerere', roomType: 'Suite', room: '301', arrival: day(1), departure: day(3), status: 'booked', total: 700000, paid: 0, source: 'ota' },
  { id: 'R-1048', guestId: 'G-8', guest: 'Esther Auma', roomType: 'Standard', room: null, arrival: day(3), departure: day(6), status: 'booked', total: 450000, paid: 135000, source: 'phone' },
  { id: 'R-1049', guestId: 'G-9', guest: 'Brian Kigozi', roomType: 'Standard', room: null, arrival: day(2), departure: day(4), status: 'booked', total: 300000, paid: 0, source: 'front desk' },
  // Arrives today with nothing holding it: no deposit, no card. The desk has to ring him.
  { id: 'R-1051', guestId: 'G-11', guest: 'Daniel Wasswa', roomType: 'Standard', room: null, arrival: day(0), departure: day(1), status: 'booked', total: 180000, paid: 0, source: 'phone', guarantee: 'none', details: { phone: '0772 455 677', idType: 'NIN', idNumber: 'CM900112345678', nationality: 'Ugandan', specialRequests: '' } },
]