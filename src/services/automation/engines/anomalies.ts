// Anomaly detection: revenue leakage, suspicious discounts, refunds and voids, and postings that do
// not look like the rest. Every finding names the records it rests on and the rule it broke, so a
// manager can check it in a minute and dismiss it with a reason if it is fine.
import { nightsOf } from '../../../lib/booking'
import { ugx } from '../../../lib/format'
import { priceNight } from '../../../lib/rateCalendar'
import type { AnomalyModel, AutomationSnapshot } from '../automationModels'
import type { Anomaly, Driver, JournalEntry, Severity, SourceRef } from '../automationTypes'

export const THRESHOLDS = {
  /** A discount above this share of the bill is looked at. */
  discountPercent: 20,
  /** More voids than this by one person in a day. */
  voidsPerDay: 3,
  /** A POS check open longer than this many hours. */
  openCheckHours: 4,
  /** A posting this many times the usual for its category. */
  postingMultiple: 3,
  /** Before this hour or from the late hour on counts as out of hours. */
  earlyHour: 6,
  lateHour: 22,
}

type Found = Omit<Anomaly, 'id' | 'status'>

const hourOf = (at: string): number | undefined => {
  const m = /[T ](\d{2}):(\d{2})/.exec(at)
  return m ? Number(m[1]) : undefined
}
const outOfHours = (at: string) => {
  const h = hourOf(at)
  return h !== undefined && (h >= THRESHOLDS.lateHour || h < THRESHOLDS.earlyHour)
}
const timeOf = (at: string) => /[T ](\d{2}:\d{2})/.exec(at)?.[1] ?? ''
const dayOfStamp = (at: string) => at.slice(0, 10)
/** The trading day: a void at 00:20 belongs to the night before. */
const tradingDay = (at: string) => {
  const h = hourOf(at)
  if (h === undefined || h >= THRESHOLDS.earlyHour) return dayOfStamp(at)
  return new Date(Date.parse(`${dayOfStamp(at)}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
}

const severityOf = (score: number): Severity => (score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low')
const resLink = (id: string): SourceRef => ({ kind: 'reservation', id, label: id, link: '/desk/folios' })

function make(
  s: AutomationSnapshot,
  detectedAt: string,
  f: Omit<Found, 'propertyId' | 'detectedAt' | 'severity'> & { severity?: Severity },
): Found {
  return { ...f, severity: f.severity ?? severityOf(f.score), propertyId: s.propertyId, detectedAt, score: Math.min(100, Math.round(f.score)) }
}

function leakage(s: AutomationSnapshot, at: string): Found[] {
  const out: Found[] = []
  const inHouse = s.reservations.filter((r) => r.status === 'in-house')
  const byRoom = new Map(inHouse.filter((r) => r.room).map((r) => [r.room as string, r]))

  for (const room of s.rooms) {
    if (room.status !== 'occupied' || byRoom.has(room.number)) continue
    out.push(
      make(s, at, {
        key: `leak:room:${room.number}`,
        kind: 'leakage',
        title: `Room ${room.number} occupied with no stay on it`,
        score: 80,
        amount: priceNight(room.type, s.today, s.rates).rate,
        drivers: [
          { basis: 'Rule', text: `Room status is occupied, but no in-house booking holds room ${room.number}.` },
          { basis: 'Estimate', text: 'Tonight is not being charged to anybody.' },
        ],
        sources: [{ kind: 'room', id: room.number, label: `Room ${room.number}`, link: '/desk/rooms' }],
      }),
    )
  }

  for (const r of inHouse) {
    const nights = Math.max(1, nightsOf(r.arrival, r.departure))
    if (r.departure < s.today) {
      const over = nightsOf(r.departure, s.today)
      out.push(
        make(s, at, {
          key: `leak:overstay:${r.id}`,
          kind: 'leakage',
          title: `${r.guest} still in house ${over} night${over === 1 ? '' : 's'} past departure`,
          score: 60 + Math.min(20, over * 5),
          amount: Math.round((r.total / nights) * over),
          drivers: [{ basis: 'Rule', text: `Booked to leave ${r.departure}; the stay was not extended, so those nights carry no charge.` }],
          sources: [resLink(r.id)],
        }),
      )
    }
    if (r.corporate || r.group || (r.share && !r.share.primary)) continue
    const rack = priceNight(r.roomType, r.arrival, s.rates).rate
    const extras = (r.charges ?? []).reduce((n, c) => n + c.amount, 0)
    const perNight = Math.round((r.total - extras) / nights)
    if (rack > 0 && perNight < rack * 0.5 && !r.overrideReason) {
      out.push(
        make(s, at, {
          key: `leak:rate:${r.id}`,
          kind: 'leakage',
          title: `${r.guest} paying ${Math.round((perNight / rack) * 100)}% of the ${r.roomType} rate`,
          score: perNight === 0 ? 75 : 55,
          amount: (rack - perNight) * nights,
          drivers: [
            { basis: 'Rule', text: `${ugx(perNight)} a night against a published ${ugx(rack)}.` },
            { basis: 'Rule', text: 'No reason recorded for the lower price.' },
          ],
          sources: [resLink(r.id)],
        }),
      )
    }
  }

  const now = Date.parse(s.now)
  const price = new Map(s.posProducts.map((p) => [p.id, p.price]))
  for (const o of s.posOrders) {
    if (o.kitchenStatus === 'Cancelled' || o.paidAt) continue
    const opened = Date.parse(o.createdAt)
    if (Number.isNaN(opened)) continue
    const hours = (now - opened) / 3600000
    if (hours < THRESHOLDS.openCheckHours) continue
    const value = o.items.reduce((n, l) => n + (price.get(l.productId) ?? 0) * l.qty, 0)
    out.push(
      make(s, at, {
        key: `leak:pos:${o.id}`,
        kind: 'leakage',
        title: `${o.outlet} check ${o.table || o.room || o.id} open ${Math.round(hours)} h`,
        score: 45 + Math.min(30, hours * 2),
        amount: value || undefined,
        drivers: [{ basis: 'Rule', text: `Open more than ${THRESHOLDS.openCheckHours} hours without payment.` }],
        sources: [{ kind: 'pos-order', id: o.id, label: `Order ${o.id}`, link: '/pos/orders' }],
      }),
    )
  }
  return out
}

function fromJournal(s: AutomationSnapshot, journal: JournalEntry[], at: string): Found[] {
  const out: Found[] = []
  const src = (e: JournalEntry): SourceRef => ({ kind: 'journal', id: e.id, label: `${e.reference} · ${e.outlet}` })

  // Voids: grouped by person and day.
  const voids = new Map<string, JournalEntry[]>()
  for (const e of journal.filter((x) => x.kind === 'void')) {
    const k = `${e.user}|${tradingDay(e.at)}`
    voids.set(k, [...(voids.get(k) ?? []), e])
  }
  for (const [k, list] of voids) {
    const [user, day] = k.split('|')
    const late = list.filter((e) => outOfHours(e.at))
    if (list.length <= THRESHOLDS.voidsPerDay && late.length === 0) continue
    const total = list.reduce((n, e) => n + e.amount, 0)
    const drivers: Driver[] = [{ basis: 'Rule', text: `${list.length} void${list.length === 1 ? '' : 's'} by ${user} on the ${day} trading day, ${ugx(total)} in all.` }]
    if (list.length > THRESHOLDS.voidsPerDay) drivers.push({ basis: 'Rule', text: `More than ${THRESHOLDS.voidsPerDay} in a day.` })
    if (late.length) drivers.push({ basis: 'Rule', text: `${late.length} out of hours (${late.map((e) => timeOf(e.at)).join(', ')}).` })
    out.push(
      make(s, at, {
        key: `void:${k}`,
        kind: 'void',
        title: `${list.length} void${list.length === 1 ? '' : 's'} by ${user}`,
        score: 35 + list.length * 8 + late.length * 10,
        amount: total,
        user,
        drivers,
        sources: list.map(src),
      }),
    )
  }

  for (const e of journal) {
    if (e.kind === 'discount') {
      const pct = e.percent ?? 0
      if (pct <= THRESHOLDS.discountPercent && !outOfHours(e.at)) continue
      const drivers: Driver[] = [{ basis: 'Rule', text: `${pct}% off ${e.reference}, above the ${THRESHOLDS.discountPercent}% line.` }]
      if (outOfHours(e.at)) drivers.push({ basis: 'Rule', text: `Given at ${timeOf(e.at)}, out of hours.` })
      if (e.note) drivers.push({ basis: 'Rule', text: `Note given: "${e.note}".` })
      out.push(
        make(s, at, {
          key: `disc:journal:${e.id}`,
          kind: 'discount',
          title: `${pct}% discount by ${e.user}`,
          score: 30 + pct + (outOfHours(e.at) ? 15 : 0),
          amount: e.amount,
          user: e.user,
          drivers,
          sources: [src(e)],
        }),
      )
    }
    if (e.kind === 'refund') {
      const big = e.amount > s.managerLimit
      if (!big && !outOfHours(e.at)) continue
      const drivers: Driver[] = []
      if (big) drivers.push({ basis: 'Rule', text: `${ugx(e.amount)} refunded, above the ${ugx(s.managerLimit)} a manager may approve alone.` })
      if (outOfHours(e.at)) drivers.push({ basis: 'Rule', text: `Refunded at ${timeOf(e.at)}, out of hours.` })
      if (e.note) drivers.push({ basis: 'Rule', text: `Note given: "${e.note}".` })
      out.push(
        make(s, at, {
          key: `refund:journal:${e.id}`,
          kind: 'refund',
          title: `${ugx(e.amount)} refund by ${e.user}`,
          score: 40 + (big ? 25 : 0) + (outOfHours(e.at) ? 20 : 0),
          amount: e.amount,
          user: e.user,
          drivers,
          sources: [src(e)],
        }),
      )
    }
    if (e.kind === 'adjustment') {
      const same = journal.filter((x) => x.kind === 'adjustment' && x.outlet === e.outlet && x.id !== e.id)
      const usual = same.length ? same.reduce((n, x) => n + x.amount, 0) / same.length : 50000
      if (e.amount < usual * THRESHOLDS.postingMultiple) continue
      out.push(
        make(s, at, {
          key: `post:journal:${e.id}`,
          kind: 'posting',
          title: `${ugx(e.amount)} ${e.outlet.toLowerCase()} adjustment by ${e.user}`,
          score: 50 + Math.min(30, (e.amount / usual) * 3) + (outOfHours(e.at) ? 10 : 0),
          amount: e.amount,
          user: e.user,
          drivers: [
            { basis: 'Rule', text: `${Math.round(e.amount / usual)}× the usual ${e.outlet.toLowerCase()} adjustment of ${ugx(Math.round(usual))}.` },
            ...(outOfHours(e.at) ? [{ basis: 'Rule' as const, text: `Posted at ${timeOf(e.at)}, out of hours.` }] : []),
          ],
          sources: [src(e)],
        }),
      )
    }
    if (e.kind === 'open-check') {
      out.push(
        make(s, at, {
          key: `leak:journal:${e.id}`,
          kind: 'leakage',
          title: `${e.outlet} check ${e.reference} never closed`,
          score: 55,
          amount: e.amount,
          user: e.user,
          drivers: [{ basis: 'Rule', text: `Opened ${dayOfStamp(e.at)} at ${timeOf(e.at)} by ${e.user}; still open, not paid.` }],
          sources: [src(e)],
        }),
      )
    }
  }
  return out
}

function fromRecords(s: AutomationSnapshot, at: string): Found[] {
  const out: Found[] = []

  // Refunds and reversals the hotel approved, from the approvals record.
  const byPerson = new Map<string, number>()
  for (const a of s.approvals) if (a.kind === 'charge-reversal') byPerson.set(a.requestedBy, (byPerson.get(a.requestedBy) ?? 0) + 1)
  for (const a of s.approvals) {
    if (a.kind !== 'charge-reversal') continue
    const amount = a.amount ?? 0
    const many = (byPerson.get(a.requestedBy) ?? 0) >= 3
    const big = amount > s.managerLimit
    if (!big && !many && !outOfHours(a.at)) continue
    const drivers: Driver[] = [{ basis: 'Rule', text: `${ugx(amount)} taken off a folio: ${a.what}.` }]
    if (big) drivers.push({ basis: 'Rule', text: `Above the ${ugx(s.managerLimit)} a manager may approve alone.` })
    if (many) drivers.push({ basis: 'Rule', text: `${a.requestedBy} asked for ${byPerson.get(a.requestedBy)} reversals.` })
    if (outOfHours(a.at)) drivers.push({ basis: 'Rule', text: `Done at ${timeOf(a.at)}, out of hours.` })
    out.push(
      make(s, at, {
        key: `refund:approval:${a.id}`,
        kind: 'refund',
        title: `${ugx(amount)} reversal asked by ${a.requestedBy}`,
        score: 35 + (big ? 25 : 0) + (many ? 15 : 0) + (outOfHours(a.at) ? 15 : 0),
        amount,
        user: a.requestedBy,
        drivers,
        sources: [
          { kind: 'approval', id: a.id, label: `Approval ${a.id}`, link: '/admin/approvals' },
          ...(a.reservationId ? [resLink(a.reservationId)] : []),
        ],
      }),
    )
  }

  // Point-of-sale discounts.
  for (const sale of s.posSales) {
    const sub = sale.subtotal ?? sale.total + (sale.discount ?? 0)
    const pct = sub > 0 ? Math.round(((sale.discount ?? 0) / sub) * 100) : 0
    if (pct <= THRESHOLDS.discountPercent) continue
    out.push(
      make(s, at, {
        key: `disc:pos:${sale.id}`,
        kind: 'discount',
        title: `${pct}% off a ${sale.outlet.toLowerCase()} bill`,
        score: 30 + pct + (outOfHours(sale.createdAt) ? 15 : 0),
        amount: sale.discount,
        drivers: [{ basis: 'Rule', text: `${ugx(sale.discount ?? 0)} off ${ugx(sub)}, above the ${THRESHOLDS.discountPercent}% line.` }],
        sources: [{ kind: 'pos-sale', id: sale.id, label: `Sale ${sale.id}`, link: '/pos/orders' }],
      }),
    )
  }

  // Booking discounts from promotional codes.
  for (const r of s.reservations) {
    if (!r.promo || r.status === 'cancelled') continue
    const before = r.total + r.promo.saved
    const pct = before > 0 ? Math.round((r.promo.saved / before) * 100) : 0
    if (pct <= THRESHOLDS.discountPercent + 10) continue
    out.push(
      make(s, at, {
        key: `disc:promo:${r.id}`,
        kind: 'discount',
        title: `${pct}% promo code on ${r.guest}`,
        score: 30 + pct,
        amount: r.promo.saved,
        drivers: [{ basis: 'Rule', text: `Code ${r.promo.code} took ${ugx(r.promo.saved)} off.` }],
        sources: [resLink(r.id)],
      }),
    )
  }

  // Folio postings that do not look like the rest of their category.
  const all = s.reservations.flatMap((r) => (r.charges ?? []).filter((c) => !c.reverses && c.amount > 0).map((c) => ({ r, c })))
  const byCat = new Map<string, number[]>()
  for (const { c } of all) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c.amount])
  const median = (xs: number[]) => {
    const a = [...xs].sort((x, y) => x - y)
    return a[Math.floor(a.length / 2)]
  }
  for (const { r, c } of all) {
    const list = byCat.get(c.category) ?? []
    if (list.length < 3) continue
    const usual = median(list)
    if (c.amount < usual * THRESHOLDS.postingMultiple) continue
    out.push(
      make(s, at, {
        key: `post:charge:${r.id}:${c.id}`,
        kind: 'posting',
        title: `${ugx(c.amount)} ${c.category.toLowerCase()} charge on ${r.guest}`,
        score: 45 + Math.min(30, (c.amount / usual) * 3),
        amount: c.amount,
        drivers: [{ basis: 'Rule', text: `${Math.round(c.amount / usual)}× the usual ${c.category.toLowerCase()} charge of ${ugx(usual)}.` }],
        sources: [resLink(r.id), { kind: 'charge', id: c.id, label: c.description }],
      }),
    )
  }
  for (const r of s.reservations) {
    if (r.status !== 'checked-out' || !r.checkedOutAt) continue
    for (const c of r.charges ?? []) {
      if (c.at > r.checkedOutAt && !c.reverses) {
        out.push(
          make(s, at, {
            key: `post:late:${r.id}:${c.id}`,
            kind: 'posting',
            title: `Charge posted after ${r.guest} checked out`,
            score: 50,
            amount: c.amount,
            drivers: [{ basis: 'Rule', text: `${c.description} posted ${c.at}, after check-out at ${r.checkedOutAt}.` }],
            sources: [resLink(r.id)],
          }),
        )
      }
    }
  }
  return out
}

export const anomalyRules: AnomalyModel = {
  detect(s, journal, detectedAt) {
    const found = [...leakage(s, detectedAt), ...fromJournal(s, journal, detectedAt), ...fromRecords(s, detectedAt)]
    return found.sort((a, b) => b.score - a.score)
  },
}
