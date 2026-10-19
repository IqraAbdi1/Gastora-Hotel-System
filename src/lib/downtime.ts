// What a room out of sale actually costs.
//
// A room off sale is not a maintenance problem, it is a revenue problem that maintenance can fix. The
// out-of-order list showed which rooms were off sale and said nothing about for how long or what it was
// worth, which is the only part a general manager cares about.
// Pure rules only: no React, no state.

import type { Room } from '../types'

/** One unbroken stretch of a room being off sale. */
export type Spell = {
  id: string
  room: string
  kind: 'out-of-order' | 'out-of-service'
  reason?: string
  fromIso: string
  /** Missing while the room is still off sale. */
  toIso?: string
  /** The repair that took it off sale, when a repair did. */
  defectId?: number
}

export const newSpellId = () => `D-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

export const KIND_LABEL: Record<Spell['kind'], string> = {
  'out-of-order': 'Out of order',
  'out-of-service': 'Out of service',
}

const DAY = 86400000

const dayOf = (iso: string) => iso.slice(0, 10)

/**
 * The nights the hotel could not sell this room.
 *
 * A night counts when the room was still off sale at the hour rooms are given out. A tap fixed by nine
 * in the morning costs the hotel nothing; the same tap still broken at two in the afternoon costs it
 * that night. Counting any overlap instead would charge the hotel a whole night for a two-hour job.
 */
export function nightsOf(spell: Spell, checkInTime: string, now: number): string[] {
  const start = Date.parse(spell.fromIso)
  const end = spell.toIso ? Date.parse(spell.toIso) : now
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return []

  const nights: string[] = []
  // Walk day by day from the day it went off sale.
  for (let t = Date.parse(`${dayOf(spell.fromIso)}T00:00:00Z`); t <= end + DAY; t += DAY) {
    const day = new Date(t).toISOString().slice(0, 10)
    const sellAt = Date.parse(`${day}T${checkInTime}:00`)
    if (Number.isNaN(sellAt)) continue
    if (sellAt >= start && sellAt <= end) nights.push(day)
  }
  return nights
}

/** How long it has been off sale, in hours, open spells included. */
export function hoursOf(spell: Spell, now: number): number {
  const start = Date.parse(spell.fromIso)
  const end = spell.toIso ? Date.parse(spell.toIso) : now
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, (end - start) / 3600000)
}

export function downWords(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${Math.round(hours)} h`
  return `${Math.round(hours / 24)} days`
}

export type RoomDown = {
  room: string
  type: string
  spells: Spell[]
  hours: number
  nights: string[]
  /** What those nights were priced at. An estimate, and said to be one. */
  worth: number
  open: boolean
}

/**
 * What the lost nights would have been worth.
 *
 * This is the room's own price for those nights, not what the hotel would certainly have taken. On a
 * night the hotel did not sell out, the room might not have sold at all, so this is the most it could
 * have cost, not a hole in the bank account. The screens say so where the figure is shown.
 */
export function roomDowntime(
  spells: Spell[],
  rooms: Room[],
  rateFor: (type: string, date: string) => number,
  checkInTime: string,
  now: number,
): RoomDown[] {
  const byRoom = new Map<string, Spell[]>()
  for (const s of spells) byRoom.set(s.room, [...(byRoom.get(s.room) ?? []), s])

  const out: RoomDown[] = []
  for (const [room, list] of byRoom) {
    const type = rooms.find((r) => r.number === room)?.type ?? ''
    const nights = new Set<string>()
    let hours = 0
    for (const s of list) {
      hours += hoursOf(s, now)
      for (const n of nightsOf(s, checkInTime, now)) nights.add(n)
    }
    const nightList = [...nights].sort()
    out.push({
      room,
      type,
      spells: list.sort((a, b) => b.fromIso.localeCompare(a.fromIso)),
      hours,
      nights: nightList,
      worth: nightList.reduce((sum, date) => sum + rateFor(type, date), 0),
      open: list.some((s) => !s.toIso),
    })
  }
  return out.sort((a, b) => b.worth - a.worth || b.hours - a.hours)
}

export function downtimeTotals(rows: RoomDown[]) {
  return {
    rooms: rows.length,
    nights: rows.reduce((n, r) => n + r.nights.length, 0),
    hours: rows.reduce((n, r) => n + r.hours, 0),
    worth: rows.reduce((n, r) => n + r.worth, 0),
    open: rows.filter((r) => r.open).length,
  }
}

/** Only what is still off sale, or what overlapped the period asked for. */
export function spellsSince(spells: Spell[], fromDay: string): Spell[] {
  return spells.filter((s) => !s.toIso || dayOf(s.toIso) >= fromDay)
}
