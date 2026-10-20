// Guest segments and next-best-actions. Segments are plain rules over the guest's own stays, shown
// in words beside each segment. Suggestions reuse the upsell rules (only what the hotel can deliver,
// at its own prices) and add recognition, service recovery, payment and win-back.
import { soldByNight } from '../../../lib/availability'
import { nightsOf } from '../../../lib/booking'
import { addDays } from '../../../lib/pace'
import { ugx } from '../../../lib/format'
import { offersFor } from '../../../lib/upsell'
import { valueOf } from '../../../lib/guestValue'
import type { GuestValue } from '../../../lib/guestValue'
import type { Guest, Reservation } from '../../../types'
import type { AutomationSnapshot, NextBestActionModel, SegmentModel } from '../automationModels'
import type { Driver, GuestSegment, NbaKind, NextBestAction, SegmentCode, SegmentMember } from '../automationTypes'

export const SEGMENT_RULES: Record<SegmentCode, { name: string; rule: string }> = {
  business: { name: 'Business', rule: 'Company booking or company link, travels for work, or mostly single weekday nights.' },
  leisure: { name: 'Leisure', rule: 'Not business; booked through an agent or online travel site, or mostly weekend nights.' },
  family: { name: 'Family', rule: 'Children on a booking, a family party, or a household link.' },
  vip: { name: 'VIP', rule: 'Marked VIP, or in the best band of guest value.' },
  lapsed: { name: 'Lapsed', rule: 'Has stayed, last left over 120 days ago, nothing booked.' },
  'high-value': { name: 'High value', rule: 'Paid UGX 2,000,000 or more, or worth UGX 1,500,000 a year.' },
}

const live = (r: Reservation) => r.status !== 'cancelled' && r.status !== 'no-show'
const mineOf = (g: Guest, list: Reservation[]) => list.filter((r) => (r.guestId ? r.guestId === g.id : r.guest === g.name))

function weekendShare(stays: Reservation[]): { share: number; nights: number } {
  let nights = 0
  let weekend = 0
  for (const r of stays) {
    const n = Math.max(0, nightsOf(r.arrival, r.departure))
    for (let i = 0; i < n; i++) {
      const d = new Date(`${addDays(r.arrival, i)}T00:00:00Z`).getUTCDay()
      nights += 1
      if (d === 5 || d === 6) weekend += 1
    }
  }
  return { share: nights ? weekend / nights : 0, nights }
}

type Member = Omit<SegmentMember, 'id' | 'segmentId'>

function membership(s: AutomationSnapshot, g: Guest, v: GuestValue, stamp: string): Member[] {
  const mine = mineOf(g, s.reservations).filter(live)
  if (mine.length === 0) return []
  const out: Member[] = []
  const add = (code: SegmentCode, reason: string) =>
    out.push({ propertyId: s.propertyId, segmentCode: code, guestId: g.id, guestName: g.name, reason, addedAt: stamp })

  const notes = `${g.preferences?.other ?? ''} ${mine.map((r) => r.details?.purpose ?? '').join(' ')}`.toLowerCase()
  const { share, nights } = weekendShare(mine)
  const solo = mine.every((r) => (r.adults ?? 1) <= 1 && !r.children)
  let business = ''
  if (mine.some((r) => r.corporate)) business = 'Company booking.'
  else if (g.links?.some((l) => l.kind === 'company')) business = 'Linked to a company account.'
  else if (/\b(work|business|conference|meeting)\b/.test(notes)) business = 'Notes say they travel for work.'
  else if (nights >= 3 && share <= 0.35 && solo) business = `${Math.round((1 - share) * 100)}% weekday nights, travelling alone.`
  if (business) add('business', business)
  else {
    const via = mine.find((r) => r.source === 'agent' || r.source === 'ota')
    if (via) add('leisure', via.source === 'agent' ? `Booked through ${via.agent?.name ?? 'an agent'}.` : 'Booked through an online travel site.')
    else if (nights > 0 && share >= 0.5) add('leisure', `${Math.round(share * 100)}% weekend nights.`)
  }

  const kids = mine.find((r) => (r.children ?? 0) > 0)
  if (kids) add('family', `${kids.children} child${kids.children === 1 ? '' : 'ren'} on ${kids.id}.`)
  else if (g.links?.some((l) => l.kind === 'household')) add('family', 'Household link on the profile.')
  else if (mine.some((r) => r.party && r.party.of > 1)) add('family', 'Booked several rooms together.')

  if (g.vip) add('vip', 'Marked VIP.')
  else if (v.band === 'best') add('vip', 'Best band of guest value.')

  const ahead = mine.some((r) => r.status === 'booked' || r.status === 'in-house')
  if (v.stays >= 1 && (v.daysSince ?? 0) > 120 && !ahead) add('lapsed', `Last left ${v.daysSince} days ago, ${v.stays} stay${v.stays === 1 ? '' : 's'} before that.`)

  if (v.paid >= 2000000) add('high-value', `Paid ${ugx(v.paid)} over ${v.stays} stays.`)
  else if (v.perYear >= 1500000) add('high-value', `Worth ${ugx(v.perYear)} a year.`)
  return out
}

export const segmentRules: SegmentModel = {
  segment(s, { generatedAt }) {
    const members: Member[] = []
    for (const g of s.guests) members.push(...membership(s, g, valueOf(g, s.reservations, s.feedback, s.today), generatedAt))
    const segments: Omit<GuestSegment, 'id'>[] = (Object.keys(SEGMENT_RULES) as SegmentCode[]).map((code) => ({
      propertyId: s.propertyId,
      code,
      name: SEGMENT_RULES[code].name,
      rule: SEGMENT_RULES[code].rule,
      memberCount: members.filter((m) => m.segmentCode === code).length,
      generatedAt,
    }))
    return { segments, members }
  },
}

type Nba = Omit<NextBestAction, 'id' | 'status'>

export const nextBestActionRules: NextBestActionModel = {
  suggest(s, members, { generatedAt }) {
    const out: Nba[] = []
    const segsOf = (guestId?: string) => new Set(members.filter((m) => m.guestId === guestId).map((m) => m.segmentCode))
    const horizon = addDays(s.today, 3)
    const stays = s.reservations.filter(
      (r) => r.status === 'in-house' || (r.status === 'booked' && r.arrival >= s.today && r.arrival <= horizon),
    )
    const last = stays.reduce((d, r) => (r.departure > d ? r.departure : d), s.today)
    const sold = soldByNight(s.rooms, s.reservations, s.today, last)

    for (const r of stays) {
      const g = s.guests.find((x) => x.id === r.guestId)
      const segs = segsOf(g?.id)
      const tags = (g?.preferences?.tags ?? []).map((t) => t.toLowerCase())
      const notes = (g?.preferences?.other ?? '').toLowerCase()
      const status: Nba['stayStatus'] = r.status === 'in-house' ? 'in-house' : 'arriving'
      const mine: Nba[] = []
      const push = (kind: NbaKind, id: string, title: string, detail: string, score: number, drivers: Driver[], value?: number) =>
        mine.push({
          propertyId: s.propertyId,
          key: `nba:${r.id}:${kind}:${id}`,
          reservationId: r.id,
          guestId: g?.id,
          guestName: r.guest,
          room: r.room ?? undefined,
          stayStatus: status,
          arrival: r.arrival,
          kind,
          title,
          detail,
          value,
          score: Math.min(99, Math.round(score)),
          drivers,
          generatedAt,
        })
      const segDriver = (): Driver[] =>
        segs.size ? [{ basis: 'Rule', text: `Segments: ${[...segs].map((c) => SEGMENT_RULES[c].name).join(', ')}.` }] : []

      for (const o of offersFor(r, s.rooms, s.reservations, s.rates, s.addOns, s.upsell, (d) => sold[d])) {
        if (o.kind === 'upgrade') {
          let score = 45 + Math.min(10, nightsOf(r.arrival, r.departure) * 2)
          if (segs.has('vip')) score += 20
          if (segs.has('high-value')) score += 10
          if (segs.has('business')) score += 5
          push('upsell', o.id, o.title, `${o.blurb} ${ugx(o.price)} instead of ${ugx(o.was ?? o.price)}.`, score, [
            { basis: 'Rule', text: `A ${o.toType} is free every night of the stay.` },
            ...segDriver(),
          ], o.price)
        } else if (o.kind === 'late') {
          const leaving = r.departure <= addDays(s.today, 1)
          const wants = /late check-?out/.test(notes) || tags.some((t) => t.includes('late'))
          if (!leaving && !wants) continue
          let score = 40 + (leaving ? 10 : 0) + (wants ? 25 : 0) + (segs.has('business') ? 8 : 0)
          if (r.status === 'booked') score -= 10
          push('upsell', o.id, 'Offer a late check-out', `Keep the room into the afternoon for ${ugx(o.price)}.`, score, [
            ...(leaving ? [{ basis: 'Rule' as const, text: `Leaves ${r.departure === s.today ? 'today' : 'tomorrow'}.` }] : []),
            ...(wants ? [{ basis: 'Rule' as const, text: 'Their profile says they ask for a late check-out.' }] : []),
            ...segDriver(),
          ], o.price)
        } else if (o.kind === 'early') {
          if (r.arrival !== s.today) continue
          const wants = tags.some((t) => t.includes('early'))
          push('upsell', o.id, 'Offer an early check-in', `Room held from the morning for ${ugx(o.price)}.`, 38 + (wants ? 15 : 0), [
            { basis: 'Rule', text: 'Arrives today.' },
            ...(wants ? [{ basis: 'Rule' as const, text: 'Profile mentions early.' }] : []),
          ], o.price)
        } else {
          const score = 30 + (r.status === 'booked' && /airport/i.test(o.title) ? 15 : 0) + (segs.has('family') ? 5 : 0)
          push('upsell', o.id, `Offer: ${o.title}`, `${o.blurb} ${ugx(o.price)}.`, score, [{ basis: 'Rule', text: 'An extra the hotel sells that is not on the bill yet.' }], o.price)
        }
      }

      if (status === 'arriving' && (segs.has('vip') || segs.has('high-value'))) {
        push('recognition', 'welcome', 'Welcome amenity and a named greeting', 'Fruit or flowers in the room and a greeting by name at the desk.', 60 + (segs.has('vip') ? 15 : 0), [
          { basis: 'Rule', text: `Arrives ${r.arrival === s.today ? 'today' : r.arrival}.` },
          ...segDriver(),
        ])
      }
      if (status === 'arriving' && (g?.preferences?.tags?.length ?? 0) > 0) {
        push('recognition', 'prefs', 'Set the room up to their preferences', `Profile asks for: ${g?.preferences?.tags?.join(', ')}.`, 50, [
          { basis: 'Rule', text: 'Preferences recorded on the profile.' },
        ])
      }

      const complaint = s.feedback.find((f) => f.kind === 'complaint' && f.state === 'open' && (f.guestId === g?.id || f.guestName === r.guest))
      if (complaint) {
        push('service', complaint.id, 'Manager follow-up on an open complaint', `About ${complaint.about.toLowerCase()}: “${complaint.text.slice(0, 80)}”.`, 85, [
          { basis: 'Rule', text: `Complaint raised ${complaint.at} is still open.` },
        ])
      }

      const owed = r.total - r.paid
      if (r.status === 'in-house' && owed > r.total * 0.5 && (r.guarantee === 'none' || !r.guarantee)) {
        push('payment', 'deposit', 'Ask for a payment on account', `${ugx(owed)} unpaid, nothing guaranteeing it.`, 55, [
          { basis: 'Rule', text: `${Math.round((owed / Math.max(1, r.total)) * 100)}% of the stay still owed.` },
          { basis: 'Rule', text: 'No card or company guarantee.' },
        ], owed)
      }

      out.push(...mine.sort((a, b) => b.score - a.score).slice(0, 4))
    }

    for (const m of members.filter((x) => x.segmentCode === 'lapsed')) {
      const high = members.some((x) => x.guestId === m.guestId && x.segmentCode === 'high-value')
      out.push({
        propertyId: s.propertyId,
        key: `nba:${m.guestId}:retention:winback`,
        guestId: m.guestId,
        guestName: m.guestName,
        stayStatus: 'past',
        kind: 'retention',
        title: 'Invite back with a returning-guest rate',
        detail: 'Call or message with a rate for their usual room type.',
        score: 45 + (high ? 20 : 0),
        drivers: [{ basis: 'Rule', text: m.reason }, ...(high ? [{ basis: 'Rule' as const, text: 'High value guest.' }] : [])],
        generatedAt,
      })
    }
    return out.sort((a, b) => b.score - a.score)
  },
}
