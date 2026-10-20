import { TODAY } from '../../data/sample'
import type { RoleId } from '../../lib/roles'
import {
  addDaysYmd,
  buildTimesheet,
  escalationStep,
  escalationTime,
  monthPeriod,
  previousPeriod,
  shiftWindow,
  weekDays,
  weekStart,
} from '../../lib/workforce'
import type { Actor } from '../types'
import type { WorkforceService, WorkforceSnapshot } from './workforceService'
import type {
  AttendanceEvent,
  CaseAction,
  ContractType,
  Department,
  EmployeeLink,
  LoginStatus,
  PayrollExport,
  RosterShift,
  ServiceCase,
  ShiftTemplate,
  StaffUser,
  TrademateEmployee,
  WorkNotification,
  WorkPriority,
  WorkTask,
} from './workforceTypes'

// In-memory people data for the prototype. Deterministic sample staff for the three demo hotels,
// rosters from the start of last month to the end of next week, and clock events up to now. Changes
// last until the page is reloaded.

const SYSTEM: Actor = { id: 'system', name: 'Gastora' }
const HOUR = 3600000

type Pattern = 'office' | 'early' | 'late' | 'rotate' | 'night' | 'none'
type Seed = {
  name: string
  dept: string
  title: string
  roles: RoleId[]
  login: LoginStatus
  loginUserId?: string
  pattern: Pattern
  linked: boolean
  contract?: ContractType
  also?: { dept: string; percent: number }
}

const DEPTS: Record<string, string> = {
  MGT: 'Management',
  FO: 'Front office',
  HK: 'Housekeeping',
  FB: 'Food and beverage',
  KIT: 'Kitchen',
  ENG: 'Maintenance',
  SEC: 'Security',
}

const s = (
  name: string,
  dept: string,
  title: string,
  roles: RoleId[],
  login: LoginStatus,
  pattern: Pattern,
  linked = true,
  extra: Partial<Seed> = {},
): Seed => ({ name, dept, title, roles, login, pattern, linked, ...extra })

const SEEDS: Record<string, { depts: string[]; names?: Record<string, string>; staff: Seed[] }> = {
  t1: {
    depts: ['MGT', 'FO', 'HK', 'FB', 'KIT', 'ENG', 'SEC'],
    staff: [
      s('Patricia Owor', 'MGT', 'Owner', ['owner'], 'active', 'none', true, { loginUserId: 'u-owner' }),
      s('Esther Nambi', 'MGT', 'General manager', ['gm'], 'active', 'office', true, { loginUserId: 'u-gm' }),
      s('Daniel Kato', 'MGT', 'Hotel administrator', ['admin'], 'active', 'office', true, { loginUserId: 'u-admin' }),
      s('Brian Ssemakula', 'MGT', 'Finance manager', ['finance'], 'active', 'office', true, { loginUserId: 'u-finance' }),
      s('Peter Mugisha', 'MGT', 'Storekeeper', ['storekeeper'], 'active', 'office', true, { loginUserId: 'u-store' }),
      s('Grace Namatovu', 'MGT', 'Procurement officer', ['procurement'], 'active', 'office', true, { loginUserId: 'u-proc' }),
      s('Rita Auma', 'FO', 'Front office supervisor', ['frontdesk'], 'active', 'rotate', true, { loginUserId: 'u-desk' }),
      s('Vivian Achan', 'FO', 'Reservations agent', ['reservations'], 'active', 'office', true, { loginUserId: 'u-res' }),
      s('Moses Kizza', 'FO', 'Receptionist', ['frontdesk'], 'active', 'rotate'),
      s('Agnes Nakato', 'FO', 'Receptionist', ['frontdesk'], 'invited', 'rotate', false, { contract: 'contract' }),
      s('Ivan Tumusiime', 'FO', 'Night auditor', ['frontdesk'], 'active', 'night'),
      s('Mary Nabirye', 'HK', 'Head of housekeeping', ['hkhead'], 'active', 'early', true, { loginUserId: 'u-hk' }),
      s('Sarah Nanteza', 'HK', 'Room attendant', ['attendant'], 'active', 'early', true, { loginUserId: 'u-att' }),
      s('John Mukasa', 'HK', 'Room attendant', ['attendant'], 'active', 'early'),
      s('David Ouma', 'HK', 'Room attendant', ['attendant'], 'active', 'early'),
      s('Grace Achieng', 'HK', 'Room attendant', ['attendant'], 'active', 'early'),
      s('Peter Wasswa', 'HK', 'Public area attendant', ['attendant'], 'active', 'late', true, { also: { dept: 'FB', percent: 20 } }),
      s('Florence Atim', 'HK', 'Laundry attendant', [], 'none', 'early', false, { contract: 'casual' }),
      s('Kevin Ocen', 'FB', 'Restaurant supervisor', ['pos'], 'active', 'rotate', true, { loginUserId: 'u-pos' }),
      s('Juliet Namubiru', 'FB', 'Waitress', ['pos'], 'active', 'rotate'),
      s('Samuel Odongo', 'FB', 'Bartender', ['pos'], 'active', 'late'),
      s('Halima Nakitende', 'FB', 'Waitress', [], 'none', 'late', false, { contract: 'casual' }),
      s('Robert Byaruhanga', 'KIT', 'Head chef', ['pos'], 'active', 'early'),
      s('Christine Apio', 'KIT', 'Cook', [], 'none', 'rotate'),
      s('Emmanuel Lubega', 'KIT', 'Kitchen steward', [], 'none', 'late'),
      s('Joseph Okia', 'ENG', 'Maintenance lead', ['maintenance'], 'active', 'office', true, { loginUserId: 'u-maint' }),
      s('Ali Waiswa', 'ENG', 'Technician', ['maintenance'], 'active', 'rotate'),
      s('Ruth Kemigisha', 'ENG', 'Electrician', ['maintenance'], 'active', 'early'),
      s('Godfrey Opio', 'SEC', 'Security supervisor', [], 'none', 'rotate'),
      s('Charles Ochieng', 'SEC', 'Guard', [], 'none', 'night'),
      s('Simon Mugerwa', 'SEC', 'Guard', [], 'none', 'night', false, { contract: 'contract' }),
    ],
  },
  t3: {
    depts: ['MGT', 'FO', 'HK', 'FB', 'ENG', 'SEC'],
    staff: [
      s('Joan Kyomugisha', 'MGT', 'General manager', ['gm'], 'active', 'office'),
      s('Paul Ainebyona', 'MGT', 'Accountant', ['finance'], 'active', 'office'),
      s('Betty Nansubuga', 'FO', 'Receptionist', ['frontdesk'], 'active', 'rotate'),
      s('Henry Okot', 'FO', 'Receptionist', ['frontdesk'], 'active', 'rotate'),
      s('Isaac Mwesigwa', 'FO', 'Night receptionist', ['frontdesk'], 'active', 'night'),
      s('Rose Akello', 'HK', 'Head housekeeper', ['hkhead'], 'active', 'early'),
      s('Annet Nalwoga', 'HK', 'Room attendant', ['attendant'], 'active', 'early'),
      s('Fred Ssentongo', 'HK', 'Room attendant', ['attendant'], 'active', 'early'),
      s('Doreen Amongi', 'HK', 'Room attendant', [], 'invited', 'early', false, { contract: 'casual' }),
      s('Ronald Kigozi', 'FB', 'Chef', ['pos'], 'active', 'early'),
      s('Prossy Nakimuli', 'FB', 'Waitress', ['pos'], 'active', 'rotate'),
      s('Alex Ojok', 'FB', 'Bartender', [], 'none', 'late', false, { contract: 'casual' }),
      s('Tom Engola', 'ENG', 'Technician', ['maintenance'], 'active', 'office'),
      s('Patrick Obura', 'SEC', 'Guard', [], 'none', 'rotate'),
      s('Moses Lokwang', 'SEC', 'Guard', [], 'none', 'night'),
    ],
  },
  t2: {
    depts: ['MGT', 'FO', 'HK', 'KIT', 'ENG'],
    names: { KIT: 'Kitchen and bar', ENG: 'Maintenance and security' },
    staff: [
      s('Sylvia Nekesa', 'MGT', 'Owner-manager', ['owner'], 'active', 'office'),
      s('Hassan Wamala', 'FO', 'Receptionist', ['frontdesk'], 'active', 'rotate'),
      s('Brenda Khainza', 'FO', 'Receptionist', ['frontdesk'], 'active', 'night'),
      s('Jane Nabwire', 'HK', 'Housekeeper', ['hkhead'], 'active', 'early'),
      s('Lillian Mutonyi', 'HK', 'Room attendant', ['attendant'], 'invited', 'early'),
      s('Ben Masaba', 'KIT', 'Cook', ['pos'], 'active', 'early'),
      s('Esther Wanyama', 'KIT', 'Waitress and bar', [], 'none', 'late', false, { contract: 'casual' }),
      s('Wilson Kutosi', 'ENG', 'Handyman', ['maintenance'], 'active', 'office'),
      s('Geoffrey Wodada', 'ENG', 'Night guard', [], 'none', 'night'),
    ],
  },
}

const TEMPLATES: Omit<ShiftTemplate, 'id' | 'propertyId'>[] = [
  { code: 'morning', name: 'Morning', startTime: '06:00', endTime: '14:00', paidHours: 8 },
  { code: 'evening', name: 'Evening', startTime: '14:00', endTime: '22:00', paidHours: 8 },
  { code: 'night', name: 'Night', startTime: '22:00', endTime: '06:00', paidHours: 8 },
  { code: 'day', name: 'Office day', startTime: '08:00', endTime: '17:00', paidHours: 8 },
]

/** A stable number from a string, so sample lateness and absences are the same on every load. */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const dayWords = (ymd: string) => new Date(ymd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-')

type Store = WorkforceSnapshot & { approvals: Map<string, { at: string; by: Actor }>; counter: number }

function phoneOf(i: number, pid: string) {
  return `+256 7${(hash(pid + i) % 9) + 0}${String(1000000 + (hash(`${pid}p${i}`) % 8999999)).slice(0, 7)}`
}

function seedProperty(pid: string, now: number): Store {
  const def = SEEDS[pid] ?? { depts: ['MGT', 'FO', 'HK'], staff: [] }
  const departments: Department[] = def.depts.map((code) => ({
    id: `${pid}-dep-${code.toLowerCase()}`,
    propertyId: pid,
    code,
    name: def.names?.[code] ?? DEPTS[code],
  }))
  const depId = (code: string) => `${pid}-dep-${code.toLowerCase()}`
  const templates: ShiftTemplate[] = TEMPLATES.map((t) => ({ ...t, id: `${pid}-sh-${t.code}`, propertyId: pid }))
  const tplId = (code: ShiftTemplate['code']) => `${pid}-sh-${code}`

  const staff: StaffUser[] = def.staff.map((x, i) => ({
    id: x.loginUserId && pid === 't1' ? x.loginUserId : `${pid}-usr-${slug(x.name)}`,
    propertyId: pid,
    fullName: x.name,
    phone: phoneOf(i, pid),
    email: x.login === 'none' ? undefined : `${x.name.split(' ')[0].toLowerCase()}@${pid === 't1' ? 'lakeview' : pid === 't2' ? 'mbaletowninn' : 'savannahlodge'}.demo`,
    jobTitle: x.title,
    departmentId: depId(x.dept),
    allocations: x.also ? [{ departmentId: depId(x.also.dept), percent: x.also.percent }] : [],
    roles: x.roles,
    loginStatus: x.login,
    loginUserId: x.loginUserId,
    contractType: x.contract ?? 'permanent',
    active: true,
  }))
  for (const d of departments) {
    const head = staff.find((u) => u.departmentId === d.id && /head|supervisor|lead|manager|chef|housekeeper|owner/i.test(u.jobTitle))
    d.headUserId = head?.id ?? staff.find((u) => u.departmentId === d.id)?.id
  }

  // Trademate's own list. Linked staff appear in it, and so do people who have no Gastora record yet.
  const trademate: TrademateEmployee[] = def.staff.map((x, i) => ({
    trademateEmployeeId: `TM-${pid.toUpperCase()}-${String(1001 + i)}`,
    propertyId: pid,
    employeeNo: `EMP${String(101 + i).padStart(4, '0')}`,
    fullName: x.name,
    grade: x.roles.includes('gm') || x.roles.includes('owner') ? 'M1' : /head|supervisor|lead|chef/i.test(x.title) ? 'S2' : 'G3',
    startDate: addDaysYmd(TODAY, -((hash(x.name) % 1800) + 60)),
    nationalIdMasked: `CM${String(hash(x.name)).slice(0, 2)}••••••••${String(hash(x.name + 'id')).slice(0, 2)}`,
    bankMasked: `••••${String(hash(x.name + 'bank')).slice(0, 4)}`,
    payGroup: x.contract === 'casual' ? 'Casual (daily)' : 'Monthly',
  }))
  const links: EmployeeLink[] = def.staff
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x.linked)
    .map(({ i }) => ({
      id: `${pid}-lnk-${i}`,
      propertyId: pid,
      userId: staff[i].id,
      trademateEmployeeId: trademate[i].trademateEmployeeId,
      linkedAt: new Date(now - (40 + i) * 24 * HOUR).toISOString(),
      linkedBy: SYSTEM,
    }))

  // Rosters: from the first of last month to the end of next week. Next week is still a draft.
  const thisWeek = weekStart(TODAY)
  const nextWeek = addDaysYmd(thisWeek, 7)
  const from = previousPeriod(monthPeriod(TODAY)).start
  const to = addDaysYmd(nextWeek, 6)
  const shifts: RosterShift[] = []
  def.staff.forEach((x, i) => {
    if (x.pattern === 'none') return
    for (let d = from; d <= to; d = addDaysYmd(d, 1)) {
      const dow = (new Date(d + 'T00:00:00').getDay() + 6) % 7 // Monday 0
      const week = Math.floor((Date.parse(d) - Date.parse(from)) / (7 * 24 * HOUR))
      let code: ShiftTemplate['code'] | null
      if (x.pattern === 'office') code = dow < 5 ? 'day' : null
      else {
        const off = (i * 3) % 7
        if (dow === off) code = null
        else if (x.pattern === 'early') code = 'morning'
        else if (x.pattern === 'late') code = 'evening'
        else if (x.pattern === 'night') code = dow === (off + 1) % 7 ? null : 'night'
        else code = (week + i) % 2 === 0 ? 'morning' : 'evening'
      }
      if (!code) continue
      const draft = d >= nextWeek
      shifts.push({
        id: `${pid}-rs-${i}-${d}`,
        propertyId: pid,
        userId: staff[i].id,
        departmentId: staff[i].departmentId,
        workDate: d,
        shiftTemplateId: tplId(code),
        status: draft ? 'draft' : 'published',
        publishedAt: draft ? undefined : new Date(Date.parse(addDaysYmd(weekStart(d), -3) + 'T16:00:00')).toISOString(),
        publishedBy: draft ? undefined : SYSTEM,
      })
    }
  })
  // Two problems left in next week's draft on purpose: too little rest, and a seven-day week.
  const rotating = def.staff.findIndex((x) => x.pattern === 'night')
  if (rotating >= 0) {
    const u = staff[rotating]
    const nightDay = shifts.find((r) => r.userId === u.id && r.workDate >= nextWeek && r.shiftTemplateId === tplId('night'))
    if (nightDay) {
      const after = addDaysYmd(nightDay.workDate, 1)
      const existing = shifts.find((r) => r.userId === u.id && r.workDate === after)
      if (existing) existing.shiftTemplateId = tplId('morning')
      else
        shifts.push({ ...nightDay, id: `${pid}-rs-x-${after}`, workDate: after, shiftTemplateId: tplId('morning') })
    }
  }
  const early = def.staff.findIndex((x) => x.pattern === 'early' && !x.roles.includes('hkhead'))
  if (early >= 0) {
    const off = (early * 3) % 7
    const day = addDaysYmd(nextWeek, off)
    shifts.push({
      id: `${pid}-rs-ot-${day}`,
      propertyId: pid,
      userId: staff[early].id,
      departmentId: staff[early].departmentId,
      workDate: day,
      shiftTemplateId: tplId('morning'),
      status: 'draft',
    })
  }

  // Clock events for every published shift that has started.
  const tpl = new Map(templates.map((t) => [t.id, t]))
  const events: AttendanceEvent[] = []
  let ev = 0
  for (const r of shifts) {
    if (r.status !== 'published') continue
    const t = tpl.get(r.shiftTemplateId)!
    const w = shiftWindow(t, r.workDate)
    if (w.start > now) continue
    const h = hash(r.userId + r.workDate)
    const user = staff.find((u) => u.id === r.userId)!
    if (h % 47 === 0) continue // absent, no reason given
    if (h % 53 === 1) {
      events.push({ id: `${pid}-ev-${ev++}`, propertyId: pid, userId: r.userId, workDate: r.workDate, kind: 'in', at: new Date(w.start).toISOString(), source: 'manual', absence: 'sick', reason: 'Called in sick', recordedBy: SYSTEM })
      continue
    }
    // Today: one or two people late, and someone not in yet.
    const isToday = r.workDate === TODAY
    if (isToday && h % 6 === 0 && now - w.start < 2 * HOUR) continue
    const late = h % 11 === 0 || (isToday && h % 5 === 0) ? 15 + (h % 35) : (h % 9) - 6
    const inAt = w.start + late * 60000
    if (inAt > now) continue
    events.push({ id: `${pid}-ev-${ev++}`, propertyId: pid, userId: r.userId, workDate: r.workDate, kind: 'in', at: new Date(inAt).toISOString(), source: 'clock' })
    const extra = h % 7 === 0 && user.contractType !== 'casual' ? 60 + (h % 4) * 30 : h % 6
    const outAt = w.end + extra * 60000
    if (outAt > now) continue
    events.push({ id: `${pid}-ev-${ev++}`, propertyId: pid, userId: r.userId, workDate: r.workDate, kind: 'out', at: new Date(outAt).toISOString(), source: 'clock' })
  }

  // Tasks across departments, some of them already late.
  const ago = (hours: number) => new Date(now - hours * HOUR).toISOString()
  const head = (code: string) => departments.find((d) => d.code === code)?.headUserId
  const member = (code: string, n = 1) => staff.filter((u) => u.departmentId === depId(code) && u.loginStatus !== 'none')[n]?.id ?? head(code)
  const has = (code: string) => def.depts.includes(code)
  const taskSeeds: [string, string, string, WorkPriority, number, number, string | undefined, WorkTask['status'], string?][] = [
    ['Fix dripping tap', 'Guest says the bathroom tap drips all night.', 'ENG', 'High', 30, 24, member('ENG', 1), 'open', '204'],
    ['Replace corridor bulbs, floor 2', 'Three bulbs out near the lift.', 'ENG', 'Normal', 10, 72, member('ENG', 0), 'in-progress'],
    ['Extra towels and pillows', 'Family of four, two extra pillows.', 'HK', 'Urgent', 1.5, 1, member('HK', 1), 'open', '102'],
    ['Deep clean conference room', 'For tomorrow morning meeting.', 'HK', 'Normal', 3, 24, member('HK', 2), 'in-progress'],
    ['Prepare airport pick-up board', 'Mr Mugisha, flight UR 222 at 18:40.', 'FO', 'High', 2, 4, member('FO', 0), 'open'],
    ['Call guest about late arrival', 'Confirm arrival after midnight.', 'FO', 'Normal', 6, 24, member('FO', 1), 'done'],
    ['Restock minibar on floor 2', 'Rooms 201 to 206.', has('FB') ? 'FB' : 'HK', 'Normal', 5, 24, undefined, 'open'],
    ['Check CCTV at the back gate', 'Camera 4 shows no picture.', has('SEC') ? 'SEC' : 'ENG', 'High', 9, 4, undefined, 'open'],
    ['Birthday cake for room 203', 'Chocolate, small, with candles, for 19:00.', has('KIT') ? 'KIT' : 'FB', 'High', 1, 6, member(has('KIT') ? 'KIT' : 'FB', 0), 'open', '203'],
  ]
  const tasks: WorkTask[] = taskSeeds
    .filter(([, , code]) => has(code))
    .map(([title, description, code, priority, hoursAgo, dueHours, assignee, status, room], i) => {
      const createdAt = ago(hoursAgo)
      return {
        id: `${pid}-tk-${String(i + 1).padStart(3, '0')}`,
        propertyId: pid,
        title,
        description,
        departmentId: depId(code),
        assigneeUserId: assignee,
        priority,
        status,
        roomNumber: room,
        createdAt,
        createdBy: SYSTEM,
        dueAt: new Date(Date.parse(createdAt) + dueHours * HOUR).toISOString(),
        startedAt: status !== 'open' ? ago(hoursAgo - 0.5) : undefined,
        completedAt: status === 'done' ? ago(1) : undefined,
        completedBy: status === 'done' ? { id: assignee ?? 'system', name: staff.find((u) => u.id === assignee)?.fullName ?? 'Staff' } : undefined,
        escalationLevel: 0,
      }
    })

  // Service cases, linked to guests in the house.
  const desk: Actor = { id: staff.find((u) => u.departmentId === depId('FO'))?.id ?? 'system', name: staff.find((u) => u.departmentId === depId('FO'))?.fullName ?? 'Front desk' }
  const gm = staff.find((u) => u.roles.includes('gm')) ?? staff.find((u) => u.roles.includes('owner'))
  const gmActor: Actor = gm ? { id: gm.id, name: gm.fullName } : SYSTEM
  const cases: ServiceCase[] = [
    {
      id: `${pid}-cs-1`, propertyId: pid, caseNo: 'SC-0101', source: 'desk', category: 'complaint',
      reservationId: 'R-1052', guestId: 'G-10', guestName: 'Ruth Nabirye', roomNumber: '204',
      departmentId: depId('ENG'), ownerUserId: member('ENG', 1), priority: 'High',
      title: 'Air conditioning noisy at night', detail: 'Guest could not sleep. Asked for it to be fixed or a room move.',
      status: 'in-progress', createdAt: ago(20), createdBy: desk, dueAt: ago(-4),
      compensation: { kind: 'discount', description: 'One night at 30% off', amount: 63000, status: 'proposed', proposedBy: desk, proposedAt: ago(18) },
    },
    {
      id: `${pid}-cs-2`, propertyId: pid, caseNo: 'SC-0102', source: 'phone', category: 'recovery',
      reservationId: 'R-1041', guestId: 'G-5', guestName: 'Peter Mugisha', roomNumber: '203',
      departmentId: depId(has('FB') ? 'FB' : 'KIT'), ownerUserId: head(has('FB') ? 'FB' : 'KIT'), priority: 'Normal',
      title: 'Room service breakfast 50 minutes late', detail: 'Ordered at 07:10, arrived 08:00 and cold.',
      status: 'resolved', createdAt: ago(28), createdBy: desk, dueAt: ago(4),
      compensation: { kind: 'free-item', description: 'Breakfast taken off the bill', amount: 35000, status: 'approved', proposedBy: desk, proposedAt: ago(27), decidedBy: gmActor, decidedAt: ago(26) },
      resolution: 'Apologised, breakfast removed from the folio, kitchen briefed on room service timing.', resolvedAt: ago(25), resolvedBy: gmActor,
    },
    {
      id: `${pid}-cs-3`, propertyId: pid, caseNo: 'SC-0103', source: 'desk', category: 'request',
      reservationId: 'R-1043', guestId: 'G-4', guestName: 'David Okello', roomNumber: '102',
      departmentId: depId('HK'), ownerUserId: head('HK'), priority: 'Normal',
      title: 'Iron and ironing board', detail: 'Before a meeting tomorrow morning.',
      status: 'open', createdAt: ago(2), createdBy: desk, dueAt: ago(-22),
    },
  ]
  const caseActions: CaseAction[] = cases.flatMap((c, i) => [
    { id: `${pid}-ca-${i}-0`, propertyId: pid, caseId: c.id, at: c.createdAt, by: c.createdBy, kind: 'created' as const, note: `Logged from ${c.source === 'desk' ? 'the front desk' : 'a phone call'}` },
    ...(c.compensation ? [{ id: `${pid}-ca-${i}-1`, propertyId: pid, caseId: c.id, at: c.compensation.proposedAt, by: c.compensation.proposedBy, kind: 'compensation' as const, note: `Proposed: ${c.compensation.description}` }] : []),
    ...(c.resolvedAt ? [{ id: `${pid}-ca-${i}-2`, propertyId: pid, caseId: c.id, at: c.resolvedAt, by: c.resolvedBy!, kind: 'resolved' as const, note: c.resolution ?? '' }] : []),
  ])

  // Last month already went to Trademate.
  const store: Store = {
    departments, staff, links, trademate, templates, shifts, events, tasks,
    escalations: [], notifications: [], cases, caseActions, exports: [],
    approvals: new Map(), counter: 1000,
  }
  const last = previousPeriod(monthPeriod(TODAY))
  const lines = staff
    .filter((u) => links.some((l) => l.userId === u.id))
    .map((u) => {
      const ts = buildTimesheet(pid, u.id, last, shifts, templates, events, now)
      return {
        userId: u.id,
        trademateEmployeeId: links.find((l) => l.userId === u.id)!.trademateEmployeeId,
        fullName: u.fullName,
        regularHours: ts.workedHours,
        overtimeHours: ts.overtimeHours,
        nightHours: ts.nightHours,
        absentDays: ts.absentDays,
        lateCount: ts.lateCount,
      }
    })
    .filter((l) => l.regularHours + l.overtimeHours > 0)
  store.exports.push({
    id: `${pid}-px-1`, propertyId: pid, periodStart: last.start, periodEnd: last.end, status: 'acknowledged', lines,
    sentAt: new Date(Date.parse(addDaysYmd(last.end, 2) + 'T10:15:00')).toISOString(), sentBy: gmActor,
    trademateBatchRef: `TM-PAY-${last.start.slice(0, 7).replace('-', '')}-${pid.toUpperCase()}`,
  })
  for (const u of staff) store.approvals.set(`${u.id}|${last.start}`, { at: store.exports[0].sentAt!, by: gmActor })
  // A couple of delivered messages so the queue is not empty before anything happens.
  store.notifications.push(
    { id: `${pid}-nt-r1`, propertyId: pid, toLabel: 'All staff', channel: 'push', title: 'Roster published', body: `This week's roster from ${dayWords(thisWeek)} is out.`, createdAt: new Date(Date.parse(addDaysYmd(thisWeek, -3) + 'T16:00:00')).toISOString(), status: 'sent', sentAt: new Date(Date.parse(addDaysYmd(thisWeek, -3) + 'T16:00:05')).toISOString(), entity: { kind: 'roster', id: thisWeek } },
  )
  return store
}

export function createMockWorkforceService(): WorkforceService {
  const stores = new Map<string, Store>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  function store(pid: string): Store {
    let st = stores.get(pid)
    if (!st) {
      st = seedProperty(pid, Date.now())
      stores.set(pid, st)
      escalate(st, { on: true, secondStepAt: 2 }, Date.now())
    }
    return st
  }
  const nextId = (st: Store, prefix: string) => `${prefix}-${++st.counter}`
  const nowIso = () => new Date().toISOString()
  const fail = (msg: string) => Promise.reject(new Error(msg))
  const userName = (st: Store, id?: string) => st.staff.find((u) => u.id === id)?.fullName

  function notify(st: Store, n: Omit<WorkNotification, 'id' | 'propertyId' | 'createdAt' | 'status'>, at = nowIso()) {
    const user = n.userId ? st.staff.find((u) => u.id === n.userId) : undefined
    // No phone app without a login: the message waits as failed so somebody tells them in person.
    const status: WorkNotification['status'] = user && user.loginStatus !== 'active' ? 'failed' : 'queued'
    st.notifications.unshift({ ...n, id: nextId(st, 'NT'), propertyId: st.departments[0]?.propertyId ?? '', createdAt: at, status })
  }

  function escalate(st: Store, rule: { on: boolean; secondStepAt: number }, now: number): number {
    let raised = 0
    for (const t of st.tasks) {
      const step = escalationStep(t, rule, now)
      while (t.escalationLevel < step) {
        const level = (t.escalationLevel + 1) as 1 | 2
        const dept = st.departments.find((d) => d.id === t.departmentId)
        const gm = st.staff.find((u) => u.roles.includes('gm')) ?? st.staff.find((u) => u.roles.includes('owner'))
        const to = level === 1 ? dept?.headUserId : gm?.id
        const at = new Date(Math.min(now, escalationTime(t, level, rule))).toISOString()
        const toLabel = level === 1 ? `${dept?.name ?? 'Department'} head` : 'General manager'
        const reason = level === 1 ? 'Past its due time' : `Past its due time by ${rule.secondStepAt} times the time allowed`
        st.escalations.unshift({ id: nextId(st, 'ES'), propertyId: t.propertyId, taskId: t.id, level, at, toUserId: to, toLabel, reason })
        notify(st, { userId: to, toLabel: userName(st, to) ?? toLabel, channel: 'push', title: `Overdue: ${t.title}`, body: `${reason}. ${t.roomNumber ? `Room ${t.roomNumber}. ` : ''}${userName(st, t.assigneeUserId) ?? 'Nobody'} has it.`, entity: { kind: 'task', id: t.id } }, at)
        t.escalationLevel = level
        raised += 1
      }
    }
    // Messages older than a minute have been handed to the phone service by now.
    for (const n of st.notifications) if (n.status === 'queued' && now - Date.parse(n.createdAt) > 60000) {
      n.status = 'sent'
      n.sentAt = new Date(Date.parse(n.createdAt) + 4000).toISOString()
    }
    // Trademate confirms a batch a little after it arrives.
    for (const x of st.exports) if (x.status === 'sent' && x.sentAt && now - Date.parse(x.sentAt) > 30000) x.status = 'acknowledged'
    return raised
  }

  const findStaff = (st: Store, id: string) => st.staff.find((u) => u.id === id)
  const findTask = (st: Store, id: string) => st.tasks.find((t) => t.id === id)
  const findCase = (st: Store, id: string) => st.cases.find((c) => c.id === id)
  const logCase = (st: Store, c: ServiceCase, kind: CaseAction['kind'], note: string, by: Actor) =>
    st.caseActions.unshift({ id: nextId(st, 'CA'), propertyId: c.propertyId, caseId: c.id, at: nowIso(), by, kind, note })

  function copy(st: Store): WorkforceSnapshot {
    return {
      departments: [...st.departments],
      staff: [...st.staff],
      links: [...st.links],
      trademate: [...st.trademate],
      templates: [...st.templates],
      shifts: [...st.shifts],
      events: [...st.events],
      tasks: [...st.tasks],
      escalations: [...st.escalations],
      notifications: [...st.notifications],
      cases: [...st.cases],
      caseActions: [...st.caseActions],
      exports: [...st.exports],
    }
  }

  function timesheets(st: Store, pid: string, period: { start: string; end: string }, now: number) {
    return st.staff
      .filter((u) => u.active)
      .map((u) => {
        const ts = buildTimesheet(pid, u.id, period, st.shifts, st.templates, st.events, now)
        const ok = st.approvals.get(`${u.id}|${period.start}`)
        return { ...ts, id: `${u.id}|${period.start}`, status: ok ? ('approved' as const) : ('open' as const), approvedAt: ok?.at, approvedBy: ok?.by }
      })
  }

  const done = <T,>(v: T) => {
    emit()
    return Promise.resolve(v)
  }

  return {
    load: (pid) => Promise.resolve(copy(store(pid))),

    addStaff(pid, input, actor) {
      const st = store(pid)
      const fullName = input.fullName.trim()
      if (fullName.split(/\s+/).length < 2) return fail('Enter the first and last name')
      if (!input.jobTitle.trim()) return fail('Enter a job title')
      if (!st.departments.some((d) => d.id === input.departmentId)) return fail('Choose a department')
      if (st.staff.some((u) => u.fullName.toLowerCase() === fullName.toLowerCase())) return fail(`${fullName} is already on the staff list`)
      const user: StaffUser = {
        id: nextId(st, `${pid}-usr`),
        propertyId: pid,
        fullName,
        phone: input.phone.trim(),
        email: input.email?.trim() || undefined,
        jobTitle: input.jobTitle.trim(),
        departmentId: input.departmentId,
        allocations: [],
        roles: input.roles,
        loginStatus: input.roles.length && input.email?.trim() ? 'invited' : 'none',
        contractType: input.contractType,
        active: true,
      }
      st.staff.push(user)
      void actor
      return done(user)
    },

    updateStaff(pid, userId, patch, actor) {
      const st = store(pid)
      const u = findStaff(st, userId)
      if (!u) return fail('Staff member not found')
      if (patch.allocations) {
        const total = patch.allocations.reduce((n, a) => n + a.percent, 0)
        if (patch.allocations.some((a) => a.percent <= 0 || a.percent > 90)) return fail('Each share must be between 1% and 90%')
        if (total >= 100) return fail('Other departments must leave some time for the home department')
        if (patch.allocations.some((a) => a.departmentId === (patch.departmentId ?? u.departmentId))) return fail('The home department is not an extra allocation')
      }
      if (patch.fullName !== undefined && patch.fullName.trim().split(/\s+/).length < 2) return fail('Enter the first and last name')
      Object.assign(u, { ...patch, fullName: patch.fullName?.trim() ?? u.fullName })
      void actor
      return done({ ...u })
    },

    setLoginStatus(pid, userId, status, actor) {
      const st = store(pid)
      const u = findStaff(st, userId)
      if (!u) return fail('Staff member not found')
      if (u.id === actor.id && status === 'disabled') return fail('You cannot disable your own login')
      if (status === 'invited' && !u.email) return fail('Add an email address before sending an invitation')
      if (status === 'invited' && !u.roles.length) return fail('Give a role before sending an invitation')
      u.loginStatus = status
      return done({ ...u })
    },

    linkEmployee(pid, userId, tmId, actor) {
      const st = store(pid)
      if (!findStaff(st, userId)) return fail('Staff member not found')
      if (!st.trademate.some((t) => t.trademateEmployeeId === tmId)) return fail('That Trademate employee was not found')
      const other = st.links.find((l) => l.trademateEmployeeId === tmId && l.userId !== userId)
      if (other) return fail(`That Trademate record is already linked to ${userName(st, other.userId)}`)
      st.links = st.links.filter((l) => l.userId !== userId)
      const link: EmployeeLink = { id: nextId(st, 'LNK'), propertyId: pid, userId, trademateEmployeeId: tmId, linkedAt: nowIso(), linkedBy: actor }
      st.links.push(link)
      return done(link)
    },

    unlinkEmployee(pid, userId) {
      const st = store(pid)
      st.links = st.links.filter((l) => l.userId !== userId)
      return done(undefined)
    },

    setShift(pid, userId, workDate, templateId, actor) {
      const st = store(pid)
      const u = findStaff(st, userId)
      if (!u) return fail('Staff member not found')
      if (workDate < TODAY) return fail('Past days cannot be changed. Correct attendance instead.')
      if (templateId && !st.templates.some((t) => t.id === templateId)) return fail('Unknown shift')
      const existing = st.shifts.find((r) => r.userId === userId && r.workDate === workDate)
      st.shifts = st.shifts.filter((r) => r !== existing)
      if (!templateId) return done(null)
      const shift: RosterShift = {
        id: nextId(st, 'RS'),
        propertyId: pid,
        userId,
        departmentId: u.departmentId,
        workDate,
        shiftTemplateId: templateId,
        status: 'draft',
      }
      st.shifts.push(shift)
      void actor
      return done(shift)
    },

    publishWeek(pid, ws, departmentId, actor) {
      const st = store(pid)
      const days = weekDays(ws)
      const list = st.shifts.filter((r) => r.status === 'draft' && days.includes(r.workDate) && (!departmentId || r.departmentId === departmentId))
      if (!list.length) return fail('Nothing new to publish this week')
      const at = nowIso()
      for (const r of list) Object.assign(r, { status: 'published', publishedAt: at, publishedBy: actor })
      for (const uid of new Set(list.map((r) => r.userId))) {
        const n = list.filter((r) => r.userId === uid).length
        notify(st, { userId: uid, toLabel: userName(st, uid) ?? 'Staff', channel: 'push', title: 'Your roster is out', body: `${n} shift${n === 1 ? '' : 's'} in the week from ${dayWords(ws)}.`, entity: { kind: 'roster', id: ws } })
      }
      return done(list.length)
    },

    copyPreviousWeek(pid, ws, departmentId) {
      const st = store(pid)
      const prev = weekDays(addDaysYmd(ws, -7))
      let n = 0
      for (const r of st.shifts.filter((x) => prev.includes(x.workDate) && (!departmentId || x.departmentId === departmentId))) {
        const day = addDaysYmd(r.workDate, 7)
        if (day < TODAY || st.shifts.some((x) => x.userId === r.userId && x.workDate === day)) continue
        st.shifts.push({ ...r, id: nextId(st, 'RS'), workDate: day, status: 'draft', publishedAt: undefined, publishedBy: undefined })
        n += 1
      }
      if (!n) return fail('Every day is already filled, or last week was empty')
      return done(n)
    },

    clock(pid, userId, workDate, kind, actor) {
      const st = store(pid)
      if (!findStaff(st, userId)) return fail('Staff member not found')
      const mine = st.events.filter((e) => e.userId === userId && e.workDate === workDate && !e.absence)
      if (kind === 'in' && mine.some((e) => e.kind === 'in')) return fail('Already clocked in')
      if (kind === 'out' && !mine.some((e) => e.kind === 'in')) return fail('Clock in first')
      if (kind === 'out' && mine.some((e) => e.kind === 'out')) return fail('Already clocked out')
      const e: AttendanceEvent = { id: nextId(st, 'EV'), propertyId: pid, userId, workDate, kind, at: nowIso(), source: actor.id === userId ? 'clock' : 'manual', recordedBy: actor }
      st.events.push(e)
      return done(e)
    },

    correct(pid, input, actor) {
      const st = store(pid)
      if (!findStaff(st, input.userId)) return fail('Staff member not found')
      if (input.reason.trim().length < 5) return fail('Give the reason for the correction')
      if (!input.approver?.id) return fail('Choose who approved it')
      if (input.approver.id === input.userId) return fail('Nobody approves their own correction')
      if (!input.inTime && !input.outTime && !input.absence) return fail('Enter a time or an absence')
      const shift = st.shifts.find((r) => r.userId === input.userId && r.workDate === input.workDate)
      const tpl = st.templates.find((t) => t.id === shift?.shiftTemplateId)
      const toIso = (hm: string, kind: 'in' | 'out') => {
        const [h, m] = hm.split(':').map(Number)
        const d = new Date(input.workDate + 'T00:00:00')
        d.setHours(h, m, 0, 0)
        // A night shift's clock-out is on the next morning.
        if (kind === 'out' && tpl && tpl.endTime < tpl.startTime && hm < tpl.startTime) d.setDate(d.getDate() + 1)
        return d
      }
      if (input.inTime && input.outTime) {
        if (toIso(input.outTime, 'out') <= toIso(input.inTime, 'in')) return fail('The clock-out must be after the clock-in')
      }
      const made: AttendanceEvent[] = []
      const base = { propertyId: pid, userId: input.userId, workDate: input.workDate, source: 'correction' as const, reason: input.reason.trim(), recordedBy: actor, approvedBy: input.approver }
      if (input.absence) {
        st.events = st.events.filter((e) => !(e.userId === input.userId && e.workDate === input.workDate && e.absence))
        made.push({ ...base, id: nextId(st, 'EV'), kind: 'in', at: nowIso(), absence: input.absence })
      } else {
        // A time entered clears an absence recorded earlier for the same day.
        st.events = st.events.filter((e) => !(e.userId === input.userId && e.workDate === input.workDate && e.absence))
        if (input.inTime) made.push({ ...base, id: nextId(st, 'EV'), kind: 'in', at: toIso(input.inTime, 'in').toISOString() })
        if (input.outTime) made.push({ ...base, id: nextId(st, 'EV'), kind: 'out', at: toIso(input.outTime, 'out').toISOString() })
      }
      st.events.push(...made)
      st.approvals.delete(`${input.userId}|${monthPeriod(input.workDate).start}`)
      return done(made)
    },

    listTimesheets: (pid, period, now) => Promise.resolve(timesheets(store(pid), pid, period, now)),

    approveTimesheet(pid, userId, period, actor) {
      const st = store(pid)
      if (userId === actor.id) return fail('Nobody approves their own timesheet')
      if (st.exports.some((x) => x.periodStart === period.start && x.status !== 'failed')) return fail('This period has already gone to Trademate')
      st.approvals.set(`${userId}|${period.start}`, { at: nowIso(), by: actor })
      return done(undefined)
    },

    createTask(pid, input, actor) {
      const st = store(pid)
      const title = input.title.trim()
      if (title.length < 3) return fail('Give the task a short title')
      if (!st.departments.some((d) => d.id === input.departmentId)) return fail('Choose the department responsible')
      if (!(input.dueInHours > 0)) return fail('The due time must be in the future')
      const at = Date.now()
      const task: WorkTask = {
        id: nextId(st, `${pid}-tk`),
        propertyId: pid,
        title,
        description: input.description.trim(),
        departmentId: input.departmentId,
        assigneeUserId: input.assigneeUserId || undefined,
        priority: input.priority,
        status: 'open',
        roomNumber: input.roomNumber?.trim() || undefined,
        caseId: input.caseId,
        createdAt: new Date(at).toISOString(),
        createdBy: actor,
        dueAt: new Date(at + input.dueInHours * HOUR).toISOString(),
        escalationLevel: 0,
      }
      st.tasks.unshift(task)
      if (task.assigneeUserId) notify(st, { userId: task.assigneeUserId, toLabel: userName(st, task.assigneeUserId) ?? '', channel: 'push', title: `New task: ${title}`, body: `${task.priority}. ${task.roomNumber ? `Room ${task.roomNumber}. ` : ''}Due ${new Date(task.dueAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`, entity: { kind: 'task', id: task.id } })
      if (input.caseId) {
        const c = findCase(st, input.caseId)
        if (c) logCase(st, c, 'task', `Task created: ${title}`, actor)
      }
      return done(task)
    },

    assignTask(pid, taskId, userId, actor) {
      const st = store(pid)
      const t = findTask(st, taskId)
      if (!t) return fail('Task not found')
      if (t.status === 'done') return fail('The task is already done')
      t.assigneeUserId = userId ?? undefined
      if (userId) notify(st, { userId, toLabel: userName(st, userId) ?? '', channel: 'push', title: `Task for you: ${t.title}`, body: `Given by ${actor.name}.`, entity: { kind: 'task', id: t.id } })
      return done({ ...t })
    },

    setTaskStatus(pid, taskId, status, actor) {
      const st = store(pid)
      const t = findTask(st, taskId)
      if (!t) return fail('Task not found')
      if (status === 'in-progress' && !t.assigneeUserId) return fail('Give the task to somebody first')
      t.status = status
      if (status === 'in-progress' && !t.startedAt) t.startedAt = nowIso()
      if (status === 'done') Object.assign(t, { completedAt: nowIso(), completedBy: actor })
      else Object.assign(t, { completedAt: undefined, completedBy: undefined })
      return done({ ...t })
    },

    runEscalations(pid, rule, now) {
      const st = store(pid)
      const n = escalate(st, rule, now)
      if (n) emit()
      return Promise.resolve(n)
    },

    markNotificationsRead(pid, ids) {
      const st = store(pid)
      for (const n of st.notifications) if (ids.includes(n.id) && n.status === 'sent') Object.assign(n, { status: 'read', readAt: nowIso() })
      return done(undefined)
    },

    retryNotification(pid, id) {
      const st = store(pid)
      const n = st.notifications.find((x) => x.id === id)
      if (!n) return fail('Message not found')
      const u = n.userId ? findStaff(st, n.userId) : undefined
      if (u && u.loginStatus !== 'active') return fail(`${u.fullName} has no active login, so there is no phone to send to`)
      n.status = 'queued'
      n.createdAt = nowIso()
      return done(undefined)
    },

    createCase(pid, input, actor) {
      const st = store(pid)
      if (input.guestName.trim().length < 2) return fail('Enter the guest')
      if (input.title.trim().length < 3) return fail('Say in a few words what happened')
      if (!st.departments.some((d) => d.id === input.departmentId)) return fail('Choose the department responsible')
      if (input.guestRequestId && st.cases.some((c) => c.guestRequestId === input.guestRequestId)) return fail('That guest request is already a case')
      const at = Date.now()
      const n = st.cases.length + 101
      const c: ServiceCase = {
        id: nextId(st, `${pid}-cs`),
        propertyId: pid,
        caseNo: `SC-${String(n).padStart(4, '0')}`,
        ...input,
        guestName: input.guestName.trim(),
        title: input.title.trim(),
        detail: input.detail.trim(),
        roomNumber: input.roomNumber || undefined,
        ownerUserId: input.ownerUserId || undefined,
        status: 'open',
        createdAt: new Date(at).toISOString(),
        createdBy: actor,
        dueAt: new Date(at + input.dueInHours * HOUR).toISOString(),
      }
      st.cases.unshift(c)
      logCase(st, c, 'created', input.guestRequestId ? `Imported from portal request ${input.guestRequestId}` : `Logged from ${input.source}`, actor)
      const dept = st.departments.find((d) => d.id === c.departmentId)
      const to = c.ownerUserId ?? dept?.headUserId
      notify(st, { userId: to, toLabel: userName(st, to) ?? dept?.name ?? '', channel: 'push', title: `Guest case ${c.caseNo}`, body: `${c.title}${c.roomNumber ? `, room ${c.roomNumber}` : ''}.`, entity: { kind: 'case', id: c.id } })
      return done(c)
    },

    assignCase(pid, caseId, departmentId, ownerUserId, actor) {
      const st = store(pid)
      const c = findCase(st, caseId)
      if (!c) return fail('Case not found')
      if (c.status === 'closed') return fail('The case is closed')
      c.departmentId = departmentId
      c.ownerUserId = ownerUserId ?? undefined
      const dept = st.departments.find((d) => d.id === departmentId)
      logCase(st, c, 'assigned', `${dept?.name ?? 'Department'}${ownerUserId ? `, ${userName(st, ownerUserId)}` : ''}`, actor)
      if (ownerUserId) notify(st, { userId: ownerUserId, toLabel: userName(st, ownerUserId) ?? '', channel: 'push', title: `Case ${c.caseNo} is yours`, body: c.title, entity: { kind: 'case', id: c.id } })
      return done({ ...c })
    },

    setCaseStatus(pid, caseId, status, actor) {
      const st = store(pid)
      const c = findCase(st, caseId)
      if (!c) return fail('Case not found')
      if (status === 'closed' && !c.resolution) return fail('Resolve the case before closing it')
      if (status === 'closed' && c.compensation?.status === 'proposed') return fail('Decide the compensation before closing')
      c.status = status
      logCase(st, c, 'status', `Status: ${status}`, actor)
      return done({ ...c })
    },

    addCaseNote(pid, caseId, note, actor) {
      const st = store(pid)
      const c = findCase(st, caseId)
      if (!c) return fail('Case not found')
      if (!note.trim()) return fail('Write a note')
      logCase(st, c, 'note', note.trim(), actor)
      return done(undefined)
    },

    proposeCompensation(pid, caseId, input, actor) {
      const st = store(pid)
      const c = findCase(st, caseId)
      if (!c) return fail('Case not found')
      if (c.status === 'closed') return fail('The case is closed')
      if (c.compensation && c.compensation.status !== 'declined') return fail('There is already an offer on this case')
      if (!input.description.trim()) return fail('Describe what is offered')
      if (input.amount < 0 || !Number.isFinite(input.amount)) return fail('Enter the value in UGX')
      c.compensation = { ...input, description: input.description.trim(), status: 'proposed', proposedBy: actor, proposedAt: nowIso() }
      logCase(st, c, 'compensation', `Proposed: ${input.description.trim()}`, actor)
      const gm = st.staff.find((u) => u.roles.includes('gm')) ?? st.staff.find((u) => u.roles.includes('owner'))
      notify(st, { userId: gm?.id, toLabel: gm?.fullName ?? 'Manager', channel: 'push', title: `Approve compensation, ${c.caseNo}`, body: `${input.description.trim()} for ${c.guestName}.`, entity: { kind: 'case', id: c.id } })
      return done({ ...c })
    },

    decideCompensation(pid, caseId, approve, note, actor) {
      const st = store(pid)
      const c = findCase(st, caseId)
      if (!c?.compensation) return fail('No offer to decide')
      if (c.compensation.status !== 'proposed') return fail('The offer was already decided')
      if (c.compensation.proposedBy.id === actor.id) return fail('Someone else must approve an offer you made')
      if (!approve && !note.trim()) return fail('Give a reason for declining')
      c.compensation = { ...c.compensation, status: approve ? 'approved' : 'declined', decidedBy: actor, decidedAt: nowIso(), note: note.trim() || undefined }
      logCase(st, c, 'compensation', `${approve ? 'Approved' : 'Declined'}: ${c.compensation.description}${note.trim() ? ` (${note.trim()})` : ''}`, actor)
      return done({ ...c })
    },

    resolveCase(pid, caseId, resolution, actor) {
      const st = store(pid)
      const c = findCase(st, caseId)
      if (!c) return fail('Case not found')
      if (resolution.trim().length < 5) return fail('Say how it was resolved')
      Object.assign(c, { status: 'resolved', resolution: resolution.trim(), resolvedAt: nowIso(), resolvedBy: actor })
      logCase(st, c, 'resolved', resolution.trim(), actor)
      return done({ ...c })
    },

    recordFollowUp(pid, caseId, outcome, note, actor) {
      const st = store(pid)
      const c = findCase(st, caseId)
      if (!c) return fail('Case not found')
      if (c.status !== 'resolved' && c.status !== 'closed') return fail('Follow up once the case is resolved')
      c.followUp = { outcome, note: note.trim(), at: nowIso(), by: actor }
      // An unhappy guest reopens the case rather than closing it.
      if (outcome === 'not-satisfied') c.status = 'in-progress'
      logCase(st, c, 'follow-up', `Guest ${outcome === 'satisfied' ? 'satisfied' : outcome === 'not-satisfied' ? 'not satisfied, case reopened' : 'did not answer'}${note.trim() ? `: ${note.trim()}` : ''}`, actor)
      return done({ ...c })
    },

    sendPayroll(pid, period, now, actor) {
      const st = store(pid)
      if (st.exports.some((x) => x.periodStart === period.start && x.status !== 'failed')) return fail('This period was already sent to Trademate')
      const sheets = timesheets(st, pid, period, now).filter((t) => t.workedHours + t.overtimeHours > 0 || t.absentDays > 0)
      const unlinked = sheets.filter((t) => !st.links.some((l) => l.userId === t.userId))
      if (unlinked.length) return fail(`Link ${unlinked.length} staff to Trademate first: ${unlinked.map((t) => userName(st, t.userId)).join(', ')}`)
      if (!sheets.length) return fail('No hours in this period')
      const lines = sheets.map((t) => ({
        userId: t.userId,
        trademateEmployeeId: st.links.find((l) => l.userId === t.userId)!.trademateEmployeeId,
        fullName: userName(st, t.userId) ?? '',
        regularHours: t.workedHours,
        overtimeHours: t.overtimeHours,
        nightHours: t.nightHours,
        absentDays: t.absentDays,
        lateCount: t.lateCount,
      }))
      st.exports = st.exports.filter((x) => !(x.periodStart === period.start && x.status === 'failed'))
      const exp: PayrollExport = {
        id: nextId(st, 'PX'),
        propertyId: pid,
        periodStart: period.start,
        periodEnd: period.end,
        status: 'sent',
        lines,
        sentAt: nowIso(),
        sentBy: actor,
        trademateBatchRef: `TM-PAY-${period.start.slice(0, 7).replace('-', '')}-${pid.toUpperCase()}`,
      }
      st.exports.unshift(exp)
      for (const t of sheets) if (!st.approvals.has(`${t.userId}|${period.start}`)) st.approvals.set(`${t.userId}|${period.start}`, { at: nowIso(), by: actor })
      return done(exp)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
