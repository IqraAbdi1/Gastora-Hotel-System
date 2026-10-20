import type { FeatureKey } from '../../lib/features'
import type { Action } from '../../lib/roles'
import { debtors } from '../../lib/dashboard'
import {
  RANGE_LABEL,
  addDays,
  cancellationsIn,
  daysOf,
  drill,
  execKpis,
  inRange,
  pickupList,
  rangeFor,
} from './analytics'
import type { DrillRow, Range } from './analytics'
import type { AnalyticsAssistant, AnswerSource, AssistantAnswer, AssistantContext } from './analyticsAssistant'
import { daySeries } from '../../lib/dashboard'

// A deterministic stand-in for a language model: it recognises the common management questions by
// their words, works the answer out from the hotel's records, and shows the rows it used.

type Intent =
  | 'fnb'
  | 'topGuests'
  | 'workOrders'
  | 'lowStock'
  | 'cancellations'
  | 'owed'
  | 'gop'
  | 'pickup'
  | 'revpar'
  | 'adr'
  | 'occupancy'
  | 'revenue'

const PATTERNS: [Intent, RegExp][] = [
  ['fnb', /\b(f&b|f and b|food|drinks?|restaurant|bar|outlets?|pos|till)\b/],
  ['topGuests', /\b(top|best|biggest|most valuable)\b.*\bguests?\b|\bguests?\b.*\b(spent|spend|most)\b/],
  ['workOrders', /\b(work ?orders?|repairs?|maintenance|broken|faults?|defects?)\b/],
  ['lowStock', /\b(low stock|stock|reorder|running out|inventory|store)\b/],
  ['cancellations', /\b(cancel\w*|no[- ]?shows?)\b/],
  ['owed', /\b(owe[sd]?|owing|debts?|debtors?|outstanding|unpaid|ageing|aging|receivables?)\b/],
  ['gop', /\b(gop|goppar|profit|margin)\b/],
  ['pickup', /\b(pick ?up|pace|on the books|new bookings)\b/],
  ['revpar', /\b(revpar|rev par|revenue per available)\b/],
  ['adr', /\b(adr|average (daily |room )?rate|room rate)\b/],
  ['occupancy', /\b(occupancy|occupied|how full|rooms sold|full)\b/],
  ['revenue', /\b(revenue|takings|income|turnover|earn\w*|money|sales|sold)\b/],
]

type Need = { paths: string[]; action?: Action; feature?: FeatureKey; module: string }

const NEEDS: Record<Intent, Need> = {
  occupancy: { paths: ['/dashboard', '/desk/reservations'], module: 'reservations' },
  adr: { paths: ['/dashboard', '/desk/reservations'], module: 'reservations' },
  revpar: { paths: ['/dashboard', '/desk/reservations'], module: 'reservations' },
  revenue: { paths: ['/dashboard', '/desk/folios'], module: 'revenue' },
  pickup: { paths: ['/dashboard', '/desk/reservations'], module: 'reservations' },
  cancellations: { paths: ['/dashboard', '/desk/reservations'], module: 'reservations' },
  gop: { paths: ['/dashboard'], module: 'the management dashboard' },
  fnb: { paths: ['/pos', '/dashboard'], module: 'POS' },
  topGuests: { paths: ['/desk/guests'], action: 'seeGuestRecord', module: 'full guest records' },
  workOrders: { paths: ['/maintenance'], module: 'maintenance' },
  lowStock: { paths: ['/inventory'], feature: 'stockControl', module: 'stock' },
  owed: { paths: ['/desk/folios', '/finance', '/dashboard'], module: 'folios or finance' },
}

const LABEL: Record<Intent, string> = {
  occupancy: 'Occupancy',
  adr: 'Average room rate',
  revpar: 'RevPAR',
  revenue: 'Revenue',
  pickup: 'Pickup',
  cancellations: 'Cancellations',
  gop: 'Gross operating profit',
  fnb: 'F&B sales by outlet',
  topGuests: 'Top guests',
  workOrders: 'Overdue work orders',
  lowStock: 'Low stock',
  owed: 'Money owed',
}

const money = (n: number) => `UGX ${Math.round(n).toLocaleString('en-US')}`
const MAX_SOURCES = 25

export function detectIntent(q: string): Intent | null {
  const text = q.toLowerCase()
  for (const [intent, re] of PATTERNS) if (re.test(text)) return intent
  return null
}

/** The period a question asks about, and whether it named one at all. */
export function detectRange(q: string, today: string): { range: Range; label: string; given: boolean } {
  const t = q.toLowerCase()
  const n = t.match(/\b(?:last|past) (\d{1,3}) days?\b/)
  if (n) {
    const days = Math.max(1, Math.min(366, parseInt(n[1], 10)))
    return { range: { from: addDays(today, -(days - 1)), to: today }, label: `Last ${days} days`, given: true }
  }
  const preset = (p: keyof typeof RANGE_LABEL) => ({ range: rangeFor(p, today), label: RANGE_LABEL[p], given: true })
  if (/\byesterday\b|\blast night\b/.test(t)) return preset('yesterday')
  if (/\btomorrow\b/.test(t)) return { range: { from: addDays(today, 1), to: addDays(today, 1) }, label: 'Tomorrow', given: true }
  if (/\btoday\b|\btonight\b|\bnow\b|\bright now\b/.test(t)) return preset('today')
  if (/\bnext (week|7 days)\b/.test(t)) return preset('next7')
  if (/\bnext (month|30 days)\b/.test(t)) return preset('next30')
  if (/\blast month\b/.test(t)) {
    const first = `${today.slice(0, 8)}01`
    const end = addDays(first, -1)
    return { range: { from: `${end.slice(0, 8)}01`, to: end }, label: 'Last month', given: true }
  }
  if (/\b(this month|month to date|mtd)\b/.test(t)) return preset('mtd')
  if (/\b(last 30|past month|30 days)\b/.test(t)) return preset('30')
  if (/\b(this week|last week|past week|7 days|week)\b/.test(t)) return preset('7')
  if (/\b(this year|year to date|ytd)\b/.test(t))
    return { range: { from: `${today.slice(0, 4)}-01-01`, to: today }, label: 'Year to date', given: true }
  return { range: rangeFor('7', today), label: RANGE_LABEL['7'], given: false }
}

function allowed(need: Need, ctx: AssistantContext): string | null {
  const p = ctx.permissions
  if (need.feature && !p.features[need.feature]) return `This hotel does not use ${need.module}, so there is nothing to answer from.`
  if (!need.paths.some((x) => p.canOpen(x))) return `Your role cannot open ${need.module}, so I cannot answer that.`
  if (need.action && !p.can(need.action)) return `Your role cannot see ${need.module}, so I cannot answer that.`
  return null
}

function sourcesFrom(rows: DrillRow[], ctx: AssistantContext): AnswerSource[] {
  return rows.slice(0, MAX_SOURCES).map((r) => ({
    id: r.id,
    kind: r.kind,
    label: `${r.ref} · ${r.name}`,
    detail: `${r.date} · ${r.detail} · ${money(r.amount)}`,
    to: r.to && ctx.permissions.canOpen(r.to.split('?')[0]) ? r.to : undefined,
  }))
}

function link(to: string, ctx: AssistantContext) {
  return ctx.permissions.canOpen(to.split('?')[0]) ? to : undefined
}

function answer(intent: Intent, q: string, ctx: AssistantContext): AssistantAnswer {
  const { facts } = ctx
  const { range, label, given } = detectRange(q, facts.today)
  const base = { intent, understood: true, periodLabel: label }
  const days = daysOf(range)

  switch (intent) {
    case 'occupancy':
    case 'adr':
    case 'revpar': {
      const k = execKpis(facts, range, null)
      const points = daySeries(days.slice(-14), facts.reservations, facts.rooms, facts.sales, facts.today)
      const value = intent === 'occupancy' ? `${k.occupancy}%` : money(intent === 'adr' ? k.adr : k.revpar)
      const future = range.from > facts.today
      return {
        ...base,
        value,
        text:
          intent === 'occupancy'
            ? `${label}: ${k.sold} of ${k.available} room nights ${future ? 'are booked' : 'were sold'}, ${k.occupancy}% occupancy.`
            : intent === 'adr'
              ? `${label}: ${k.sold} room nights earned ${money(k.roomRevenue)}, an average of ${money(k.adr)} a night.`
              : `${label}: ${money(k.roomRevenue)} of room revenue over ${k.available} available room nights.`,
        table: {
          columns: [
            { key: 'day', label: 'Night' },
            { key: 'sold', label: 'Sold', align: 'right' },
            { key: 'occ', label: 'Occupancy', align: 'right' },
            { key: 'adr', label: 'ADR', align: 'right' },
          ],
          rows: points.map((p) => ({
            day: p.day,
            sold: `${p.occupied} / ${p.sellable}`,
            occ: `${p.sellable ? Math.round((p.occupied / p.sellable) * 100) : 0}%`,
            adr: p.occupied ? money(p.rooms / p.occupied) : '—',
          })),
        },
        sources: sourcesFrom(drill(facts, 'occupancy', range, null).rows, ctx),
      }
    }
    case 'revenue': {
      const k = execKpis(facts, range, null)
      return {
        ...base,
        value: money(k.totalRevenue),
        text: `${label}: ${money(k.totalRevenue)} in all. Rooms ${money(k.roomRevenue)}, food and drink ${money(k.fnbRevenue)}, extras ${money(k.extrasRevenue)}.`,
        table: {
          columns: [
            { key: 'line', label: 'Revenue' },
            { key: 'amount', label: 'Amount', align: 'right' },
          ],
          rows: [
            { line: 'Rooms', amount: money(k.roomRevenue) },
            { line: 'Food and drink', amount: money(k.fnbRevenue) },
            { line: 'Extras', amount: money(k.extrasRevenue) },
            { line: 'Total', amount: money(k.totalRevenue) },
          ],
        },
        sources: sourcesFrom(drill(facts, 'trevpar', range, null).rows, ctx),
        usesSample: facts.salesAreSample && k.fnbRevenue > 0,
      }
    }
    case 'gop': {
      const k = execKpis(facts, range, ctx.cost)
      return {
        ...base,
        value: money(k.gop),
        text: `${label}: revenue ${money(k.totalRevenue)} less operating costs ${money(k.costs)} leaves ${money(k.gop)}, a ${k.gopMargin}% margin. Costs are sample figures.`,
        table: {
          columns: [
            { key: 'line', label: 'Line' },
            { key: 'amount', label: 'Amount', align: 'right' },
          ],
          rows: [
            { line: 'Revenue', amount: money(k.totalRevenue) },
            { line: 'Operating costs', amount: money(-k.costs) },
            { line: 'GOP', amount: money(k.gop) },
            { line: 'GOPPAR', amount: money(k.goppar) },
          ],
        },
        sources: sourcesFrom(drill(facts, 'gop', range, ctx.cost).rows, ctx),
        usesSample: true,
      }
    }
    case 'pickup': {
      const list = pickupList(facts)
      const nights = list.reduce((n, r) => n + Math.max(1, Math.round((Date.parse(r.departure) - Date.parse(r.arrival)) / 86400000)), 0)
      return {
        ...base,
        periodLabel: 'Last 7 days',
        value: `${list.length}`,
        text: `${list.length} booking${list.length === 1 ? '' : 's'} taken in the last 7 days, ${nights} room nights worth ${money(list.reduce((n, r) => n + r.total, 0))}.`,
        sources: sourcesFrom(drill(facts, 'pickup', range, null).rows, ctx),
      }
    }
    case 'cancellations': {
      const list = cancellationsIn(facts, range)
      return {
        ...base,
        value: `${list.length}`,
        text: `${label}: ${list.length} cancellation${list.length === 1 ? '' : 's'} and no-shows.`,
        table: {
          columns: [
            { key: 'id', label: 'Booking' },
            { key: 'guest', label: 'Guest' },
            { key: 'status', label: 'Status' },
          ],
          rows: list.slice(0, 10).map((r) => ({ id: r.id, guest: r.guest, status: r.status })),
        },
        sources: sourcesFrom(drill(facts, 'cancellations', range, null).rows, ctx),
      }
    }
    case 'fnb': {
      const sales = facts.sales.filter((s) => inRange(s.createdAt.slice(0, 10), range))
      const by = new Map<string, { n: number; total: number }>()
      for (const s of sales) {
        const g = by.get(s.outlet) ?? { n: 0, total: 0 }
        g.n += 1
        g.total += s.total
        by.set(s.outlet, g)
      }
      const total = sales.reduce((n, s) => n + s.total, 0)
      return {
        ...base,
        value: money(total),
        text: `${label}: ${sales.length} sales worth ${money(total)}${facts.salesAreSample ? ' (sample till history, the till has recorded nothing yet)' : ''}.`,
        table: {
          columns: [
            { key: 'outlet', label: 'Outlet' },
            { key: 'n', label: 'Sales', align: 'right' },
            { key: 'avg', label: 'Average', align: 'right' },
            { key: 'total', label: 'Total', align: 'right' },
          ],
          rows: [...by.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([outlet, g]) => ({ outlet, n: `${g.n}`, avg: money(g.total / g.n), total: money(g.total) })),
        },
        sources: sales.slice(0, MAX_SOURCES).map((s) => ({
          id: s.id,
          kind: s.sample ? 'Till sale (sample)' : 'Till sale',
          label: `${s.id} · ${s.outlet}`,
          detail: `${s.createdAt.slice(0, 16).replace('T', ' ')} · ${s.payment} · ${money(s.total)}`,
          to: s.sample ? undefined : link('/pos/payments', ctx),
        })),
        usesSample: facts.salesAreSample,
      }
    }
    case 'topGuests': {
      const spend = new Map<string, { name: string; total: number; stays: number; ids: string[]; guestId?: string }>()
      for (const r of facts.reservations) {
        if (r.status !== 'in-house' && r.status !== 'checked-out') continue
        if (given && !(r.departure >= range.from && r.arrival <= range.to)) continue
        const key = r.guestId ?? r.guest
        const g = spend.get(key) ?? { name: r.guest, total: 0, stays: 0, ids: [], guestId: r.guestId }
        g.total += r.total
        g.stays += 1
        g.ids.push(r.id)
        spend.set(key, g)
      }
      const top = [...spend.values()].sort((a, b) => b.total - a.total).slice(0, 5)
      return {
        ...base,
        periodLabel: given ? label : 'All stays',
        value: top[0] ? top[0].name : '—',
        text: top.length ? `${top[0].name} has spent the most: ${money(top[0].total)} over ${top[0].stays} stay${top[0].stays === 1 ? '' : 's'}.` : 'No completed or current stays in that period.',
        table: {
          columns: [
            { key: 'name', label: 'Guest' },
            { key: 'stays', label: 'Stays', align: 'right' },
            { key: 'total', label: 'Spent', align: 'right' },
          ],
          rows: top.map((g) => ({ name: g.name, stays: `${g.stays}`, total: money(g.total) })),
        },
        sources: top.map((g) => ({
          id: g.guestId ?? g.name,
          kind: 'Guest',
          label: g.name,
          detail: `${g.ids.join(', ')} · ${money(g.total)}`,
          to: g.guestId ? link(`/desk/guests/${g.guestId}`, ctx) : undefined,
        })),
      }
    }
    case 'workOrders': {
      const open = facts.workOrders.filter((w) => w.status !== 'Resolved' && w.status !== 'Open')
      const overdue = open.filter((w) => w.overdue)
      return {
        ...base,
        periodLabel: 'Now',
        value: `${overdue.length}`,
        text: overdue.length
          ? `${overdue.length} of ${open.length} open work order${open.length === 1 ? ' is' : 's are'} past their target.`
          : `No work order is past its target. ${open.length} open.`,
        table: overdue.length
          ? {
              columns: [
                { key: 'room', label: 'Room' },
                { key: 'what', label: 'Problem' },
                { key: 'priority', label: 'Priority' },
                { key: 'on', label: 'Reported' },
              ],
              rows: overdue.map((w) => ({ room: w.room, what: w.description || w.category, priority: w.priority, on: w.reportedOn })),
            }
          : undefined,
        sources: overdue.slice(0, MAX_SOURCES).map((w) => ({
          id: w.id,
          kind: 'Work order',
          label: `Room ${w.room} · ${w.category}`,
          detail: `${w.reportedOn} · ${w.status} · ${w.technician || 'no technician'}`,
          to: link('/maintenance', ctx),
        })),
      }
    }
    case 'lowStock': {
      const low = facts.stock.filter((s) => s.onHand <= s.reorderAt).sort((a, b) => a.onHand / Math.max(1, a.reorderAt) - b.onHand / Math.max(1, b.reorderAt))
      return {
        ...base,
        periodLabel: 'Now',
        value: `${low.length}`,
        text: low.length ? `${low.length} item${low.length === 1 ? ' is' : 's are'} at or below the reorder level.` : 'Every item is above its reorder level.',
        table: low.length
          ? {
              columns: [
                { key: 'name', label: 'Item' },
                { key: 'on', label: 'On hand', align: 'right' },
                { key: 'at', label: 'Reorder at', align: 'right' },
              ],
              rows: low.map((s) => ({ name: s.name, on: `${s.onHand} ${s.unit}`, at: `${s.reorderAt}` })),
            }
          : undefined,
        sources: low.slice(0, MAX_SOURCES).map((s) => ({
          id: s.id,
          kind: 'Stock item',
          label: s.name,
          detail: `${s.onHand} ${s.unit} on hand · reorder at ${s.reorderAt}`,
          to: link('/inventory', ctx),
        })),
      }
    }
    case 'owed': {
      const list = debtors(facts.reservations, facts.today)
      const total = list.reduce((n, d) => n + d.owed, 0)
      return {
        ...base,
        periodLabel: 'Now',
        value: money(total),
        text: `${list.length} guest${list.length === 1 ? '' : 's'} owe ${money(total)}. Companies owe ${money(facts.accounts.reduce((n, a) => n + a.outstandingBalance, 0))} on account.`,
        table: {
          columns: [
            { key: 'guest', label: 'Guest' },
            { key: 'age', label: 'Age' },
            { key: 'owed', label: 'Owed', align: 'right' },
          ],
          rows: list.slice(0, 10).map((d) => ({ guest: d.reservation.guest, age: d.age === 0 ? 'In the house' : `${d.age} days`, owed: money(d.owed) })),
        },
        sources: list.slice(0, MAX_SOURCES).map((d) => ({
          id: d.reservation.id,
          kind: 'Reservation',
          label: `${d.reservation.id} · ${d.reservation.guest}`,
          detail: `${d.reservation.status} · ${money(d.owed)}`,
          to: link(`/desk/folios?r=${d.reservation.id}`, ctx),
        })),
      }
    }
  }
}

export function createRuleAnalyticsAssistant(): AnalyticsAssistant {
  return {
    ask(question, ctx) {
      const q = question.trim()
      if (!q) return Promise.reject(new Error('Type a question'))
      const intent = detectIntent(q)
      if (!intent)
        return Promise.resolve({
          intent: 'unknown',
          understood: false,
          text: 'I did not understand that. Ask about occupancy, revenue, ADR, top guests, F&B sales, work orders, low stock, cancellations or money owed.',
          sources: [],
        })
      const refusal = allowed(NEEDS[intent], ctx)
      if (refusal) return Promise.resolve({ intent, understood: true, refusal, text: refusal, sources: [] })
      return Promise.resolve(answer(intent, q, ctx))
    },

    suggestions(ctx) {
      const all: [Intent, string][] = [
        ['occupancy', 'What was occupancy last week?'],
        ['revenue', 'Revenue this month'],
        ['adr', 'ADR for the last 30 days'],
        ['occupancy', 'How full are we next week?'],
        ['topGuests', 'Who are our top guests?'],
        ['fnb', 'F&B sales by outlet this week'],
        ['workOrders', 'Overdue work orders'],
        ['lowStock', 'Which stock is low?'],
        ['owed', 'Who owes us money?'],
        ['gop', 'GOP this month'],
      ]
      return all.filter(([i]) => !allowed(NEEDS[i], ctx)).map(([, q]) => q)
    },
  }
}

export const INTENT_LABEL = LABEL
