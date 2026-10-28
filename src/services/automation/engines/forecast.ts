// Demand forecast and rate suggestions. The forecast starts from what is on the books and the pace
// curve the revenue page already uses; where the curve is too thin it falls back to the same weekday's
// recent history and this week's pickup. Rate suggestions are the existing rate advice, unchanged.
import { soldByNight } from '../../../lib/availability'
import { effectPercent, eventsOn } from '../../../lib/demandEvents'
import { addDays, paceAhead, soldNight } from '../../../lib/pace'
import { adviseNight, worthSaying } from '../../../lib/rateAdvice'
import { DAY_SHORT, dayOf, priceNight } from '../../../lib/rateCalendar'
import { roomTypeList } from '../../../lib/rates'
import type { ForecastModel, AutomationSnapshot } from '../automationModels'
import type { Confidence, Driver, Forecast, Recommendation } from '../automationTypes'

/** The same weekday over the last eight weeks, as an average of rooms sold. */
function sameWeekday(s: AutomationSnapshot, date: string): number | undefined {
  const seen: number[] = []
  for (let w = 1; w <= 8; w++) {
    const d = addDays(date, -7 * w)
    if (d >= s.today) continue
    seen.push(soldNight(s.reservations, d))
  }
  const used = seen.filter((n) => n > 0)
  if (used.length < 2) return undefined
  return used.reduce((a, b) => a + b, 0) / used.length
}

export const forecastRules: ForecastModel = {
  forecast(s, days, { generatedAt }) {
    const nights = paceAhead(s.reservations, s.rooms, s.today, days)
    let sum = 0
    for (let i = 1; i <= 56; i++) sum += soldNight(s.reservations, addDays(s.today, -i))
    const house = sum / 56
    return nights.map((n): Omit<Forecast, 'id'> => {
      const drivers: Driver[] = [{ basis: 'Rule', text: `${n.onBooks} of ${n.sellable} rooms on the books${n.daysOut ? `, ${n.daysOut} day${n.daysOut === 1 ? '' : 's'} out` : ', tonight'}.` }]
      if (n.pickup > 0) drivers.push({ basis: 'Rule', text: `+${n.pickup} picked up in the last 7 days.` })
      let expected = n.onBooks
      if (n.forecast !== undefined && n.forecast > n.onBooks) {
        expected = n.forecast
        drivers.push({ basis: 'Estimate', text: `Pace curve: this hotel usually holds ${Math.round(n.normalShare * 100)}% of the final house by now.` })
      }
      // What this night usually ends up with: the same weekday lately, or failing that the house average.
      const usual = sameWeekday(s, n.date)
      const baseline = usual ?? house
      // The further out, the more of the gap to the usual night is still to fill.
      const room = 1 - Math.exp(-n.daysOut / 7)
      if (baseline > expected && room > 0) {
        expected += (baseline - expected) * room * 0.8
        drivers.push({
          basis: 'Estimate',
          text:
            usual !== undefined
              ? `${DAY_SHORT[dayOf(n.date)]}s averaged ${usual.toFixed(1)} rooms over the last 8 weeks.`
              : `The last 8 weeks averaged ${house.toFixed(1)} rooms a night.`,
        })
      }
      if (n.pickup > 0 && n.daysOut > 0) {
        expected += n.pickup * 0.3 * room
        drivers.push({ basis: 'Estimate', text: 'This week’s pickup carried forward at a third.' })
      }
      const confidence: Confidence = n.daysOut <= 3 ? 'high' : n.daysOut <= 14 ? 'medium' : 'low'
      const on = eventsOn(s.events, n.date)
      if (on.length > 0) {
        const strongest = on.reduce((a, b) => (Math.abs(effectPercent(b)) > Math.abs(effectPercent(a)) ? b : a))
        const p = effectPercent(strongest)
        expected *= 1 + p / 200
        drivers.push({ basis: 'Your input', text: `Event: ${strongest.name} (${p > 0 ? '+' : ''}${p}%), counted at half.` })
      }
      const forecastRooms = Math.max(n.onBooks, Math.min(n.sellable, Math.round(expected)))
      return {
        propertyId: s.propertyId,
        date: n.date,
        daysOut: n.daysOut,
        onBooks: n.onBooks,
        pickup: n.pickup,
        sellable: n.sellable,
        forecastRooms,
        occupancyPct: n.sellable ? Math.round((forecastRooms / n.sellable) * 100) : 0,
        confidence,
        drivers,
        generatedAt,
      }
    })
  },

  recommend(s, { generatedAt }) {
    const nights = paceAhead(s.reservations, s.rooms, s.today, 30)
    if (nights.length === 0) return []
    const sold = soldByNight(s.rooms, s.reservations, nights[0].date, nights[nights.length - 1].date)
    const out: Omit<Recommendation, 'id' | 'status'>[] = []
    for (const type of roomTypeList) {
      if (!s.rooms.some((r) => r.type === type)) continue
      const advice = worthSaying(nights.map((n) => adviseNight(n, priceNight(type, n.date, s.rates, (d) => sold[d]), type, undefined, s.events)))
      for (const a of advice) {
        if (a.direction === 'hold') continue
        out.push({
          propertyId: s.propertyId,
          key: `rate:${a.date}:${type}:${a.suggested}`,
          kind: 'rate',
          date: a.date,
          roomType: type,
          direction: a.direction,
          currentRate: a.current,
          suggestedRate: a.suggested,
          drivers: a.drivers.map((d) => ({ basis: d.basis, text: d.text })),
          generatedAt,
        })
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.roomType.localeCompare(b.roomType))
  },
}
