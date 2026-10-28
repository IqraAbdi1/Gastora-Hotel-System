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

// Tags say what sets a room apart, so the assignment rules can match a guest's preferences to it.
export const rooms: Room[] = [
  { number: '101', type: 'Standard', status: 'clean', tags: ['Near the lift'] },
  { number: '102', type: 'Standard', status: 'occupied' },
  { number: '103', type: 'Standard', status: 'clean', tags: ['Near the lift'] },
  { number: '104', type: 'Standard', status: 'dirty' },
  { number: '105', type: 'Standard', status: 'clean', tags: ['Quiet'] },
  { number: '201', type: 'Deluxe', status: 'clean', tags: ['Lake view'] },
  { number: '202', type: 'Deluxe', status: 'clean', tags: ['Lake view', 'Quiet'] },
  { number: '203', type: 'Deluxe', status: 'occupied', tags: ['Lake view'] },
  { number: '204', type: 'Deluxe', status: 'occupied' },
  { number: '205', type: 'Deluxe', status: 'blocked' },
  { number: '301', type: 'Suite', status: 'clean', tags: ['Lake view', 'Balcony'] },
  { number: '302', type: 'Suite', status: 'clean', tags: ['Quiet'] },
]

export const reservations: Reservation[] = [
  // Stays that are already finished. Loyalty counts completed stays only, so without these no guest
  // in the demo has a history and the recognition line can never appear.
  { id: 'R-0901', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '201', bookedAt: day(-244), arrival: day(-210), departure: day(-203), status: 'checked-out', total: 1260000, paid: 1260000, source: 'online', checkedOutAt: `${day(-203)} 10:40` },
  { id: 'R-0902', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '202', bookedAt: day(-181), arrival: day(-160), departure: day(-154), status: 'checked-out', total: 1080000, paid: 1080000, source: 'online', checkedOutAt: `${day(-154)} 09:55` },
  { id: 'R-0903', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Standard', room: '103', bookedAt: day(-132), arrival: day(-120), departure: day(-115), status: 'checked-out', total: 750000, paid: 750000, source: 'phone', checkedOutAt: `${day(-115)} 11:05` },
  { id: 'R-0904', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '204', bookedAt: day(-110), arrival: day(-70), departure: day(-65), status: 'checked-out', total: 900000, paid: 900000, source: 'online', checkedOutAt: `${day(-65)} 10:20` },
  { id: 'R-0905', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: '201', bookedAt: day(-39), arrival: day(-30), departure: day(-27), status: 'checked-out', total: 540000, paid: 540000, source: 'front desk', checkedOutAt: `${day(-27)} 10:15` },
  { id: 'R-0906', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: '101', bookedAt: day(-197), arrival: day(-180), departure: day(-175), status: 'checked-out', total: 750000, paid: 750000, source: 'phone', checkedOutAt: `${day(-175)} 10:30` },
  { id: 'R-0907', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: '105', bookedAt: day(-126), arrival: day(-100), departure: day(-95), status: 'checked-out', total: 750000, paid: 750000, source: 'phone', checkedOutAt: `${day(-95)} 10:50` },
  { id: 'R-0908', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: '103', bookedAt: day(-46), arrival: day(-40), departure: day(-35), status: 'checked-out', total: 750000, paid: 750000, source: 'front desk', checkedOutAt: `${day(-35)} 11:10` },
  { id: 'R-0909', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '104', bookedAt: day(-150), arrival: day(-150), departure: day(-148), status: 'checked-out', total: 300000, paid: 300000, source: 'walk-in', checkedOutAt: `${day(-148)} 10:05` },
  { id: 'R-0910', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '101', bookedAt: day(-90), arrival: day(-90), departure: day(-88), status: 'checked-out', total: 300000, paid: 300000, source: 'walk-in', checkedOutAt: `${day(-88)} 10:45` },
  // Booked through travel agents: two finished stays that earned commission, one cancellation that earned none.
  { id: 'R-0912', guestId: 'G-8', guest: 'Esther Auma', roomType: 'Deluxe', room: '202', bookedAt: day(-75), arrival: day(-50), departure: day(-46), status: 'checked-out', total: 720000, paid: 720000, source: 'agent', agent: { id: 'AG-1', name: 'Pearl Horizon Safaris', commissionPercent: 10, collectsPayment: false }, checkedOutAt: `${day(-46)} 10:10` },
  { id: 'R-0913', guestId: 'G-6', guest: 'Sarah Achieng', roomType: 'Standard', room: '105', bookedAt: day(-40), arrival: day(-25), departure: day(-22), status: 'checked-out', total: 450000, paid: 450000, source: 'agent', agent: { id: 'AG-2', name: 'Kampala Travel Bureau', commissionPercent: 8, collectsPayment: true }, checkedOutAt: `${day(-22)} 11:00` },
  { id: 'R-0914', guestId: 'G-9', guest: 'Brian Kigozi', roomType: 'Suite', room: null, bookedAt: day(-30), arrival: day(-12), departure: day(-10), status: 'cancelled', total: 0, paid: 0, source: 'agent', agent: { id: 'AG-1', name: 'Pearl Horizon Safaris', commissionPercent: 10, collectsPayment: false } },
  { id: 'R-0911', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '105', bookedAt: day(-23), arrival: day(-20), departure: day(-18), status: 'checked-out', total: 300000, paid: 300000, source: 'front desk', checkedOutAt: `${day(-18)} 10:25` },

  { id: 'R-1042', guestId: 'G-1', guest: 'Amina Nakato', roomType: 'Deluxe', room: null, bookedAt: day(-23), arrival: day(0), departure: day(2), status: 'booked', total: 520000, paid: 156000, source: 'online' },
  { id: 'R-1044', guestId: 'G-2', guest: 'Grace Namukasa', roomType: 'Suite', room: null, bookedAt: day(-11), arrival: day(0), departure: day(1), status: 'booked', total: 420000, paid: 126000, source: 'ota', guarantee: 'card' },
  { id: 'R-1045', guestId: 'G-3', guest: 'Moses Kato', roomType: 'Standard', room: null, bookedAt: day(-5), arrival: day(0), departure: day(3), status: 'booked', total: 540000, paid: 50000, source: 'phone' },
  { id: 'R-1043', guestId: 'G-4', guest: 'David Okello', roomType: 'Standard', room: '102', bookedAt: day(-2), arrival: day(-2), departure: day(1), status: 'in-house', total: 624000, paid: 162000, source: 'walk-in', guarantee: 'card' },
  { id: 'R-1052', guestId: 'G-10', guest: 'Ruth Nabirye', roomType: 'Deluxe', room: '204', bookedAt: day(-18), arrival: day(-2), departure: day(0), status: 'in-house', total: 420000, paid: 126000, source: 'online', guarantee: 'card' },
  { id: 'R-1041', guestId: 'G-5', guest: 'Peter Mugisha', roomType: 'Deluxe', room: '203', bookedAt: day(-3), arrival: day(-1), departure: day(0), status: 'in-house', total: 380000, paid: 78000, source: 'front desk' },
  { id: 'R-1046', guestId: 'G-6', guest: 'Sarah Achieng', roomType: 'Deluxe', room: null, bookedAt: day(-6), arrival: day(2), departure: day(5), status: 'booked', total: 540000, paid: 160000, source: 'online' },
  { id: 'R-1047', guestId: 'G-7', guest: 'John Ssemwogerere', roomType: 'Suite', room: '301', bookedAt: day(-29), arrival: day(1), departure: day(3), status: 'booked', total: 700000, paid: 0, source: 'ota' },
  { id: 'R-1048', guestId: 'G-8', guest: 'Esther Auma', roomType: 'Standard', room: null, bookedAt: day(-1), arrival: day(3), departure: day(6), status: 'booked', total: 450000, paid: 135000, source: 'agent', agent: { id: 'AG-1', name: 'Pearl Horizon Safaris', commissionPercent: 10, collectsPayment: false } },
  { id: 'R-1049', guestId: 'G-9', guest: 'Brian Kigozi', roomType: 'Standard', room: null, bookedAt: day(1), arrival: day(2), departure: day(4), status: 'booked', total: 300000, paid: 0, source: 'front desk' },
  // A family in two rooms, booked together by the mother: one party, one bill.
  { id: 'R-1053', guestId: 'G-12', guest: 'Faith Tumusiime', roomType: 'Deluxe', room: null, bookedAt: day(-9), arrival: day(0), departure: day(2), status: 'booked', total: 360000, paid: 90000, source: 'phone', adults: 2, children: 0, party: { id: 'PTY-1053', booker: 'Faith Tumusiime', index: 1, of: 2, payerId: 'R-1053' } },
  { id: 'R-1054', guest: 'Isaac Tumusiime', roomType: 'Standard', room: null, bookedAt: day(-9), arrival: day(0), departure: day(2), status: 'booked', total: 300000, paid: 60000, source: 'phone', adults: 1, children: 2, party: { id: 'PTY-1053', booker: 'Faith Tumusiime', index: 2, of: 2, payerId: 'R-1053' }, routing: [{ id: 'RT-1', category: 'Everything', toReservationId: 'R-1053', toGuest: 'Faith Tumusiime', at: `${day(-9)} 11:20`, by: 'Rita Auma' }] },
  // Arrives today with nothing holding it: no deposit, no card. The desk has to ring him.
  { id: 'R-1051', guestId: 'G-11', guest: 'Daniel Wasswa', roomType: 'Standard', room: null, bookedAt: day(-2), arrival: day(0), departure: day(1), status: 'booked', total: 180000, paid: 0, source: 'phone', guarantee: 'none', details: { phone: '0772 455 677', idType: 'NIN', idNumber: 'CM900112345678', nationality: 'Ugandan', specialRequests: '' } },
]