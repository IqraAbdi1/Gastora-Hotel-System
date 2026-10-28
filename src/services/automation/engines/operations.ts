// Operations: the order to clean rooms in, the order to fix things in, and how many people each
// department needs over the next two weeks. Scores are sums of plain reasons, listed beside each one.
import { slaOf } from '../../../lib/sla'
import { defectPriority } from '../../../features/housekeeping/hkModel'
import type { PriorityModel, StaffingModel } from '../automationModels'
import type { Department, Driver, PriorityScore, StaffingForecast } from '../automationTypes'

type Scored = Omit<PriorityScore, 'id' | 'status'>

const TYPE_BASE: Record<string, number> = {
  'Arrival Preparation': 20,
  'Departure Clean': 15,
  'Deep Clean': 5,
  'Stay Over': 8,
  Turndown: 4,
  Inspection: 10,
}

function rankList(list: Omit<Scored, 'rank'>[]): Scored[] {
  return list
    .sort((a, b) => b.score - a.score || a.room.localeCompare(b.room, undefined, { numeric: true }))
    .map((x, i) => ({ ...x, rank: i + 1 }))
}

export const priorityRules: PriorityModel = {
  housekeeping(s, { generatedAt }) {
    const arriving = new Map(
      s.reservations.filter((r) => r.status === 'booked' && r.arrival === s.today && r.room).map((r) => [r.room as string, r]),
    )
    const out: Omit<Scored, 'rank'>[] = []
    for (const t of s.hkTasks) {
      if (t.area || t.status === 'Completed' || t.status === 'Cancelled') continue
      const room = s.hkRooms.find((r) => r.room === t.room)
      const stay = arriving.get(t.room)
      const guest = stay ? s.guests.find((g) => g.id === stay.guestId) : undefined
      const reasons: string[] = []
      let score = TYPE_BASE[t.type] ?? 5
      reasons.push(t.type)
      if (stay) {
        score += 35
        reasons.push(`${stay.guest} arrives today`)
      }
      if (guest?.vip) {
        score += 15
        reasons.push('VIP guest')
      }
      const early =
        (room?.readyBy && room.readyBy < s.checkInTime) ||
        guest?.preferences?.tags?.some((x) => /early/i.test(x)) ||
        /early/i.test(stay?.details?.specialRequests ?? '')
      if (stay && early) {
        score += 15
        reasons.push(room?.readyBy ? `Wanted by ${room.readyBy}, before ${s.checkInTime}` : 'Early check-in expected')
      }
      if (room?.rushed) {
        score += 25
        reasons.push('Rushed by the front desk')
      }
      if (t.priority === 'Urgent') {
        score += 10
        reasons.push('Marked urgent')
      } else if (t.priority === 'High') {
        score += 5
        reasons.push('High priority')
      }
      if (t.status === 'In Progress') {
        score += 5
        reasons.push('Already started')
      }
      out.push({
        propertyId: s.propertyId,
        key: `hk:${s.today}:${t.id}`,
        area: 'housekeeping',
        subject: `Room ${t.room}`,
        room: t.room,
        subjectId: String(t.id),
        score: Math.min(100, score),
        reasons,
        label: t.attendant && t.attendant !== 'Unassigned' ? `${t.type} · ${t.attendant}` : `${t.type} · unassigned`,
        state: t.status,
        generatedAt,
      })
    }
    return rankList(out)
  },

  maintenance(s, { generatedAt }) {
    const now = Date.parse(s.now)
    const arriving = new Set(s.reservations.filter((r) => r.status === 'booked' && r.arrival === s.today && r.room).map((r) => r.room as string))
    const inHouse = new Set(s.reservations.filter((r) => r.status === 'in-house' && r.room).map((r) => r.room as string))
    const out: Omit<Scored, 'rank'>[] = []
    for (const { room, defect: d } of s.defects) {
      if (d.status === 'Done' || d.status === 'Resolved') continue
      const priority = defectPriority(d)
      const reasons: string[] = [`${priority} priority (${d.severity.toLowerCase()} severity)`]
      let score = priority === 'Urgent' ? 45 : priority === 'High' ? 28 : 12
      if (d.blocksRoom) {
        score += 15
        reasons.push(`Room off sale (${d.blocksRoom.replaceAll('-', ' ')})`)
      }
      if (arriving.has(room)) {
        score += 15
        reasons.push('Guest arriving in this room today')
      } else if (inHouse.has(room)) {
        score += 10
        reasons.push('Guest in the room')
      }
      if (s.sla.on && d.reportedIso) {
        const sla = slaOf({ priority, reportedIso: d.reportedIso, startedIso: d.startedIso, closedIso: d.closedIso }, s.sla, now)
        if (sla.step > 0) {
          score += sla.step * 10
          reasons.push(sla.why ?? 'Past its target')
        }
      }
      if (d.reportedIso) {
        const hours = (now - Date.parse(d.reportedIso)) / 3600000
        if (hours > 24) {
          score += Math.min(10, Math.floor(hours / 24) * 2)
          reasons.push(`Open ${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'}`)
        }
      }
      if (d.status === 'Open') {
        score += 5
        reasons.push('Not sent to maintenance yet')
      }
      out.push({
        propertyId: s.propertyId,
        key: `mt:${room}:${d.id}`,
        area: 'maintenance',
        subject: `${d.category}: ${d.description}`,
        room,
        subjectId: String(d.id),
        score: Math.min(100, score),
        reasons,
        label: priority,
        state: d.status,
        generatedAt,
      })
    }
    return rankList(out)
  },
}

const SHIFT_MIN = 420

export const staffingRules: StaffingModel = {
  staffing(s, forecasts, days, { generatedAt }) {
    const out: Omit<StaffingForecast, 'id' | 'status'>[] = []
    const live = s.reservations.filter((r) => r.status === 'booked' || r.status === 'in-house')
    for (const f of forecasts.slice(0, days)) {
      const booked = live.filter((r) => r.arrival === f.date).length
      const arrivals = booked + Math.max(0, f.forecastRooms - f.onBooks)
      const departures = live.filter((r) => r.departure === f.date).length
      const stayovers = Math.max(0, f.forecastRooms - arrivals)
      const base = { propertyId: s.propertyId, date: f.date, forecastRooms: f.forecastRooms, occupancyPct: f.occupancyPct, arrivals, departures, generatedAt }
      const row = (department: Department, staffNeeded: number, hoursNeeded: number, drivers: Driver[]) =>
        out.push({ ...base, key: `staff:${f.date}:${department}`, department, staffNeeded, hoursNeeded, drivers })
      const occ: Driver = { basis: 'Estimate', text: `${f.forecastRooms} rooms forecast (${f.occupancyPct}%), ${f.confidence} confidence.` }

      const hkMin = departures * 40 + arrivals * 10 + stayovers * 20
      row('Housekeeping', Math.max(1, Math.ceil(hkMin / SHIFT_MIN)), Math.max(0.5, Math.round(hkMin / 30) / 2), [
        occ,
        { basis: 'Rule', text: `${departures} departure cleans at 40 min, ${stayovers} stay-overs at 20 min, ${arrivals} arrival checks at 10 min.` },
        { basis: 'Rule', text: `${SHIFT_MIN / 60}-hour shifts.` },
      ])
      const moves = arrivals + departures
      const desk = 3 + Math.max(0, Math.ceil(moves / 20) - 1)
      row('Front desk', desk, desk * 8, [
        { basis: 'Rule', text: `${arrivals} arrivals and ${departures} departures.` },
        { basis: 'Rule', text: 'One person per shift round the clock, one more per 20 check-ins and outs.' },
      ])
      const covers = Math.round(f.forecastRooms * 1.6 * 0.75)
      const fb = 2 + Math.ceil(covers / 30)
      row('Food and drink', fb, fb * 8, [occ, { basis: 'Estimate', text: `${covers} breakfast covers (1.6 guests a room, three in four eat in).` }])
      const mt = 1 + Math.floor(f.forecastRooms / 40)
      row('Maintenance', mt, mt * 8, [occ, { basis: 'Rule', text: 'One technician, one more per 40 occupied rooms.' }])
    }
    return out
  },
}
