// Starting data for the demo hotels: the concierge knowledge base and the outlet and folio journal.
// Times are written relative to today so the demo never goes stale.
import { PAST, TODAY, YESTERDAY } from '../../data/sample'
import type { Actor } from '../types'
import type { JournalEntry, KbArticle } from './automationTypes'

const SYSTEM: Actor = { id: 'system', name: 'Gastora set-up' }

type Seed = Omit<KbArticle, 'id' | 'propertyId' | 'updatedAt' | 'updatedBy' | 'active'>

function wifiName(propertyId: string) {
  return propertyId === 't1' ? 'Lakeview-Guest' : propertyId === 't3' ? 'Savannah-Guest' : 'Hotel-Guest'
}

function seeds(propertyId: string): Seed[] {
  const large = propertyId === 't1'
  return [
    {
      topic: 'Wi-Fi',
      question: 'What is the Wi-Fi password?',
      answer: `Join the network "${wifiName(propertyId)}". The password is on the card in your room; the desk can read it to you too. It is free for the whole stay.`,
      keywords: ['wifi', 'wi-fi', 'internet', 'password', 'network', 'online'],
      category: 'faq',
    },
    {
      topic: 'Breakfast hours',
      question: 'When is breakfast served?',
      answer: large
        ? 'Breakfast is served in the Lakeside Restaurant from 06:30 to 10:30 every day, 07:00 to 11:00 on Sundays.'
        : 'Breakfast is served in the dining room from 07:00 to 10:00 every day.',
      keywords: ['breakfast', 'morning meal', 'buffet'],
      category: 'faq',
    },
    {
      topic: 'Check-out time',
      question: 'What time is check-out?',
      answer: 'Check-out is by {checkOutTime}. Leaving later is free until {lateFreeUntil} when the room is not needed; ask here and we will check.',
      keywords: ['check-out', 'checkout', 'check out', 'leave', 'leaving', 'departure'],
      category: 'faq',
    },
    {
      topic: 'Check-in time',
      question: 'What time can I check in?',
      answer: 'Rooms are ready from {checkInTime}. If you arrive earlier we keep your bags and give you the room as soon as it is clean.',
      keywords: ['check-in', 'checkin', 'check in', 'arrive', 'arrival', 'early'],
      category: 'faq',
    },
    {
      topic: 'Airport transfer',
      question: 'Do you have an airport transfer?',
      answer: large
        ? 'Yes. A driver meets you at Entebbe with your name on a board. It costs UGX 180,000 each way and takes about an hour; book at least 6 hours ahead.'
        : 'Yes, for UGX 150,000 each way to or from Entebbe. Please book a day ahead.',
      keywords: ['airport', 'entebbe', 'transfer', 'pickup', 'pick-up', 'flight', 'shuttle'],
      category: 'faq',
    },
    {
      topic: 'Book an airport transfer',
      question: 'Please book me an airport transfer',
      answer: 'I have asked the desk to book your airport transfer. They will confirm the time and price here.',
      keywords: ['airport', 'entebbe', 'transfer', 'pickup', 'flight', 'driver'],
      category: 'request',
      requestTitle: 'Airport transfer',
    },
    {
      topic: 'Spa',
      question: 'Is there a spa?',
      answer: large
        ? 'The spa is open 09:00 to 20:00. A full-body massage is UGX 120,000 for 60 minutes. You can book a time on this page under Dining, spa and activities.'
        : 'We have a massage room open 10:00 to 18:00. A 60-minute massage is UGX 90,000; ask here to book.',
      keywords: ['spa', 'massage', 'sauna', 'steam', 'treatment', 'facial'],
      category: 'faq',
    },
    {
      topic: 'Restaurant and bar',
      question: 'When is the restaurant open?',
      answer: 'The restaurant serves lunch 12:30 to 15:00 and dinner 18:30 to 22:30. The bar is open until midnight. Room service runs until 23:00.',
      keywords: ['restaurant', 'dinner', 'lunch', 'bar', 'room service', 'food', 'menu'],
      category: 'faq',
    },
    {
      topic: 'Swimming pool',
      question: 'When is the pool open?',
      answer: large ? 'The pool is open 07:00 to 19:00. Towels are at the pool bar.' : 'We do not have a pool, sorry.',
      keywords: ['pool', 'swim', 'swimming', 'gym', 'fitness'],
      category: 'faq',
    },
    {
      topic: 'Parking',
      question: 'Is there parking?',
      answer: 'Parking is free and guarded day and night. Leave your keys at the desk if the car may need moving.',
      keywords: ['parking', 'park', 'car', 'vehicle'],
      category: 'faq',
    },
    {
      topic: 'Extra towels or pillows',
      question: 'Can I get extra towels?',
      answer: 'Of course. Housekeeping will bring them to your room shortly.',
      keywords: ['towel', 'pillow', 'blanket', 'sheets', 'toiletries', 'soap', 'shampoo'],
      category: 'request',
      requestTitle: 'Extra towels or bedding',
    },
    {
      topic: 'Room cleaning',
      question: 'Please clean my room',
      answer: 'I have asked housekeeping to clean your room. Let us know here if a particular time suits you.',
      keywords: ['clean my room', 'cleaning', 'housekeeping', 'make up the room', 'tidy'],
      category: 'request',
      requestTitle: 'Room cleaning',
    },
    {
      topic: 'Taxi',
      question: 'Can you call me a taxi?',
      answer: 'I have asked the desk to arrange a taxi. They will confirm the time here.',
      keywords: ['taxi', 'cab', 'boda', 'uber', 'ride'],
      category: 'request',
      requestTitle: 'Taxi',
    },
    {
      topic: 'Late check-out',
      question: 'Can I have a late check-out?',
      answer: 'I have asked the desk for a late check-out. It is free until {lateFreeUntil} when the room is not needed; they will confirm here.',
      keywords: ['late check-out', 'late checkout', 'later check-out', 'stay longer', 'extend'],
      category: 'request',
      requestTitle: 'Late check-out',
    },
  ]
}

export function sampleKb(propertyId: string, at: string): KbArticle[] {
  return seeds(propertyId).map((s, i) => ({
    ...s,
    id: `KB-${propertyId}-${String(i + 1).padStart(2, '0')}`,
    propertyId,
    active: true,
    updatedAt: at,
    updatedBy: SYSTEM,
  }))
}

/** The outlet and folio journal for the demo hotels, with a few things worth a look in it. */
export function sampleJournal(propertyId: string): JournalEntry[] {
  if (propertyId === 't2') return []
  const y = YESTERDAY
  const d2 = PAST[0]
  const big = propertyId === 't1'
  const rows: Omit<JournalEntry, 'id'>[] = [
    { at: `${y} 23:12`, outlet: 'Bar', kind: 'void', user: 'Kevin Ocen', amount: 48000, reference: 'BAR-2281', note: 'Wrong item' },
    { at: `${y} 23:31`, outlet: 'Bar', kind: 'void', user: 'Kevin Ocen', amount: 36000, reference: 'BAR-2284', note: 'Guest changed mind' },
    { at: `${y} 23:47`, outlet: 'Bar', kind: 'void', user: 'Kevin Ocen', amount: 54000, reference: 'BAR-2286', note: '' },
    { at: `${y} 23:58`, outlet: 'Bar', kind: 'void', user: 'Kevin Ocen', amount: 42000, reference: 'BAR-2287', note: 'Wrong item' },
    { at: `${TODAY} 00:20`, outlet: 'Bar', kind: 'void', user: 'Kevin Ocen', amount: 34000, reference: 'BAR-2290', note: '' },
    { at: `${y} 13:05`, outlet: 'Restaurant', kind: 'void', user: 'Lydia Akello', amount: 25000, reference: 'RST-1180', note: 'Kitchen out of tilapia' },
    { at: `${y} 20:40`, outlet: 'Restaurant', kind: 'discount', user: 'Rita Auma', amount: 96000, percent: 40, reference: 'RST-1192', note: 'Friend of staff' },
    { at: `${y} 19:15`, outlet: 'Restaurant', kind: 'discount', user: 'Lydia Akello', amount: 12000, percent: 10, reference: 'RST-1188', note: 'Loyalty' },
    { at: `${y} 23:40`, outlet: 'Front desk', kind: 'refund', user: 'Rita Auma', amount: big ? 450000 : 260000, reference: 'FD-RF-031', note: 'Cash refund, guest left early' },
    { at: `${d2} 11:10`, outlet: 'Front desk', kind: 'refund', user: 'Vivian Achan', amount: 60000, reference: 'FD-RF-029', note: 'Double charge' },
    { at: `${d2} 21:30`, outlet: 'Minibar', kind: 'adjustment', user: 'Sarah Nanteza', amount: 18000, reference: 'MB-0412', note: 'Restock count' },
    { at: `${d2} 22:05`, outlet: 'Minibar', kind: 'adjustment', user: 'Sarah Nanteza', amount: 24000, reference: 'MB-0415', note: 'Restock count' },
    { at: `${y} 09:30`, outlet: 'Minibar', kind: 'adjustment', user: 'Mary Nabirye', amount: 21000, reference: 'MB-0420', note: '' },
    { at: `${TODAY} 02:14`, outlet: 'Minibar', kind: 'adjustment', user: 'Rita Auma', amount: big ? 380000 : 210000, reference: 'MB-0423', note: 'Correction' },
    { at: `${y} 21:50`, outlet: 'Restaurant', kind: 'open-check', user: 'Lydia Akello', amount: 142000, reference: 'Table 7', note: '' },
  ]
  return rows.map((r, i) => ({ ...r, id: `J-${propertyId}-${String(i + 1).padStart(3, '0')}` }))
}
