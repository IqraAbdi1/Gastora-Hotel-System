import type { LostItem } from '../lib/lostFound'
import { TODAY } from './sample'

const day = (offset: number) => {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

// Sample items so the screens have something to show. A real hotel starts with an empty list.
export const lostItems: LostItem[] = [
  {
    id: 'LF-1001',
    description: 'Blue phone charger with a two-pin plug',
    category: 'Laptop or charger',
    foundIn: '102',
    foundWhere: 'Behind the bedside table',
    foundOn: day(-1),
    foundBy: 'Sarah Nanteza',
    storedAt: 'Housekeeping store',
    status: 'held',
  },
  {
    id: 'LF-1002',
    description: "Woman's silver watch, broken strap",
    category: 'Jewellery or watch',
    foundIn: '203',
    foundWhere: 'In the bathroom, on the sink',
    foundOn: day(-3),
    foundBy: 'Mary Nabirye',
    storedAt: 'Front desk safe',
    status: 'held',
    notes: 'Kept in the safe. A manager must approve before it is handed over.',
  },
  {
    id: 'LF-1003',
    description: 'Black umbrella',
    category: 'Other',
    foundIn: 'Restaurant',
    foundWhere: 'Under table 4',
    foundOn: day(-8),
    foundBy: 'Rita Auma',
    storedAt: 'Front desk store',
    status: 'returned',
    release: {
      at: `${day(-7)} 10:20`,
      name: 'Joseph Mukasa',
      idType: 'NIN',
      idNumber: 'CM900121ABCD',
      phone: '+256 772 110 220',
      releasedBy: 'Rita Auma',
    },
  },
]
