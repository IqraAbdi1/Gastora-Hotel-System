// Sample events data for the demo hotels. Lakeview Grand (t1) has the full sales picture; Savannah
// Lodge (t3) has the simple diary and BEOs. Mbale Town Inn (t2, starter) has no events module.
// Dates are days from today so the demo never goes stale.
import { TODAY } from '../../data/sample'
import type {
  Beo,
  BeoItem,
  Contract,
  DepositSchedule,
  Equipment,
  EventBooking,
  EventCost,
  EventPackage,
  EventPayment,
  EventPosting,
  EventSession,
  EventsData,
  FunctionSpace,
  Lead,
  LeadStage,
  MasterAccount,
  PackageItem,
  Quote,
  QuoteLine,
  QuoteVersion,
  ResourceBooking,
  SetupStyle,
  SpaceSetup,
} from './eventsTypes'

export const day = (offset: number) => {
  const d = new Date(`${TODAY}T00:00:00`)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const at = (offset: number, time = '10:00') => new Date(`${day(offset)}T${time}:00`).toISOString()

const LYDIA = { id: 'u-sales', name: 'Lydia Akello' }
const ESTHER = { id: 'u-gm', name: 'Esther Nambi' }

export function emptyData(): EventsData {
  return {
    leads: [],
    spaces: [],
    setups: [],
    bookings: [],
    sessions: [],
    beos: [],
    beoItems: [],
    packages: [],
    packageItems: [],
    equipment: [],
    resourceBookings: [],
    quotes: [],
    quoteLines: [],
    quoteVersions: [],
    contracts: [],
    depositSchedules: [],
    payments: [],
    masterAccounts: [],
    postings: [],
    costs: [],
  }
}

function space(p: string, id: string, name: string, kind: FunctionSpace['kind'], areaSqm: number, half: number, full: number): FunctionSpace {
  return { id, propertyId: p, name, kind, areaSqm, hireRateHalfDay: half, hireRateFullDay: full, active: true }
}
function setups(p: string, spaceId: string, list: [SetupStyle, number][]): SpaceSetup[] {
  return list.map(([setup, capacity]) => ({ id: `${spaceId}-${setup}`, propertyId: p, spaceId, setup, capacity }))
}
function pkg(p: string, id: string, name: string, kind: EventPackage['kind'], price: number, cost: number, items: [PackageItem['category'], string][]) {
  const made: EventPackage = { id, propertyId: p, name, kind, pricePerHead: price, costPerHead: cost, active: true }
  const lines: PackageItem[] = items.map(([category, description], i) => ({ id: `${id}-${i + 1}`, propertyId: p, packageId: id, category, description }))
  return { made, lines }
}
function equip(p: string, id: string, name: string, category: Equipment['category'], qty: number, rate: number, cost: number): Equipment {
  return { id, propertyId: p, name, category, quantityOwned: qty, dailyRate: rate, dailyCost: cost }
}
function history(stages: LeadStage[], fromDay: number, by: string) {
  return stages.map((stage, i) => ({ stage, at: at(fromDay + i * 3), by }))
}

export function sampleData(): EventsData {
  const d = emptyData()
  const T1 = 't1'
  const T3 = 't3'

  // ---- Lakeview Grand: spaces, packages, equipment ----
  d.spaces.push(
    space(T1, 'SP-VIC', 'Victoria Hall', 'hall', 600, 1_800_000, 3_000_000),
    space(T1, 'SP-NILE', 'Nile Suite', 'hall', 250, 900_000, 1_500_000),
    space(T1, 'SP-KIG', 'Kigezi Boardroom', 'boardroom', 60, 300_000, 500_000),
    space(T1, 'SP-SSE', 'Ssese Boardroom', 'boardroom', 45, 250_000, 400_000),
    space(T1, 'SP-GDN', 'Lakeside Garden', 'garden', 1200, 1_500_000, 2_500_000),
  )
  d.setups.push(
    ...setups(T1, 'SP-VIC', [['theatre', 400], ['classroom', 220], ['banquet', 300], ['cocktail', 450]]),
    ...setups(T1, 'SP-NILE', [['theatre', 150], ['classroom', 80], ['banquet', 120], ['u-shape', 50]]),
    ...setups(T1, 'SP-KIG', [['boardroom', 18], ['u-shape', 16]]),
    ...setups(T1, 'SP-SSE', [['boardroom', 12], ['u-shape', 14]]),
    ...setups(T1, 'SP-GDN', [['banquet', 250], ['cocktail', 400], ['theatre', 300]]),
  )
  const packs = [
    pkg(T1, 'PK-FDD', 'Full day delegate', 'day-delegate', 85_000, 38_000, [
      ['food', 'Morning tea with snacks'],
      ['food', 'Buffet lunch'],
      ['food', 'Afternoon tea'],
      ['beverage', 'Mineral water all day'],
      ['equipment', 'Projector, screen and flip chart'],
    ]),
    pkg(T1, 'PK-HDD', 'Half day delegate', 'half-day', 60_000, 26_000, [
      ['food', 'One tea break'],
      ['food', 'Buffet lunch'],
      ['beverage', 'Mineral water'],
    ]),
    pkg(T1, 'PK-WED', 'Wedding buffet (gold)', 'wedding', 120_000, 55_000, [
      ['food', 'Three-course buffet with local and continental dishes'],
      ['beverage', 'Two soft drinks per guest'],
      ['other', 'Cake table and high table dressing'],
    ]),
    pkg(T1, 'PK-CKT', 'Cocktail reception', 'cocktail', 45_000, 20_000, [
      ['food', 'Six canapés per guest'],
      ['beverage', 'Welcome drink'],
    ]),
    pkg(T1, 'PK-LUN', 'Working lunch', 'menu', 35_000, 15_000, [['food', 'Plated lunch with juice']]),
  ]
  for (const p of packs) {
    d.packages.push(p.made)
    d.packageItems.push(...p.lines)
  }
  d.equipment.push(
    equip(T1, 'EQ-PROJ', 'Projector and screen', 'av', 6, 150_000, 20_000),
    equip(T1, 'EQ-PA', 'PA system', 'av', 3, 250_000, 40_000),
    equip(T1, 'EQ-MIC', 'Wireless microphone', 'av', 12, 30_000, 5_000),
    equip(T1, 'EQ-STG', 'Stage platform', 'furniture', 2, 400_000, 60_000),
    equip(T1, 'EQ-FLIP', 'Flip chart', 'furniture', 10, 15_000, 2_000),
    equip(T1, 'EQ-DEC', 'Decor set', 'decor', 4, 600_000, 250_000),
    equip(T1, 'EQ-WAIT', 'Waiting staff', 'staff', 20, 60_000, 40_000),
    equip(T1, 'EQ-AVT', 'AV technician', 'staff', 3, 150_000, 90_000),
    equip(T1, 'EQ-CAPT', 'Banquet captain', 'staff', 2, 120_000, 80_000),
  )

  // ---- Lakeview Grand: leads ----
  const lead = (l: Omit<Lead, 'propertyId' | 'stageHistory' | 'createdAt' | 'createdBy' | 'updatedAt'>, stages: LeadStage[], from: number): Lead => ({
    ...l,
    propertyId: T1,
    stageHistory: history(stages, from, l.ownerName),
    createdAt: at(from),
    createdBy: l.ownerName,
    updatedAt: at(from + (stages.length - 1) * 3),
  })
  const base = { ownerId: LYDIA.id, ownerName: LYDIA.name, contactEmail: undefined, notes: undefined }
  d.leads.push(
    lead({ ...base, id: 'LD-101', title: 'Equator Health annual review', eventType: 'conference', stage: 'definite', companyId: 'CA-002', clientName: 'Equator Health Partners', contactName: 'Dr Ruth Namubiru', contactPhone: '0772 400 201', eventDate: day(12), endDate: day(13), expectedGuests: 180, estimatedValue: 46_000_000, probability: 100, source: 'Repeat client', eventBookingId: 'EV-201' }, ['enquiry', 'proposal', 'tentative', 'definite'], -40),
    lead({ ...base, id: 'LD-102', title: 'Nakato and Ssali wedding', eventType: 'wedding', stage: 'tentative', clientName: 'Nakato family', contactName: 'Agnes Nakato', contactPhone: '0701 555 120', eventDate: day(26), endDate: day(26), expectedGuests: 250, estimatedValue: 38_000_000, probability: 70, source: 'Walk-in', eventBookingId: 'EV-202' }, ['enquiry', 'proposal', 'tentative'], -30),
    lead({ ...base, id: 'LD-103', title: 'Lakeside Logistics board meeting', eventType: 'meeting', stage: 'definite', companyId: 'CA-001', clientName: 'Lakeside Logistics Ltd', contactName: 'Joan Akello', contactPhone: '0772 300 101', eventDate: day(3), endDate: day(3), expectedGuests: 14, estimatedValue: 3_200_000, probability: 100, source: 'Corporate account', eventBookingId: 'EV-203' }, ['enquiry', 'definite'], -12),
    lead({ ...base, id: 'LD-104', title: "Pearl Agro dealers' dinner", eventType: 'corporate', stage: 'proposal', companyId: 'CA-003', clientName: 'Pearl Agro Traders', contactName: 'Fred Kiwanuka', contactPhone: '0772 500 301', eventDate: day(40), endDate: day(40), expectedGuests: 150, estimatedValue: 18_500_000, probability: 40, source: 'Phone' }, ['enquiry', 'proposal'], -9),
    lead({ ...base, ownerId: ESTHER.id, ownerName: ESTHER.name, id: 'LD-105', title: 'Rwenzori Consulting strategy retreat', eventType: 'meeting', stage: 'enquiry', companyId: 'CA-004', clientName: 'Rwenzori Consulting Group', contactName: 'Agnes Tumusiime', contactPhone: '0772 600 401', eventDate: day(55), endDate: day(56), expectedGuests: 30, estimatedValue: 9_000_000, probability: 20, source: 'Email' }, ['enquiry'], -2),
    lead({ ...base, id: 'LD-106', title: 'Namirembe youth conference', eventType: 'conference', stage: 'enquiry', clientName: 'Namirembe Diocese', contactName: 'Rev. Peter Lubega', contactPhone: '0752 410 330', eventDate: day(70), endDate: day(72), expectedGuests: 300, estimatedValue: 25_000_000, probability: 20, source: 'Website' }, ['enquiry'], -4),
    lead({ ...base, id: 'LD-107', title: 'Kampala Rotary fundraising gala', eventType: 'social', stage: 'lost', clientName: 'Rotary Club of Kampala', contactName: 'Henry Mutebi', contactPhone: '0782 900 410', eventDate: day(20), endDate: day(20), expectedGuests: 200, estimatedValue: 30_000_000, probability: 0, source: 'Referral', lostReason: 'Price' }, ['enquiry', 'proposal', 'lost'], -35),
    lead({ ...base, ownerId: ESTHER.id, ownerName: ESTHER.name, id: 'LD-108', title: 'Mbabazi graduation party', eventType: 'social', stage: 'proposal', clientName: 'Mbabazi family', contactName: 'Grace Mbabazi', contactPhone: '0706 221 908', eventDate: day(18), endDate: day(18), expectedGuests: 80, estimatedValue: 6_500_000, probability: 40, source: 'Walk-in' }, ['enquiry', 'proposal'], -6),
    lead({ ...base, id: 'LD-109', title: 'Telecom dealers training', eventType: 'corporate', stage: 'definite', clientName: 'Kampala Telecom Dealers', contactName: 'Isaac Waiswa', contactPhone: '0774 118 552', eventDate: day(-5), endDate: day(-5), expectedGuests: 70, estimatedValue: 9_800_000, probability: 100, source: 'Phone', eventBookingId: 'EV-204' }, ['enquiry', 'tentative', 'definite'], -30),
  )

  // ---- Lakeview Grand: event bookings ----
  const booking = (b: Omit<EventBooking, 'propertyId' | 'createdAt' | 'createdBy'>, from: number, p = T1): EventBooking => ({
    ...b,
    propertyId: p,
    createdAt: at(from),
    createdBy: b.ownerName,
  })
  d.bookings.push(
    booking({ id: 'EV-201', leadId: 'LD-101', name: 'Equator Health annual review', eventType: 'conference', companyId: 'CA-002', clientName: 'Equator Health Partners', contactName: 'Dr Ruth Namubiru', contactPhone: '0772 400 201', status: 'definite', startDate: day(12), endDate: day(13), expectedGuests: 180, guaranteedGuests: 170, ownerName: LYDIA.name }, -31),
    booking({ id: 'EV-202', leadId: 'LD-102', name: 'Nakato and Ssali wedding', eventType: 'wedding', clientName: 'Nakato family', contactName: 'Agnes Nakato', contactPhone: '0701 555 120', status: 'tentative', startDate: day(26), endDate: day(26), expectedGuests: 250, ownerName: LYDIA.name }, -24),
    booking({ id: 'EV-203', leadId: 'LD-103', name: 'Lakeside Logistics board meeting', eventType: 'meeting', companyId: 'CA-001', clientName: 'Lakeside Logistics Ltd', contactName: 'Joan Akello', contactPhone: '0772 300 101', status: 'definite', startDate: day(3), endDate: day(3), expectedGuests: 14, guaranteedGuests: 14, ownerName: LYDIA.name }, -9),
    booking({ id: 'EV-204', leadId: 'LD-109', name: 'Telecom dealers training', eventType: 'corporate', clientName: 'Kampala Telecom Dealers', contactName: 'Isaac Waiswa', contactPhone: '0774 118 552', status: 'completed', startDate: day(-5), endDate: day(-5), expectedGuests: 70, guaranteedGuests: 68, ownerName: LYDIA.name }, -24),
    booking({ id: 'EV-205', name: 'UNRA contractors briefing', eventType: 'meeting', clientName: 'Uganda National Roads Authority', contactName: 'Eng. Paul Ocaya', contactPhone: '0772 880 145', status: 'tentative', startDate: day(26), endDate: day(26), expectedGuests: 120, ownerName: ESTHER.name, notes: 'Second option on the garden.' }, -3),
    booking({ id: 'EV-206', name: 'Ministry of Health TB workshop', eventType: 'conference', clientName: 'Ministry of Health', contactName: 'Dr Sarah Atim', contactPhone: '0414 340 874', status: 'definite', startDate: day(0), endDate: day(1), expectedGuests: 60, guaranteedGuests: 58, ownerName: ESTHER.name }, -20),
  )

  const sess = (id: string, eventBookingId: string, spaceId: string, title: string, date: string, startTime: string, endTime: string, setup: SetupStyle, pax: number, p = T1): EventSession => ({
    id, propertyId: p, eventBookingId, spaceId, title, date, startTime, endTime, setup, pax,
  })
  d.sessions.push(
    sess('SS-1', 'EV-201', 'SP-VIC', 'Plenary', day(12), '08:00', '17:00', 'theatre', 180),
    sess('SS-2', 'EV-201', 'SP-KIG', 'Board breakout', day(12), '14:00', '17:00', 'boardroom', 16),
    sess('SS-3', 'EV-201', 'SP-GDN', 'Gala dinner', day(12), '19:00', '23:00', 'banquet', 180),
    sess('SS-4', 'EV-201', 'SP-VIC', 'Workshops', day(13), '08:00', '13:00', 'classroom', 150),
    sess('SS-5', 'EV-202', 'SP-GDN', 'Ceremony and reception', day(26), '14:00', '23:00', 'banquet', 250),
    sess('SS-6', 'EV-203', 'SP-KIG', 'Board meeting', day(3), '09:00', '13:00', 'boardroom', 14),
    sess('SS-7', 'EV-204', 'SP-NILE', 'Training day', day(-5), '08:00', '17:00', 'classroom', 70),
    sess('SS-8', 'EV-205', 'SP-GDN', 'Contractors briefing', day(26), '10:00', '15:00', 'theatre', 120),
    sess('SS-9', 'EV-206', 'SP-NILE', 'Workshop day 1', day(0), '08:30', '16:30', 'classroom', 60),
    sess('SS-10', 'EV-206', 'SP-SSE', 'Facilitators meeting', day(0), '17:00', '18:30', 'boardroom', 10),
    sess('SS-11', 'EV-206', 'SP-NILE', 'Workshop day 2', day(1), '08:30', '13:00', 'classroom', 60),
  )

  // ---- BEOs ----
  const beo = (id: string, eventBookingId: string, status: Beo['status'], version: number, agenda: [string, string][], extra: Partial<Beo> = {}, p = T1): Beo => ({
    id,
    propertyId: p,
    eventBookingId,
    status,
    version,
    agenda: agenda.map(([time, item]) => ({ time, item })),
    ...extra,
  })
  d.beos.push(
    beo('BEO-201', 'EV-201', 'issued', 2, [['07:30', 'Registration'], ['08:00', 'Opening plenary'], ['10:30', 'Tea break'], ['13:00', 'Lunch'], ['14:00', 'Breakouts'], ['19:00', 'Gala dinner']], { kitchenNotes: '12 vegetarian, 3 gluten free.', setupNotes: 'Stage left, two screens.', issuedAt: at(-6), issuedBy: LYDIA.name }),
    beo('BEO-202', 'EV-202', 'draft', 1, [['14:00', 'Church party arrives'], ['15:00', 'Photos in the garden'], ['17:00', 'Reception and speeches'], ['19:00', 'Dinner'], ['21:00', 'Cake and dancing']], { kitchenNotes: 'Traditional dishes on one line.' }),
    beo('BEO-203', 'EV-203', 'signed', 1, [['09:00', 'Board meeting'], ['11:00', 'Tea'], ['13:00', 'Working lunch']], { issuedAt: at(-4), issuedBy: LYDIA.name, signedAt: at(-2), signedBy: 'Joan Akello' }),
    beo('BEO-204', 'EV-204', 'signed', 1, [['08:00', 'Training'], ['10:30', 'Tea'], ['13:00', 'Lunch'], ['15:30', 'Tea']], { issuedAt: at(-12), issuedBy: LYDIA.name, signedAt: at(-10), signedBy: 'Isaac Waiswa' }),
    beo('BEO-205', 'EV-205', 'draft', 1, []),
    beo('BEO-206', 'EV-206', 'signed', 1, [['08:30', 'Workshop'], ['10:30', 'Tea'], ['13:00', 'Lunch'], ['15:30', 'Tea']], { issuedAt: at(-8), issuedBy: ESTHER.name, signedAt: at(-7), signedBy: 'Dr Sarah Atim' }),
  )
  const item = (id: string, beoId: string, kind: BeoItem['kind'], description: string, date: string, quantity: number, unitPrice: number, unitCost: number, packageId?: string, time?: string, p = T1): BeoItem => ({
    id, propertyId: p, beoId, kind, description, date, quantity, unitPrice, unitCost, perHead: !!packageId || kind === 'menu', packageId, time,
  })
  d.beoItems.push(
    item('BI-1', 'BEO-201', 'package', 'Full day delegate', day(12), 180, 85_000, 38_000, 'PK-FDD'),
    item('BI-2', 'BEO-201', 'package', 'Wedding buffet (gold) as gala dinner', day(12), 180, 120_000, 55_000, 'PK-WED', '19:00'),
    item('BI-3', 'BEO-201', 'package', 'Half day delegate', day(13), 150, 60_000, 26_000, 'PK-HDD'),
    item('BI-4', 'BEO-201', 'beverage', 'Soft drinks at dinner', day(12), 360, 4_000, 1_800, undefined, '19:00'),
    item('BI-5', 'BEO-202', 'package', 'Wedding buffet (gold)', day(26), 250, 120_000, 55_000, 'PK-WED', '19:00'),
    item('BI-6', 'BEO-202', 'package', 'Cocktail reception', day(26), 250, 45_000, 20_000, 'PK-CKT', '17:00'),
    item('BI-7', 'BEO-203', 'menu', 'Working lunch', day(3), 14, 35_000, 15_000, 'PK-LUN', '13:00'),
    item('BI-8', 'BEO-203', 'beverage', 'Tea and coffee', day(3), 14, 8_000, 2_500, undefined, '11:00'),
    item('BI-9', 'BEO-204', 'package', 'Full day delegate', day(-5), 70, 85_000, 38_000, 'PK-FDD'),
    item('BI-10', 'BEO-206', 'package', 'Full day delegate', day(0), 60, 85_000, 38_000, 'PK-FDD'),
    item('BI-11', 'BEO-206', 'package', 'Half day delegate', day(1), 60, 60_000, 26_000, 'PK-HDD'),
  )
  const res = (id: string, eventBookingId: string, equipmentId: string, date: string, quantity: number, p = T1): ResourceBooking => {
    const e = d.equipment.find((x) => x.id === equipmentId) as Equipment
    return { id, propertyId: p, eventBookingId, equipmentId, date, quantity, unitPrice: e.dailyRate, unitCost: e.dailyCost }
  }
  d.resourceBookings.push(
    res('RB-1', 'EV-201', 'EQ-PROJ', day(12), 2),
    res('RB-2', 'EV-201', 'EQ-PA', day(12), 2),
    res('RB-3', 'EV-201', 'EQ-MIC', day(12), 6),
    res('RB-4', 'EV-201', 'EQ-STG', day(12), 1),
    res('RB-5', 'EV-201', 'EQ-WAIT', day(12), 14),
    res('RB-6', 'EV-201', 'EQ-AVT', day(12), 2),
    res('RB-7', 'EV-202', 'EQ-DEC', day(26), 3),
    res('RB-8', 'EV-202', 'EQ-PA', day(26), 1),
    res('RB-9', 'EV-202', 'EQ-WAIT', day(26), 18),
    res('RB-10', 'EV-203', 'EQ-PROJ', day(3), 1),
    res('RB-11', 'EV-204', 'EQ-PROJ', day(-5), 1),
    res('RB-12', 'EV-204', 'EQ-WAIT', day(-5), 4),
    res('RB-13', 'EV-206', 'EQ-PROJ', day(0), 2),
    res('RB-14', 'EV-206', 'EQ-MIC', day(0), 2),
    res('RB-15', 'EV-206', 'EQ-AVT', day(0), 1),
  )

  // ---- Quotes ----
  const quote = (q: Omit<Quote, 'propertyId' | 'createdBy'> & { createdBy?: string }): Quote => ({ propertyId: T1, createdBy: LYDIA.name, ...q })
  const version = (id: string, quoteId: string, v: number, reason: string, discountPct: number, lines: Omit<QuoteLine, 'id' | 'propertyId' | 'quoteVersionId'>[], created: number) => {
    const made = lines.map((l, i) => ({ ...l, id: `${id}-L${i + 1}`, propertyId: T1, quoteVersionId: id }))
    const subtotal = made.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const discount = Math.round((subtotal * discountPct) / 100)
    const qv: QuoteVersion = { id, propertyId: T1, quoteId, version: v, reason, discountPct, subtotal, discount, total: subtotal - discount, createdAt: at(created), createdBy: LYDIA.name }
    d.quoteVersions.push(qv)
    d.quoteLines.push(...made)
  }
  d.quotes.push(
    quote({ id: 'QT-1001', number: 'Q-1001', leadId: 'LD-101', eventBookingId: 'EV-201', title: 'Equator Health annual review', status: 'accepted', currentVersion: 2, validUntil: day(-10), sentAt: at(-32), sentBy: LYDIA.name, acceptedAt: at(-30), acceptedBy: 'Dr Ruth Namubiru', createdAt: at(-36) }),
    quote({ id: 'QT-1002', number: 'Q-1002', leadId: 'LD-104', title: "Pearl Agro dealers' dinner", status: 'sent', currentVersion: 1, validUntil: day(14), sentAt: at(-6), sentBy: LYDIA.name, createdAt: at(-7) }),
    quote({ id: 'QT-1003', number: 'Q-1003', leadId: 'LD-102', eventBookingId: 'EV-202', title: 'Nakato and Ssali wedding', status: 'accepted', currentVersion: 1, validUntil: day(5), sentAt: at(-25), sentBy: LYDIA.name, acceptedAt: at(-23), acceptedBy: 'Agnes Nakato', createdAt: at(-26) }),
    quote({ id: 'QT-1004', number: 'Q-1004', leadId: 'LD-109', eventBookingId: 'EV-204', title: 'Telecom dealers training', status: 'accepted', currentVersion: 1, validUntil: day(-15), sentAt: at(-26), sentBy: LYDIA.name, acceptedAt: at(-25), acceptedBy: 'Isaac Waiswa', createdAt: at(-27) }),
    quote({ id: 'QT-1005', number: 'Q-1005', leadId: 'LD-108', title: 'Mbabazi graduation party', status: 'draft', currentVersion: 1, validUntil: day(10), createdAt: at(-1), createdBy: ESTHER.name }),
  )
  version('QV-1001-1', 'QT-1001', 1, 'First proposal', 5, [
    { kind: 'package', refId: 'PK-FDD', description: 'Full day delegate, day 1', quantity: 150, unitPrice: 85_000, unitCost: 38_000 },
    { kind: 'package', refId: 'PK-HDD', description: 'Half day delegate, day 2', quantity: 150, unitPrice: 60_000, unitCost: 26_000 },
    { kind: 'space', refId: 'SP-VIC', description: 'Victoria Hall, full day', quantity: 1, unitPrice: 3_000_000, unitCost: 0 },
    { kind: 'room', description: 'Deluxe rooms, 1 night', quantity: 40, unitPrice: 150_000, unitCost: 35_000 },
  ], -36)
  version('QV-1001-2', 'QT-1001', 2, 'Guests up from 150 to 180, gala dinner added', 5, [
    { kind: 'package', refId: 'PK-FDD', description: 'Full day delegate, day 1', quantity: 180, unitPrice: 85_000, unitCost: 38_000 },
    { kind: 'package', refId: 'PK-HDD', description: 'Half day delegate, day 2', quantity: 150, unitPrice: 60_000, unitCost: 26_000 },
    { kind: 'package', refId: 'PK-WED', description: 'Gala dinner buffet', quantity: 180, unitPrice: 120_000, unitCost: 55_000 },
    { kind: 'space', refId: 'SP-VIC', description: 'Victoria Hall, full day', quantity: 1, unitPrice: 3_000_000, unitCost: 0 },
    { kind: 'room', description: 'Deluxe rooms, 1 night', quantity: 40, unitPrice: 150_000, unitCost: 35_000 },
  ], -33)
  version('QV-1002-1', 'QT-1002', 1, 'First proposal', 0, [
    { kind: 'package', refId: 'PK-WED', description: 'Dinner buffet', quantity: 150, unitPrice: 120_000, unitCost: 55_000 },
    { kind: 'space', refId: 'SP-NILE', description: 'Nile Suite, evening', quantity: 1, unitPrice: 900_000, unitCost: 0 },
    { kind: 'equipment', refId: 'EQ-PA', description: 'PA system', quantity: 1, unitPrice: 250_000, unitCost: 40_000 },
  ], -7)
  version('QV-1003-1', 'QT-1003', 1, 'First proposal', 0, [
    { kind: 'package', refId: 'PK-WED', description: 'Wedding buffet (gold)', quantity: 250, unitPrice: 120_000, unitCost: 55_000 },
    { kind: 'package', refId: 'PK-CKT', description: 'Cocktail reception', quantity: 250, unitPrice: 45_000, unitCost: 20_000 },
    { kind: 'space', refId: 'SP-GDN', description: 'Lakeside Garden, full day', quantity: 1, unitPrice: 2_500_000, unitCost: 0 },
    { kind: 'equipment', refId: 'EQ-DEC', description: 'Decor sets', quantity: 3, unitPrice: 600_000, unitCost: 250_000 },
  ], -26)
  version('QV-1004-1', 'QT-1004', 1, 'First proposal', 0, [
    { kind: 'package', refId: 'PK-FDD', description: 'Full day delegate', quantity: 70, unitPrice: 85_000, unitCost: 38_000 },
    { kind: 'space', refId: 'SP-NILE', description: 'Nile Suite, full day', quantity: 1, unitPrice: 1_500_000, unitCost: 0 },
    { kind: 'equipment', refId: 'EQ-PROJ', description: 'Projector and screen', quantity: 1, unitPrice: 150_000, unitCost: 20_000 },
  ], -27)
  version('QV-1005-1', 'QT-1005', 1, 'First proposal', 0, [
    { kind: 'package', refId: 'PK-CKT', description: 'Cocktail reception', quantity: 80, unitPrice: 45_000, unitCost: 20_000 },
    { kind: 'space', refId: 'SP-NILE', description: 'Nile Suite, evening', quantity: 1, unitPrice: 900_000, unitCost: 0 },
  ], -1)

  // ---- Contracts and deposits ----
  const totalOf = (quoteId: string, v: number) => d.quoteVersions.find((x) => x.quoteId === quoteId && x.version === v)?.total ?? 0
  const contract = (c: Omit<Contract, 'propertyId' | 'value' | 'cancellationTerms' | 'createdBy'>): Contract => ({
    ...c,
    propertyId: T1,
    value: totalOf(c.quoteId, c.quoteVersion),
    cancellationTerms: '50% of the contract value is kept if cancelled within 30 days of the event; 100% within 7 days.',
    createdBy: LYDIA.name,
  })
  d.contracts.push(
    contract({ id: 'CT-1001', number: 'C-1001', eventBookingId: 'EV-201', quoteId: 'QT-1001', quoteVersion: 2, status: 'signed', sentAt: at(-29), signedAt: at(-27), signedBy: 'Dr Ruth Namubiru', createdAt: at(-30) }),
    contract({ id: 'CT-1002', number: 'C-1002', eventBookingId: 'EV-202', quoteId: 'QT-1003', quoteVersion: 1, status: 'sent', sentAt: at(-22), createdAt: at(-23) }),
    contract({ id: 'CT-1003', number: 'C-1003', eventBookingId: 'EV-204', quoteId: 'QT-1004', quoteVersion: 1, status: 'signed', sentAt: at(-25), signedAt: at(-24), signedBy: 'Isaac Waiswa', createdAt: at(-25) }),
  )
  const dep = (id: string, contractId: string, label: string, dueDate: string, amount: number): DepositSchedule => ({ id, propertyId: T1, contractId, label, dueDate, amount })
  const v1001 = totalOf('QT-1001', 2)
  const v1002 = totalOf('QT-1003', 1)
  const v1003 = totalOf('QT-1004', 1)
  d.depositSchedules.push(
    dep('DS-1', 'CT-1001', 'Deposit on signing', day(-25), Math.round(v1001 * 0.3)),
    dep('DS-2', 'CT-1001', 'Second deposit', day(-2), Math.round(v1001 * 0.4)),
    dep('DS-3', 'CT-1001', 'Balance', day(5), v1001 - Math.round(v1001 * 0.3) - Math.round(v1001 * 0.4)),
    dep('DS-4', 'CT-1002', 'Deposit on signing', day(-15), Math.round(v1002 * 0.3)),
    dep('DS-5', 'CT-1002', 'Balance', day(19), v1002 - Math.round(v1002 * 0.3)),
    dep('DS-6', 'CT-1003', 'Full payment', day(-8), v1003),
  )
  const pay = (id: string, eventBookingId: string, depositScheduleId: string, amount: number, method: string, reference: string, when: number, by = 'Brian Ssemakula'): EventPayment => ({
    id, propertyId: T1, eventBookingId, depositScheduleId, amount, method, reference, receivedAt: at(when), receivedBy: by,
  })
  d.payments.push(
    pay('EP-1', 'EV-201', 'DS-1', Math.round(v1001 * 0.3), 'Bank transfer', 'EFT 88213', -26),
    pay('EP-2', 'EV-202', 'DS-4', 5_000_000, 'MTN MoMo', 'MP2409.1182', -14),
    pay('EP-3', 'EV-204', 'DS-6', v1003, 'Bank transfer', 'EFT 87120', -9),
  )

  // ---- Master accounts, postings, costs ----
  const master = (id: string, eventBookingId: string, name: string, openedOn: number, extra: Partial<MasterAccount> = {}, p = T1): MasterAccount => ({
    id, propertyId: p, eventBookingId, name, status: 'open', openedAt: at(openedOn), openedBy: LYDIA.name, ...extra,
  })
  d.masterAccounts.push(
    master('MA-201', 'EV-201', 'Equator Health Partners - annual review', -27, { companyId: 'CA-002' }),
    master('MA-204', 'EV-204', 'Kampala Telecom Dealers - training', -6),
    master('MA-206', 'EV-206', 'Ministry of Health - TB workshop', -1),
  )
  const post = (id: string, masterAccountId: string, eventBookingId: string, date: string, category: EventPosting['category'], description: string, amount: number, source: EventPosting['source'], by = LYDIA.name, p = T1): EventPosting => ({
    id, propertyId: p, masterAccountId, eventBookingId, date, category, description, amount, source, postedAt: `${date}T18:00:00.000Z`, postedBy: by,
  })
  d.postings.push(
    post('PO-1', 'MA-204', 'EV-204', day(-5), 'Room hire', 'Nile Suite, full day', 1_500_000, 'space'),
    post('PO-2', 'MA-204', 'EV-204', day(-5), 'Food', 'Full day delegate x 70', 5_950_000, 'beo'),
    post('PO-3', 'MA-204', 'EV-204', day(-5), 'Equipment', 'Projector and screen x 1', 150_000, 'resource'),
    post('PO-4', 'MA-204', 'EV-204', day(-5), 'Beverage', 'Extra sodas at lunch', 168_000, 'manual'),
    post('PO-5', 'MA-206', 'EV-206', day(0), 'Room hire', 'Nile Suite, full day', 1_500_000, 'space', ESTHER.name),
  )
  const cost = (id: string, eventBookingId: string, category: EventCost['category'], description: string, amount: number, when: number): EventCost => ({
    id, propertyId: T1, eventBookingId, category, description, amount, recordedAt: at(when), recordedBy: 'Brian Ssemakula',
  })
  d.costs.push(
    cost('EC-1', 'EV-204', 'food', 'Kitchen food cost, 68 covers', 2_480_000, -4),
    cost('EC-2', 'EV-204', 'beverage', 'Sodas and water', 210_000, -4),
    cost('EC-3', 'EV-204', 'staff', 'Casual waiters x 4', 160_000, -4),
    cost('EC-4', 'EV-204', 'equipment', 'Projector lamp hours', 20_000, -4),
  )

  // ---- Savannah Lodge: a simpler set ----
  d.spaces.push(
    space(T3, 'SP-ACA', 'Acacia Hall', 'hall', 180, 500_000, 800_000),
    space(T3, 'SP-BAO', 'Baobab Boardroom', 'boardroom', 40, 150_000, 250_000),
    space(T3, 'SP-LGD', 'Lodge Garden', 'garden', 800, 600_000, 1_000_000),
  )
  d.setups.push(
    ...setups(T3, 'SP-ACA', [['theatre', 120], ['classroom', 60], ['banquet', 90]]),
    ...setups(T3, 'SP-BAO', [['boardroom', 12]]),
    ...setups(T3, 'SP-LGD', [['banquet', 150], ['cocktail', 200]]),
  )
  const sPacks = [
    pkg(T3, 'PK-S-FDD', 'Full day conference', 'day-delegate', 55_000, 24_000, [
      ['food', 'Two tea breaks'],
      ['food', 'Buffet lunch'],
      ['beverage', 'Water'],
    ]),
    pkg(T3, 'PK-S-BBQ', 'Garden barbecue', 'menu', 65_000, 30_000, [
      ['food', 'Grilled meats, matooke and salads'],
      ['beverage', 'One soft drink'],
    ]),
  ]
  for (const p of sPacks) {
    d.packages.push(p.made)
    d.packageItems.push(...p.lines)
  }
  d.equipment.push(
    equip(T3, 'EQ-S-PROJ', 'Projector and screen', 'av', 2, 100_000, 15_000),
    equip(T3, 'EQ-S-PA', 'PA system', 'av', 1, 150_000, 25_000),
    equip(T3, 'EQ-S-FLIP', 'Flip chart', 'furniture', 4, 10_000, 1_500),
    equip(T3, 'EQ-S-WAIT', 'Waiting staff', 'staff', 8, 40_000, 25_000),
  )
  d.bookings.push(
    booking({ id: 'EV-301', name: 'Kidepo NGO partners meeting', eventType: 'meeting', clientName: 'Karamoja Development Forum', contactName: 'Joyce Lokiru', contactPhone: '0772 611 240', status: 'definite', startDate: day(0), endDate: day(0), expectedGuests: 40, ownerName: ESTHER.name }, -10, T3),
    booking({ id: 'EV-302', name: 'Okello family reunion', eventType: 'social', clientName: 'Okello family', contactName: 'James Okello', contactPhone: '0703 118 920', status: 'tentative', startDate: day(9), endDate: day(9), expectedGuests: 110, ownerName: ESTHER.name }, -5, T3),
  )
  d.sessions.push(
    sess('SS-31', 'EV-301', 'SP-ACA', 'Partners meeting', day(0), '09:00', '16:00', 'classroom', 40, T3),
    sess('SS-32', 'EV-302', 'SP-LGD', 'Reunion lunch', day(9), '12:00', '18:00', 'banquet', 110, T3),
  )
  d.beos.push(
    beo('BEO-301', 'EV-301', 'issued', 1, [['09:00', 'Meeting'], ['10:30', 'Tea'], ['13:00', 'Lunch']], { issuedAt: at(-2), issuedBy: ESTHER.name }, T3),
    beo('BEO-302', 'EV-302', 'draft', 1, [['12:00', 'Guests arrive'], ['13:00', 'Barbecue lunch']], {}, T3),
  )
  d.beoItems.push(
    item('BI-31', 'BEO-301', 'package', 'Full day conference', day(0), 40, 55_000, 24_000, 'PK-S-FDD', undefined, T3),
    item('BI-32', 'BEO-302', 'menu', 'Garden barbecue', day(9), 110, 65_000, 30_000, 'PK-S-BBQ', '13:00', T3),
  )
  d.resourceBookings.push(res('RB-31', 'EV-301', 'EQ-S-PROJ', day(0), 1, T3), res('RB-32', 'EV-302', 'EQ-S-WAIT', day(9), 6, T3))
  d.masterAccounts.push(master('MA-301', 'EV-301', 'Karamoja Development Forum - partners meeting', -1, { openedBy: ESTHER.name }, T3))
  d.postings.push(post('PO-31', 'MA-301', 'EV-301', day(0), 'Room hire', 'Acacia Hall, full day', 800_000, 'space', ESTHER.name, T3))

  return d
}
