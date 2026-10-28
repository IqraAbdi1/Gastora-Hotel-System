// The hotel's own equipment: the generator, the lift, the boiler, the air conditioner in room 204.
// A defect is about a room; an asset is about a thing the hotel bought, which outlives the fault and
// the room it sits in. Everything engineering wants to know later - what keeps breaking, what it has
// cost, what is still under warranty - needs the thing itself on record first.
// Pure rules only: no React, no state.

export type AssetCategory =
  | 'Air conditioning'
  | 'Electrical'
  | 'Plumbing'
  | 'Kitchen'
  | 'Laundry'
  | 'Lift'
  | 'Generator'
  | 'Water'
  | 'Furniture'
  | 'Safety'
  | 'Other'

export const ASSET_CATEGORIES: AssetCategory[] = [
  'Air conditioning',
  'Electrical',
  'Plumbing',
  'Kitchen',
  'Laundry',
  'Lift',
  'Generator',
  'Water',
  'Furniture',
  'Safety',
  'Other',
]

/** Retired is still on the record; disposed means it has left the building. Neither can be worked on. */
export type AssetState = 'in service' | 'retired' | 'disposed'

export const ASSET_STATES: AssetState[] = ['in service', 'retired', 'disposed']

/** What a running-hours reading is counted in. Hours for engines, kilometres for the hotel van. */
export type MeterUnit = 'hours' | 'kilometres'

export type MeterReading = {
  /** The number on the dial, not the difference since last time. */
  reading: number
  takenOn: string
  takenBy: string
}

export type Asset = {
  id: string
  /** The number painted or stuck on the thing itself, which is how a technician finds it. */
  tag: string
  name: string
  category: AssetCategory
  /** A room number, or the name of a place: "Plant room", "Kitchen", "Roof". */
  where: string
  /** Set when `where` is a room, so downtime and repairs can be counted against that room. */
  room?: string
  make?: string
  model?: string
  serial?: string
  supplier?: string
  /** ISO date. Unknown for equipment that was already here when the hotel took the system on. */
  boughtOn?: string
  /** What it cost, in shillings. */
  cost?: number
  warrantyUntil?: string
  /** How many years the hotel expects to get out of it. Used for what it is worth today. */
  lifeYears?: number
  state: AssetState
  meterUnit?: MeterUnit
  /** Newest first. */
  readings?: MeterReading[]
  notes?: string
}

export const DEFAULT_LIFE_YEARS = 5

export const newAssetId = () => `A-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

/** A blank record to start from. Nothing about it is guessed except that it is in service. */
export function emptyAsset(): Asset {
  return { id: newAssetId(), tag: '', name: '', category: 'Other', where: '', state: 'in service' }
}

/** Days between two ISO dates, counted in UTC so a Kampala afternoon never lands a day early. */
export function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}

export type WarrantyState = 'none' | 'in warranty' | 'ending soon' | 'expired'

/** A repair on something still under warranty should be claimed, not paid for. That is the whole point. */
export const WARRANTY_SOON_DAYS = 60

export function warrantyOf(asset: Asset, today: string): WarrantyState {
  if (!asset.warrantyUntil) return 'none'
  const left = daysBetween(today, asset.warrantyUntil)
  if (left < 0) return 'expired'
  return left <= WARRANTY_SOON_DAYS ? 'ending soon' : 'in warranty'
}

export const WARRANTY_LABEL: Record<WarrantyState, string> = {
  none: 'Not recorded',
  'in warranty': 'Under warranty',
  'ending soon': 'Warranty ending',
  expired: 'Out of warranty',
}

/** Whole months old, or undefined when nobody recorded when it was bought. */
export function ageMonths(asset: Asset, today: string): number | undefined {
  if (!asset.boughtOn) return undefined
  return Math.max(0, Math.floor(daysBetween(asset.boughtOn, today) / 30.44))
}

export function ageWords(months: number | undefined): string {
  if (months === undefined) return 'Not recorded'
  if (months < 1) return 'New this month'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rest = months % 12
  return rest === 0 ? `${years} year${years === 1 ? '' : 's'}` : `${years}y ${rest}m`
}

/**
 * Rule: straight line. The cost is spread evenly over the years the hotel expects to use it, and it
 * stops at nothing. This is the simplest honest answer to "what is it worth now"; a real set of books
 * may use another method, and accounting owns that number, not engineering.
 */
export function bookValue(asset: Asset, today: string): number | undefined {
  if (asset.cost === undefined || !asset.boughtOn) return undefined
  const life = asset.lifeYears ?? DEFAULT_LIFE_YEARS
  if (life <= 0) return 0
  const used = daysBetween(asset.boughtOn, today) / 365.25
  const left = Math.max(0, 1 - used / life)
  return Math.round(asset.cost * left)
}

/** How much of its expected life has gone. Over 1 means it is working past what it was bought for. */
export function lifeUsed(asset: Asset, today: string): number | undefined {
  if (!asset.boughtOn) return undefined
  const life = asset.lifeYears ?? DEFAULT_LIFE_YEARS
  if (life <= 0) return undefined
  return daysBetween(asset.boughtOn, today) / 365.25 / life
}

/**
 * The latest number off the dial. Two readings taken on the same day are settled by the number itself:
 * a meter only goes up, so the larger one was taken later. Without that the answer depends on the order
 * they happen to sit in, and a service due at a reading could be judged from the earlier of the two.
 */
export function latestReading(asset: Asset): MeterReading | undefined {
  if (!asset.readings?.length) return undefined
  return [...asset.readings].sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.reading - a.reading)[0]
}

/**
 * A reading that is lower than the one before it is either a typo or a replaced meter. Either way the
 * hotel has to say which, because a service due at 500 hours cannot be judged from a dial that went
 * backwards. This refuses it rather than guessing.
 */
export function readingProblem(asset: Asset, reading: number, takenOn: string): string | null {
  if (!Number.isFinite(reading) || reading < 0) return 'A reading is a number of ' + (asset.meterUnit ?? 'hours') + '.'
  const last = latestReading(asset)
  if (!last) return null
  if (takenOn < last.takenOn) return `There is already a later reading, from ${last.takenOn}.`
  if (reading < last.reading) {
    return `The last reading was ${last.reading.toLocaleString('en-US')}. A meter does not go backwards; if it was replaced, record the asset as replaced.`
  }
  return null
}

/** Use since the reading before last, which is what a service interval is counted in. */
export function usePerDay(asset: Asset): number | undefined {
  const sorted = [...(asset.readings ?? [])].sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.reading - b.reading)
  if (sorted.length < 2) return undefined
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const days = daysBetween(first.takenOn, last.takenOn)
  if (days <= 0) return undefined
  return (last.reading - first.reading) / days
}

export function searchAssets(assets: Asset[], query: string): Asset[] {
  const q = query.trim().toLowerCase()
  if (!q) return assets
  return assets.filter((a) =>
    [a.tag, a.name, a.where, a.category, a.make, a.model, a.serial, a.supplier]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q)),
  )
}

/** Sorted the way an engineer reads a list: where it is, then what it is. */
export function sortAssets(assets: Asset[]): Asset[] {
  return [...assets].sort((a, b) => a.where.localeCompare(b.where, undefined, { numeric: true }) || a.name.localeCompare(b.name))
}

export type AssetProblem = 'tag' | 'name' | 'where' | 'duplicate tag' | 'warranty before purchase' | null

/** What stops an asset being saved. Named, so the screen can say which box is wrong. */
export function assetProblem(draft: Asset, all: Asset[]): AssetProblem {
  if (!draft.tag.trim()) return 'tag'
  if (!draft.name.trim()) return 'name'
  if (!draft.where.trim()) return 'where'
  const tag = draft.tag.trim().toLowerCase()
  if (all.some((a) => a.id !== draft.id && a.tag.trim().toLowerCase() === tag)) return 'duplicate tag'
  if (draft.boughtOn && draft.warrantyUntil && draft.warrantyUntil < draft.boughtOn) return 'warranty before purchase'
  return null
}

export const PROBLEM_TEXT: Record<Exclude<AssetProblem, null>, string> = {
  tag: 'Give it the number that is on the thing itself.',
  name: 'Say what it is.',
  where: 'Say where it is, so somebody can find it.',
  'duplicate tag': 'Another asset already carries that number.',
  'warranty before purchase': 'The warranty cannot end before the day it was bought.',
}

/** A hotel starts with these, then edits them. Every one of them is something a real hotel has. */
export function sampleAssets(today: string): Asset[] {
  const back = (years: number, months = 0) => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCFullYear(d.getUTCFullYear() - years)
    d.setUTCMonth(d.getUTCMonth() - months)
    return d.toISOString().slice(0, 10)
  }
  const forward = (months: number) => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + months)
    return d.toISOString().slice(0, 10)
  }
  return [
    {
      id: 'A-gen-1',
      tag: 'GEN-01',
      name: 'Standby generator, 60 kVA',
      category: 'Generator',
      where: 'Plant room',
      make: 'Perkins',
      model: '1103A-33TG',
      serial: 'PK60-44821',
      supplier: 'Mantrac Uganda',
      boughtOn: back(3, 2),
      cost: 92000000,
      warrantyUntil: back(1, 2),
      lifeYears: 10,
      state: 'in service',
      meterUnit: 'hours',
      readings: [
        { reading: 2140, takenOn: back(0, 2), takenBy: 'Joseph' },
        { reading: 2306, takenOn: today, takenBy: 'Joseph' },
      ],
      notes: 'Runs on every power cut. Fuel polished yearly.',
    },
    {
      id: 'A-lift-1',
      tag: 'LFT-01',
      name: 'Passenger lift, 8 person',
      category: 'Lift',
      where: 'Main block',
      make: 'Schindler',
      model: '3300',
      serial: 'SCH-3300-7741',
      supplier: 'Schindler East Africa',
      boughtOn: back(6),
      cost: 148000000,
      lifeYears: 20,
      state: 'in service',
      notes: 'Service contract. Statutory inspection every six months.',
    },
    {
      id: 'A-boiler-1',
      tag: 'BLR-01',
      name: 'Hot water boiler',
      category: 'Plumbing',
      where: 'Plant room',
      make: 'Ariston',
      model: 'ARI-500',
      supplier: 'Hardware World',
      boughtOn: back(2, 4),
      cost: 14500000,
      warrantyUntil: forward(1),
      lifeYears: 8,
      state: 'in service',
    },
    {
      id: 'A-ac-204',
      tag: 'AC-204',
      name: 'Split air conditioner',
      category: 'Air conditioning',
      where: 'Room 204',
      room: '204',
      make: 'LG',
      model: 'S4-W18KL3AA',
      supplier: 'Hwan Sung',
      boughtOn: back(4, 6),
      cost: 3200000,
      lifeYears: 7,
      state: 'in service',
      notes: 'Gas topped up twice. Watch it.',
    },
    {
      id: 'A-ac-205',
      tag: 'AC-205',
      name: 'Split air conditioner',
      category: 'Air conditioning',
      where: 'Room 205',
      room: '205',
      make: 'LG',
      model: 'S4-W18KL3AA',
      supplier: 'Hwan Sung',
      boughtOn: back(1, 1),
      cost: 3450000,
      warrantyUntil: forward(11),
      lifeYears: 7,
      state: 'in service',
    },
    {
      id: 'A-pump-1',
      tag: 'PMP-01',
      name: 'Water booster pump',
      category: 'Water',
      where: 'Pump house',
      make: 'Grundfos',
      model: 'CM5-4',
      boughtOn: back(5, 3),
      cost: 6800000,
      lifeYears: 5,
      state: 'in service',
      notes: 'Past the years it was bought for. Replacement quoted.',
    },
    {
      id: 'A-washer-1',
      tag: 'LDY-01',
      name: 'Industrial washing machine, 25 kg',
      category: 'Laundry',
      where: 'Laundry',
      make: 'Girbau',
      model: 'HS-6023',
      supplier: 'Laundry Systems EA',
      boughtOn: back(2),
      cost: 41000000,
      warrantyUntil: forward(0),
      lifeYears: 10,
      state: 'in service',
      meterUnit: 'hours',
      readings: [{ reading: 3890, takenOn: today, takenBy: 'Ali' }],
    },
    {
      id: 'A-fridge-1',
      tag: 'KIT-03',
      name: 'Walk-in cold room',
      category: 'Kitchen',
      where: 'Kitchen',
      make: 'Foster',
      boughtOn: back(7),
      cost: 28000000,
      lifeYears: 12,
      state: 'in service',
    },
    {
      id: 'A-ext-1',
      tag: 'FIRE-01',
      name: 'Fire extinguishers, ground floor',
      category: 'Safety',
      where: 'Ground floor',
      boughtOn: back(1, 6),
      cost: 1800000,
      lifeYears: 5,
      state: 'in service',
      notes: 'Six units. Refilled yearly by law.',
    },
    {
      id: 'A-tv-301',
      tag: 'TV-301',
      name: 'Television, 43 inch',
      category: 'Furniture',
      where: 'Room 301',
      room: '301',
      make: 'Samsung',
      boughtOn: back(6, 2),
      cost: 1600000,
      lifeYears: 5,
      state: 'retired',
      notes: 'Replaced. Kept as a spare.',
    },
  ]
}
