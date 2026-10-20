import { TODAY } from '../../data/sample'
import { SEED_RECIPES } from '../../features/pos/recipeEngine'
import { EXTRA_RECIPES } from '../../features/pos/posSeed'
import { minutesOf as minutes, withinHours } from '../../features/pos/posRules'
import type { Actor } from '../types'
import type { PosService } from './posService'
import type {
  Check,
  Combo,
  CostDay,
  FloorArea,
  FolioControl,
  KdsStation,
  ModifierGroup,
  OutletType,
  PosMenu,
  PosOutlet,
  PosSnapshot,
  PosTable,
  SalesMix,
  StockTransfer,
  TableBooking,
  TableShape,
  UsageCount,
  WastageEntry,
} from './posTypes'

// In-memory POS data for the demo hotels. It lasts until the page is reloaded. Every hotel gets the
// outlets its size suggests: Mbale Town Inn a restaurant and a bar, Savannah Lodge four outlets,
// Lakeview Grand all six types.

const nowIso = () => new Date().toISOString()
const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
/** Small deterministic wobble, so the sample numbers look real but never change between reloads. */
const wobble = (seed: string) => {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return (h % 1000) / 1000
}

type OutletSeed = { name: string; type: OutletType; emoji: string; opensAt: string; closesAt: string; service: number; tables: boolean; folio: string }
const OUTLET_SEEDS: Record<string, OutletSeed> = {
  Restaurant: { name: 'Restaurant', type: 'restaurant', emoji: '🍽️', opensAt: '06:30', closesAt: '23:00', service: 10, tables: true, folio: 'Restaurant' },
  Bar: { name: 'Bar', type: 'bar', emoji: '🍸', opensAt: '11:00', closesAt: '01:00', service: 5, tables: true, folio: 'Restaurant' },
  'Room service': { name: 'Room service', type: 'roomService', emoji: '🛎️', opensAt: '00:00', closesAt: '00:00', service: 15, tables: false, folio: 'Restaurant' },
  Minibar: { name: 'Minibar', type: 'minibar', emoji: '🧊', opensAt: '00:00', closesAt: '00:00', service: 0, tables: false, folio: 'Minibar' },
  'Pool bar': { name: 'Pool bar', type: 'poolSpa', emoji: '🏊', opensAt: '08:00', closesAt: '19:00', service: 5, tables: true, folio: 'Spa' },
  'Gift shop': { name: 'Gift shop', type: 'retail', emoji: '🛍️', opensAt: '08:00', closesAt: '20:00', service: 0, tables: false, folio: 'Other' },
}
const OUTLETS_BY_PROPERTY: Record<string, string[]> = {
  t1: ['Restaurant', 'Bar', 'Room service', 'Minibar', 'Pool bar', 'Gift shop'],
  t3: ['Restaurant', 'Bar', 'Room service', 'Pool bar'],
  t2: ['Restaurant', 'Bar'],
}
const SCALE: Record<string, number> = { t1: 3, t3: 1.6, t2: 1 }
const WEEKLY_MIX: Record<string, number> = {
  m1: 60, m2: 48, m3: 30, m4: 36, m5: 25, d1: 50, d2: 90, d3: 110, d4: 30, d5: 70, d6: 120, d7: 45,
  rs1: 20, rs2: 26, rs3: 18, mb1: 40, mb2: 30, mb3: 22, mb4: 15, mb5: 12, pb1: 25, pb2: 18, pb3: 40, gs1: 6, gs2: 9, gs3: 5,
}
const PRODUCT_OUTLET: Record<string, string> = {
  m1: 'Restaurant', m2: 'Restaurant', m3: 'Restaurant', m4: 'Restaurant', m5: 'Restaurant', d1: 'Restaurant', d5: 'Restaurant',
  d2: 'Bar', d3: 'Bar', d4: 'Bar', d6: 'Bar', d7: 'Bar', rs1: 'Room service', rs2: 'Room service', rs3: 'Room service',
  mb1: 'Minibar', mb2: 'Minibar', mb3: 'Minibar', mb4: 'Minibar', mb5: 'Minibar', pb1: 'Pool bar', pb2: 'Pool bar', pb3: 'Pool bar',
  gs1: 'Gift shop', gs2: 'Gift shop', gs3: 'Gift shop',
}
const COST_BASE: Record<OutletType, { revenue: number; costPct: number }> = {
  restaurant: { revenue: 1_400_000, costPct: 31 },
  bar: { revenue: 950_000, costPct: 24 },
  roomService: { revenue: 520_000, costPct: 34 },
  minibar: { revenue: 210_000, costPct: 38 },
  poolSpa: { revenue: 380_000, costPct: 28 },
  retail: { revenue: 160_000, costPct: 55 },
}
const STOCK_INFO: Record<string, { name: string; unit: string; cost: number; at: 'Kitchen' | 'Bar' }> = {
  'fnb-chicken': { name: 'Chicken breast', unit: 'g', cost: 18, at: 'Kitchen' },
  'fnb-potato': { name: 'Potatoes', unit: 'g', cost: 3.5, at: 'Kitchen' },
  'fnb-beef': { name: 'Beef mince', unit: 'g', cost: 24, at: 'Kitchen' },
  'fnb-fish': { name: 'Fish fillet', unit: 'g', cost: 28, at: 'Kitchen' },
  'fnb-tomato': { name: 'Tomatoes', unit: 'g', cost: 7, at: 'Kitchen' },
  'fnb-beer': { name: 'House beer bottle', unit: 'bottle', cost: 3500, at: 'Bar' },
  'fnb-soda': { name: 'Soda bottle', unit: 'bottle', cost: 1800, at: 'Bar' },
  'fnb-juice-base': { name: 'Juice base', unit: 'ml', cost: 6, at: 'Bar' },
}

function seedProperty(pid: string): PosSnapshot {
  const names = OUTLETS_BY_PROPERTY[pid] ?? ['Restaurant', 'Bar']
  const scale = SCALE[pid] ?? 1
  const outlets: PosOutlet[] = names.map((name, i) => {
    const s = OUTLET_SEEDS[name]
    return {
      id: `${pid}-out-${i + 1}`,
      propertyId: pid,
      name: s.name,
      type: s.type,
      emoji: s.emoji,
      opensAt: s.opensAt,
      closesAt: s.closesAt,
      serviceChargePercent: pid === 't2' ? 0 : s.service,
      tipsEnabled: s.type !== 'minibar' && s.type !== 'retail',
      discountApprovalPercent: 15,
      folioCategory: s.folio,
      hasTables: s.tables,
      active: true,
      sortOrder: i,
    }
  })
  const byName = (n: string) => outlets.find((o) => o.name === n)

  const areas: FloorArea[] = []
  const tables: PosTable[] = []
  const addArea = (outlet: PosOutlet, name: string) => {
    const area = { id: `${outlet.id}-area-${areas.filter((a) => a.outletId === outlet.id).length + 1}`, propertyId: pid, outletId: outlet.id, name }
    areas.push(area)
    return area
  }
  const addTables = (outlet: PosOutlet, area: FloorArea, list: [string, number, TableShape, number, number][]) => {
    for (const [name, seats, shape, x, y] of list)
      tables.push({ id: `${outlet.id}-${name}`, propertyId: pid, outletId: outlet.id, areaId: area.id, name, seats, shape, x, y, status: 'free' })
  }
  const restaurant = byName('Restaurant')
  if (restaurant) {
    const hall = addArea(restaurant, 'Main hall')
    addTables(restaurant, hall, [
      ['T01', 2, 'square', 10, 15], ['T02', 2, 'square', 30, 15], ['T03', 4, 'round', 52, 15], ['T04', 4, 'round', 75, 15],
      ['T05', 4, 'square', 10, 55], ['T06', 6, 'long', 34, 55], ['T07', 4, 'round', 62, 55], ['T08', 8, 'long', 84, 55],
    ])
    if (pid !== 't2') {
      const terrace = addArea(restaurant, 'Terrace')
      addTables(restaurant, terrace, [['T09', 2, 'round', 12, 25], ['T10', 2, 'round', 38, 25], ['T11', 4, 'square', 64, 25], ['T12', 6, 'long', 86, 25]])
    }
  }
  const bar = byName('Bar')
  if (bar) {
    const lounge = addArea(bar, 'Lounge')
    addTables(bar, lounge, [['B1', 2, 'round', 12, 20], ['B2', 2, 'round', 36, 20], ['B3', 4, 'square', 60, 20], ['B4', 4, 'square', 84, 20], ['B5', 6, 'long', 30, 65], ['B6', 4, 'round', 70, 65]])
  }
  const pool = byName('Pool bar')
  if (pool) {
    const deck = addArea(pool, 'Pool deck')
    addTables(pool, deck, [['P1', 2, 'round', 15, 30], ['P2', 2, 'round', 40, 30], ['P3', 4, 'square', 65, 30], ['P4', 4, 'square', 88, 30]])
  }
  // A lunchtime picture on the larger hotels: guests seated, a bill asked, a table to clear.
  const set = (id: string, status: PosTable['status'], covers?: number) => {
    const t = tables.find((x) => x.id === id)
    if (t) Object.assign(t, { status, covers, seatedAt: covers ? nowIso() : undefined })
  }
  if (restaurant && pid !== 't2') {
    set(`${restaurant.id}-T02`, 'seated', 2)
    set(`${restaurant.id}-T06`, 'billAsked', 5)
    set(`${restaurant.id}-T07`, 'cleaning')
  }
  if (bar && pid === 't1') set(`${bar.id}-B3`, 'seated', 3)

  const bookings: TableBooking[] = []
  if (restaurant) {
    const list: [string, string, number, string, string?][] = [
      ['Grace Nakato', '12:30', 4, 'T03', 'Birthday, cake at 13:30'],
      ['Moses Kizza', '13:00', 2, 'T01'],
      ['Annet Atim', '19:30', 6, 'T08', 'Prefers the corner'],
      ['Ibrahim Ssali', '20:00', 2, ''],
    ]
    list.slice(0, pid === 't2' ? 2 : 4).forEach(([guestName, time, covers, table, notes], i) =>
      bookings.push({
        id: `${pid}-BK-${i + 1}`,
        propertyId: pid,
        outletId: restaurant.id,
        tableId: table ? tables.find((t) => t.outletId === restaurant.id && t.name === table)?.id : undefined,
        guestName,
        phone: `+256 77${i} 41${i} 2${i}${i}`,
        date: TODAY,
        time,
        covers,
        notes,
        status: 'booked',
        createdAt: nowIso(),
        createdBy: 'Rita Auma',
      }),
    )
  }

  const menus: PosMenu[] = outlets.map((o) => ({ id: `${o.id}-menu`, propertyId: pid, outletId: o.id, name: 'All day', active: true }))

  const group = (id: string, name: string, required: boolean, min: number, max: number, productIds: string[], mods: [string, number][]): ModifierGroup => ({
    id: `${pid}-${id}`,
    propertyId: pid,
    name,
    required,
    minSelect: min,
    maxSelect: max,
    productIds,
    modifiers: mods.map(([n, price], i) => ({ id: `${pid}-${id}-${i + 1}`, groupId: `${pid}-${id}`, name: n, price })),
  })
  const modifierGroups: ModifierGroup[] = [
    group('mg-side', 'Side', true, 1, 1, ['m1', 'm3'], [['Chips', 0], ['Matoke', 0], ['Rice', 0], ['Side salad', 1000]]),
    group('mg-done', 'Cooked', true, 1, 1, ['m2'], [['Medium', 0], ['Well done', 0]]),
    group('mg-extra', 'Extras', false, 0, 3, ['m2', 'rs1'], [['Extra cheese', 2000], ['Bacon', 3000], ['Avocado', 2500]]),
    group('mg-juice', 'Fruit', true, 1, 1, ['d1'], [['Passion', 0], ['Mango', 0], ['Pineapple', 0], ['Mixed', 1000]]),
    group('mg-coffee', 'Size and milk', false, 0, 2, ['d5'], [['Double shot', 3000], ['Oat milk', 1500]]),
  ]
  if (pid === 't2') modifierGroups.splice(2, 1)

  const combos: Combo[] = []
  const combo = (outletName: string, name: string, emoji: string, price: number, items: [string, number][]) => {
    const o = byName(outletName)
    if (!o) return
    const id = `${pid}-cb-${combos.length + 1}`
    combos.push({ id, propertyId: pid, outletId: o.id, name, emoji, price, active: true, items: items.map(([productId, qty], i) => ({ id: `${id}-${i + 1}`, comboId: id, productId, qty })) })
  }
  combo('Restaurant', 'Lunch deal: burger and juice', '🍔', 22000, [['m2', 1], ['d1', 1]])
  combo('Restaurant', 'Fish supper with salad', '🐟', 34000, [['m3', 1], ['m5', 1]])
  combo('Bar', 'Two beers and water', '🍺', 19000, [['d6', 2], ['d3', 1]])
  combo('Room service', 'Breakfast in bed', '🛎️', 38000, [['rs2', 1], ['rs3', 1]])
  combo('Pool bar', 'Poolside refresher', '🍉', 26000, [['pb1', 1], ['pb2', 1]])

  const stations: KdsStation[] = pid === 't2'
    ? [
        { id: `${pid}-st-1`, propertyId: pid, name: 'Kitchen', categories: ['Main dishes', 'Starters', 'All day', 'Breakfast', 'Snacks'], targetMinutes: 15 },
        { id: `${pid}-st-2`, propertyId: pid, name: 'Bar', categories: ['Soft drinks', 'Mocktails', 'Hot drinks', 'Beer', 'Wine', 'Smoothies'], targetMinutes: 5 },
      ]
    : [
        { id: `${pid}-st-1`, propertyId: pid, name: 'Hot kitchen', categories: ['Main dishes', 'All day', 'Breakfast'], targetMinutes: 15 },
        { id: `${pid}-st-2`, propertyId: pid, name: 'Cold and pastry', categories: ['Starters', 'Snacks', 'Desserts'], targetMinutes: 8 },
        { id: `${pid}-st-3`, propertyId: pid, name: 'Bar', categories: ['Soft drinks', 'Mocktails', 'Hot drinks', 'Beer', 'Wine', 'Smoothies'], targetMinutes: 5 },
      ]

  // The front desk's rules on three in-house stays, so the cashier meets each kind of refusal.
  const folioControls: FolioControl[] = [
    { reservationId: 'R-1041', propertyId: pid, postingAllowed: false, reason: 'Cash only: no card or deposit on file' },
    { reservationId: 'R-1052', propertyId: pid, postingAllowed: true, creditLimit: 400_000 },
  ]

  const salesMix: SalesMix[] = Object.entries(WEEKLY_MIX)
    .filter(([productId]) => names.includes(PRODUCT_OUTLET[productId]))
    .map(([productId, qty]) => ({ propertyId: pid, productId, qty: Math.round(qty * scale) }))

  const costDays: CostDay[] = []
  for (const o of outlets) {
    const base = COST_BASE[o.type]
    for (let d = 13; d >= 1; d--) {
      const date = addDays(TODAY, -d)
      const w = wobble(`${pid}${o.id}${date}`)
      const revenue = Math.round((base.revenue * scale * (0.75 + w * 0.5)) / 1000) * 1000
      const pct = base.costPct + (w - 0.5) * 6 + (d < 5 && o.type === 'restaurant' ? 2.5 : 0)
      costDays.push({ propertyId: pid, outletId: o.id, date, revenue, cost: Math.round((revenue * pct) / 100) })
    }
  }

  const wastage: WastageEntry[] = []
  const transfers: StockTransfer[] = []
  const counts: UsageCount[] = []
  if (restaurant) {
    const waste = (stockItemId: string, qty: number, reason: WastageEntry['reason'], daysAgo: number, outlet: PosOutlet, note?: string) => {
      const info = STOCK_INFO[stockItemId]
      wastage.push({
        id: `${pid}-W-${wastage.length + 1}`, propertyId: pid, outletId: outlet.id, stockItemId, itemName: info.name, qty, unit: info.unit, reason,
        cost: Math.round(qty * info.cost), note, at: `${addDays(TODAY, -daysAgo)}T15:2${daysAgo}:00`, by: 'Kevin Ocen',
      })
    }
    waste('fnb-chicken', Math.round(900 * scale), 'Overproduction', 1, restaurant, 'Buffet leftovers')
    waste('fnb-tomato', Math.round(600 * scale), 'Spoiled', 2, restaurant)
    waste('fnb-fish', Math.round(360 * scale), 'Returned by guest', 3, restaurant, 'Overcooked')
    if (bar) waste('fnb-beer', 2, 'Dropped', 2, bar)

    const transfer = (outlet: PosOutlet, to: 'Kitchen' | 'Bar', lines: [string, number][], daysAgo: number) => {
      const list = lines.map(([stockItemId, qty]) => {
        const info = STOCK_INFO[stockItemId]
        return { stockItemId, itemName: info.name, qty: Math.round(qty * scale), unit: info.unit, unitCost: info.cost }
      })
      transfers.push({
        id: `${pid}-TR-${transfers.length + 1}`, propertyId: pid, outletId: outlet.id, toLocation: to, lines: list,
        value: Math.round(list.reduce((s, l) => s + l.qty * l.unitCost, 0)), at: `${addDays(TODAY, -daysAgo)}T08:1${daysAgo}:00`, by: 'Peter Mugisha',
      })
    }
    transfer(restaurant, 'Kitchen', [['fnb-chicken', 8000], ['fnb-potato', 10000], ['fnb-beef', 5000]], 5)
    transfer(restaurant, 'Kitchen', [['fnb-fish', 4000], ['fnb-tomato', 2500]], 3)
    if (bar) transfer(bar, 'Bar', [['fnb-beer', 60], ['fnb-soda', 48], ['fnb-juice-base', 3000]], 4)

    // Counts that leave a believable gap between what the recipes say was used and what went.
    const recipes = { ...SEED_RECIPES, ...EXTRA_RECIPES }
    const theoretical = new Map<string, number>()
    for (const mix of salesMix)
      for (const line of recipes[mix.productId] ?? []) {
        const gross = line.qty / ((line.yieldPercent ?? 100) / 100) / (1 - (line.wastePercent ?? 0) / 100)
        theoretical.set(line.stockId, (theoretical.get(line.stockId) ?? 0) + gross * mix.qty)
      }
    for (const [stockItemId, used] of theoretical) {
      const factor = 1.01 + wobble(`${pid}${stockItemId}`) * 0.11
      const actual = used * factor + wastage.filter((w) => w.stockItemId === stockItemId).reduce((s, w) => s + w.qty, 0)
      const transferred = transfers.flatMap((t) => t.lines).filter((l) => l.stockItemId === stockItemId).reduce((s, l) => s + l.qty, 0)
      const closing = Math.round(actual * 0.35)
      counts.push({
        propertyId: pid, stockItemId, opening: Math.max(0, Math.round(closing + actual - transferred)), closing,
        countedAt: `${addDays(TODAY, -1)}T22:00:00`, countedBy: 'Esther Nambi',
      })
    }
  }

  return {
    outlets, areas, tables, bookings, menus, modifierGroups, combos, stations,
    checks: [], checkPayments: [], postings: [], discounts: [], folioControls,
    wastage, transfers, counts, costDays, salesMix,
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function createMockPosService(): PosService {
  const data = new Map<string, PosSnapshot>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  let counter = 0
  const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36).slice(-4).toUpperCase()}${(counter += 1)}`

  const of = (pid: string) => {
    let snap = data.get(pid)
    if (!snap) {
      snap = seedProperty(pid)
      data.set(pid, snap)
    }
    return snap
  }
  const fail = (message: string) => Promise.reject(new Error(message))
  const done = <T>(value: T) => {
    emit()
    return Promise.resolve(value)
  }
  const table = (pid: string, id: string) => of(pid).tables.find((t) => t.id === id)
  const patchTable = (pid: string, id: string, patch: Partial<PosTable>, actor: Actor) => {
    const snap = of(pid)
    snap.tables = snap.tables.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso(), updatedBy: actor.name } : t))
    return snap.tables.find((t) => t.id === id) as PosTable
  }

  return {
    snapshot: (pid) => Promise.resolve(structuredClone(of(pid))),

    saveOutlet(pid, input, _actor, id) {
      const snap = of(pid)
      const name = input.name.trim()
      if (!name) return fail('An outlet needs a name')
      if (snap.outlets.some((o) => o.id !== id && o.name.toLowerCase() === name.toLowerCase())) return fail(`There is already an outlet called ${name}`)
      if (!TIME.test(input.opensAt) || !TIME.test(input.closesAt)) return fail('Opening hours must be times such as 07:00')
      if (!(input.serviceChargePercent >= 0 && input.serviceChargePercent <= 25)) return fail('Service charge must be between 0 and 25%')
      if (!(input.discountApprovalPercent >= 0 && input.discountApprovalPercent <= 100)) return fail('The discount limit must be between 0 and 100%')
      if (id) {
        const found = snap.outlets.find((o) => o.id === id)
        if (!found) return fail('Outlet not found')
        // The name is the key on menu items and sales, so it never changes after creation.
        const next = { ...found, ...input, name: found.name }
        snap.outlets = snap.outlets.map((o) => (o.id === id ? next : o))
        return done(next)
      }
      const outlet: PosOutlet = { ...input, name, id: nextId(`${pid}-out`), propertyId: pid, sortOrder: snap.outlets.length }
      snap.outlets = [...snap.outlets, outlet]
      snap.menus = [...snap.menus, { id: `${outlet.id}-menu`, propertyId: pid, outletId: outlet.id, name: 'All day', active: true }]
      if (outlet.hasTables) snap.areas = [...snap.areas, { id: `${outlet.id}-area-1`, propertyId: pid, outletId: outlet.id, name: 'Main area' }]
      return done(outlet)
    },

    addTable(pid, input, actor) {
      const snap = of(pid)
      const name = input.name.trim()
      if (!name) return fail('A table needs a name')
      if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 20) return fail('Seats must be between 1 and 20')
      if (snap.tables.some((t) => t.outletId === input.outletId && t.name.toLowerCase() === name.toLowerCase())) return fail(`${name} already exists in this outlet`)
      if (!snap.areas.some((a) => a.id === input.areaId && a.outletId === input.outletId)) return fail('Choose an area of this outlet')
      const inArea = snap.tables.filter((t) => t.areaId === input.areaId).length
      const t: PosTable = {
        ...input, name, id: nextId(`${pid}-tb`), propertyId: pid,
        x: 10 + (inArea % 4) * 25, y: inArea < 4 ? 20 : 65, status: 'free', updatedAt: nowIso(), updatedBy: actor.name,
      }
      snap.tables = [...snap.tables, t]
      return done(t)
    },

    setTableStatus(pid, id, status, actor, covers) {
      const t = table(pid, id)
      if (!t) return fail('Table not found')
      if (t.mergedInto) return fail(`${t.name} is joined to another table. Separate it first.`)
      if (status === 'seated') {
        const max = t.seats + of(pid).tables.filter((x) => x.mergedInto === id).reduce((s, x) => s + x.seats, 0)
        if (!covers || covers < 1) return fail('How many guests are sitting down?')
        if (covers > max) return fail(`${t.name} seats ${max}. Join another table for ${covers} guests.`)
        return done(patchTable(pid, id, { status, covers, seatedAt: t.seatedAt ?? nowIso() }, actor))
      }
      if (status === 'free') {
        const snap = of(pid)
        snap.tables = snap.tables.map((x) => (x.mergedInto === id ? { ...x, mergedInto: undefined, status: 'free' } : x))
        return done(patchTable(pid, id, { status, covers: undefined, seatedAt: undefined }, actor))
      }
      return done(patchTable(pid, id, { status }, actor))
    },

    moveTable(pid, fromId, toId, actor) {
      const from = table(pid, fromId)
      const to = table(pid, toId)
      if (!from || !to) return fail('Table not found')
      if (fromId === toId) return fail('Choose a different table')
      if (to.status !== 'free' || to.mergedInto) return fail(`${to.name} is not free`)
      patchTable(pid, toId, { status: from.status === 'free' || from.status === 'cleaning' ? 'seated' : from.status, covers: from.covers, seatedAt: from.seatedAt ?? nowIso() }, actor)
      patchTable(pid, fromId, { status: 'cleaning', covers: undefined, seatedAt: undefined }, actor)
      return done(table(pid, toId) as PosTable)
    },

    mergeTables(pid, mainId, otherId, actor) {
      const main = table(pid, mainId)
      const other = table(pid, otherId)
      if (!main || !other) return fail('Table not found')
      if (mainId === otherId) return fail('Choose a different table')
      if (main.outletId !== other.outletId) return fail('Tables must be in the same outlet')
      if (main.mergedInto || other.mergedInto) return fail('One of these tables is already joined')
      if (of(pid).tables.some((t) => t.mergedInto === otherId)) return fail(`Separate the tables joined to ${other.name} first`)
      patchTable(pid, otherId, { mergedInto: mainId, status: 'seated', covers: undefined }, actor)
      if (main.status === 'free') patchTable(pid, mainId, { status: 'seated', covers: main.covers ?? 1, seatedAt: nowIso() }, actor)
      return done(table(pid, mainId) as PosTable)
    },

    unmergeTable(pid, id, actor) {
      const t = table(pid, id)
      if (!t?.mergedInto) return fail('This table is not joined to another')
      return done(patchTable(pid, id, { mergedInto: undefined, status: 'cleaning' }, actor))
    },

    createBooking(pid, input, actor) {
      const snap = of(pid)
      const guestName = input.guestName.trim()
      if (!guestName) return fail('Whose booking is it?')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail('Choose a date')
      if (input.date < TODAY) return fail('A booking cannot be in the past')
      if (!TIME.test(input.time)) return fail('Choose a time such as 19:30')
      if (!Number.isInteger(input.covers) || input.covers < 1 || input.covers > 40) return fail('Covers must be between 1 and 40')
      const outlet = snap.outlets.find((o) => o.id === input.outletId)
      if (!outlet) return fail('Choose an outlet')
      if (!withinHours(outlet, input.time)) return fail(`${outlet.name} is open ${outlet.opensAt} to ${outlet.closesAt}`)
      if (input.tableId) {
        const t = snap.tables.find((x) => x.id === input.tableId)
        if (!t) return fail('Table not found')
        if (input.covers > t.seats) return fail(`${t.name} seats ${t.seats}. Choose a bigger table or join two.`)
        const clash = snap.bookings.find((b) => b.tableId === t.id && b.date === input.date && b.status === 'booked' && Math.abs(minutes(b.time) - minutes(input.time)) < 120)
        if (clash) return fail(`${t.name} is booked for ${clash.guestName} at ${clash.time}`)
      }
      const booking: TableBooking = { ...input, guestName, id: nextId(`${pid}-BK`), propertyId: pid, status: 'booked', createdAt: nowIso(), createdBy: actor.name }
      snap.bookings = [...snap.bookings, booking]
      return done(booking)
    },

    setBookingStatus(pid, id, status, actor) {
      const snap = of(pid)
      const b = snap.bookings.find((x) => x.id === id)
      if (!b) return fail('Booking not found')
      if (b.status !== 'booked') return fail('This booking is already closed')
      if (status === 'seated') {
        if (!b.tableId) return fail('Give the booking a table first')
        const t = table(pid, b.tableId)
        if (!t || t.status !== 'free') return fail(`${t?.name ?? 'The table'} is not free yet`)
        patchTable(pid, t.id, { status: 'seated', covers: b.covers, seatedAt: nowIso() }, actor)
      }
      snap.bookings = snap.bookings.map((x) => (x.id === id ? { ...x, status } : x))
      return done(snap.bookings.find((x) => x.id === id) as TableBooking)
    },

    saveModifierGroup(pid, input, _actor, id) {
      const snap = of(pid)
      if (!input.name.trim()) return fail('The group needs a name')
      const mods = input.modifiers.filter((m) => m.name.trim())
      if (!mods.length) return fail('Add at least one choice')
      if (mods.some((m) => !(m.price >= 0))) return fail('Add-on prices cannot be negative')
      const min = input.required ? Math.max(1, input.minSelect) : 0
      if (input.maxSelect < Math.max(1, min)) return fail('Most choices must be at least the fewest')
      if (min > mods.length) return fail('There are fewer choices than must be picked')
      const gid = id ?? nextId(`${pid}-mg`)
      const group: ModifierGroup = {
        ...input, name: input.name.trim(), minSelect: min, id: gid, propertyId: pid,
        modifiers: mods.map((m, i) => ({ id: `${gid}-${i + 1}`, groupId: gid, name: m.name.trim(), price: Math.round(m.price) })),
      }
      snap.modifierGroups = id ? snap.modifierGroups.map((g) => (g.id === id ? group : g)) : [...snap.modifierGroups, group]
      return done(undefined)
    },

    removeModifierGroup(pid, id) {
      const snap = of(pid)
      snap.modifierGroups = snap.modifierGroups.filter((g) => g.id !== id)
      return done(undefined)
    },

    saveCombo(pid, input, _actor, id) {
      const snap = of(pid)
      if (!input.name.trim()) return fail('The combo needs a name')
      if (!(input.price > 0)) return fail('The combo needs a price above zero')
      const items = input.items.filter((i) => i.productId && i.qty > 0)
      if (items.length < 2) return fail('A combo needs at least two items')
      const cid = id ?? nextId(`${pid}-cb`)
      const combo: Combo = { ...input, name: input.name.trim(), id: cid, propertyId: pid, items: items.map((i, n) => ({ id: `${cid}-${n + 1}`, comboId: cid, productId: i.productId, qty: Math.round(i.qty) })) }
      snap.combos = id ? snap.combos.map((c) => (c.id === id ? combo : c)) : [...snap.combos, combo]
      return done(undefined)
    },

    removeCombo(pid, id) {
      const snap = of(pid)
      snap.combos = snap.combos.filter((c) => c.id !== id)
      return done(undefined)
    },

    splitChecks(pid, orderId, inputs) {
      const snap = of(pid)
      if (!inputs.length) return fail('A split needs at least one check')
      if (inputs.some((c) => !(c.total > 0))) return fail('Every check must have something to pay')
      const kept = snap.checks.filter((c) => c.orderId !== orderId || c.status === 'paid')
      const created: Check[] = inputs.map((c) => ({ ...c, id: nextId(`${pid}-CHK`), propertyId: pid, status: 'open', createdAt: nowIso() }))
      snap.checks = [...kept, ...created]
      return done(created)
    },

    payCheck(pid, checkId, payment, actor) {
      const snap = of(pid)
      const check = snap.checks.find((c) => c.id === checkId)
      if (!check) return fail('Check not found')
      if (check.status !== 'open') return fail(`Check ${check.label} is already ${check.status}`)
      if (Math.round(payment.amount) !== Math.round(check.total)) return fail(`Check ${check.label} is for ${Math.round(check.total).toLocaleString('en-US')}`)
      if ((payment.method === 'Card' || payment.method === 'Mobile money') && !payment.reference?.trim()) return fail('Enter the transaction reference')
      if (payment.method === 'Room charge' && !payment.roomPostingId) return fail('A room charge needs its folio posting')
      const paid = { ...payment, id: nextId(`${pid}-PAY`), at: nowIso(), by: actor.name }
      snap.checkPayments = [...snap.checkPayments, paid]
      snap.checks = snap.checks.map((c) => (c.id === checkId ? { ...c, status: 'paid', paidAt: paid.at } : c))
      return done(paid)
    },

    voidOpenChecks(pid, orderId) {
      const snap = of(pid)
      snap.checks = snap.checks.filter((c) => c.orderId !== orderId || c.status !== 'open')
      return done(undefined)
    },

    recordPosting(pid, input, actor) {
      if (!(input.amount > 0)) return fail('Nothing to charge')
      if (!input.reservationId) return fail('Choose the guest')
      const posting = { ...input, id: nextId(`${pid}-RP`), propertyId: pid, postedAt: nowIso(), postedBy: actor.name }
      of(pid).postings = [posting, ...of(pid).postings]
      return done(posting)
    },

    recordDiscounts(pid, inputs, actor) {
      for (const d of inputs) if (!d.reason.trim()) return fail('Every discount needs a reason')
      of(pid).discounts = [...inputs.map((d) => ({ ...d, id: nextId(`${pid}-DSC`), propertyId: pid, appliedBy: actor.name, at: nowIso() })), ...of(pid).discounts]
      return done(undefined)
    },

    logWastage(pid, input, actor) {
      if (!input.stockItemId) return fail('Choose the stock item')
      if (!(input.qty > 0)) return fail('Quantity must be above zero')
      const entry = { ...input, id: nextId(`${pid}-W`), propertyId: pid, at: nowIso(), by: actor.name }
      of(pid).wastage = [entry, ...of(pid).wastage]
      return done(entry)
    },

    createTransfer(pid, input, actor) {
      if (!input.outletId) return fail('Choose the outlet')
      const lines = input.lines.filter((l) => l.stockItemId)
      if (!lines.length) return fail('Add at least one item')
      if (lines.some((l) => !(l.qty > 0))) return fail('Quantities must be above zero')
      const transfer: StockTransfer = {
        ...input, lines, id: nextId(`${pid}-TR`), propertyId: pid, at: nowIso(), by: actor.name,
        value: Math.round(lines.reduce((s, l) => s + l.qty * l.unitCost, 0)),
      }
      of(pid).transfers = [transfer, ...of(pid).transfers]
      return done(transfer)
    },

    recordCount(pid, stockItemId, closing, actor) {
      if (!(closing >= 0)) return fail('A count cannot be negative')
      const snap = of(pid)
      const found = snap.counts.find((c) => c.stockItemId === stockItemId)
      const entry: UsageCount = { propertyId: pid, stockItemId, opening: found?.opening ?? 0, closing, countedAt: nowIso(), countedBy: actor.name }
      snap.counts = found ? snap.counts.map((c) => (c.stockItemId === stockItemId ? entry : c)) : [...snap.counts, entry]
      return done(undefined)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
