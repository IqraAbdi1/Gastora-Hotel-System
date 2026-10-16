import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PAST, TODAY, YESTERDAY } from '../../data/sample'
import { useHotel } from '../../lib/hotelContext'
import { floorOf } from '../../lib/rooms'
import { useFeatures } from '../platform/featuresContext'
import { HkContext } from './hkContext'
import type { BlockKind, ExceptionKind, HkValue, NewTask } from './hkContext'
import {
  CHECKIN_TIME,
  PUBLIC_AREA,
  RUSH_NOTE,
  clock,
  cleanTypes,
  defaultDetails,
  hkStatusOf,
  isActive,
  nextStatus,
  previousStatus,
  nextTaskStatus,
  stayIndex,
  uid,
  zoneOf,
} from './hkModel'
import type { DefectStatus, HkRoom, HkTask, RoomDefect, RoomDetails, RoomMessage, TaskType } from './hkModel'
import { AREA_TIMES, areaDueOn, declinedRun, linenDue, minutesBetween, needsWelfareCheck, tooQuick } from '../../lib/cleaning'

const exceptionLabel: Record<ExceptionKind, string> = {
  'out-of-service': 'Out of Service',
  'out-of-order': 'Out of Order',
  discrepancy: 'Discrepancy',
}

// Automatic cleaning tasks carry this note. Their priority is worked out live (see liveTasks).
// A task whose note changes (a rush, a failed inspection, a hand-made task) keeps its own priority.
const AUTO_NOTE = 'Room needs cleaning.'
// The day's other work, built once each morning.
const SERVICE_NOTE = 'Daily service while the guest is still in the room.'
const AREA_NOTE = 'Public area on the cleaning schedule.'
const WELFARE_NOTE = 'Not serviced for days running. A supervisor must enter the room and see the guest.'

/**
 * A few days of cleaning already on the record. Without it the record is empty until someone cleans
 * something in this session, and the question it exists to answer is always about a day that has passed.
 */
function seededHistory(): Record<string, RoomDetails> {
  const past: { room: string; day: string; time: string; user: string; action: string; note: string }[] = [
    { room: '203', day: PAST[0], time: '09:40', user: 'Grace', action: 'Cleaning completed', note: 'Ready for inspection.' },
    { room: '203', day: PAST[0], time: '11:05', user: 'Supervisor', action: 'Inspection passed', note: 'Room accepted.' },
    { room: '203', day: PAST[1], time: '10:12', user: 'Sarah', action: 'Daily service done', note: 'Took 24 minutes. Done: Bed made, Towels replaced, Bin emptied.' },
    { room: '203', day: PAST[2], time: '09:55', user: 'Mary', action: 'Daily service done', note: 'Took 19 minutes. Sheets were due today. Done: Bed made, Bathroom wiped.' },
    { room: '102', day: PAST[1], time: '13:20', user: 'John', action: 'Daily service done', note: 'Took 16 minutes. Done: Bed made, Towels replaced.' },
    { room: '102', day: PAST[2], time: '10:40', user: 'Grace', action: 'Service declined', note: 'Do not disturb sign' },
    { room: '301', day: PAST[1], time: '08:30', user: 'David', action: 'Cleaning completed', note: 'Room ready. Not picked for inspection (spot-check).' },
    { room: 'Lobby and reception (morning)', day: PAST[1], time: '09:05', user: 'Peter', action: 'Public Area done', note: 'Took 31 minutes. Done: Floor mopped, Bins emptied.' },
  ]
  const out: Record<string, RoomDetails> = {}
  for (const row of past) {
    if (!out[row.room]) out[row.room] = defaultDetails()
    out[row.room].history.push({
      id: uid(),
      day: row.day,
      time: row.time,
      action: row.action,
      user: row.user,
      note: row.note,
    })
  }
  for (const d of Object.values(out)) {
    d.history.sort((a, b) => b.day.localeCompare(a.day) || b.time.localeCompare(a.time))
  }
  return out
}

// Messages between the front desk and housekeeping, per room. The "ready by" time belongs to one cleaning task,
// so it disappears by itself when that task is finished.
type Thread = { messages: RoomMessage[]; readyBy?: { time: string; taskId: number } }

// Tasks and room details live here for the session. The room's own status lives in the shared hotel data,
// so the front desk, the Rooms board and housekeeping always agree.
export default function HousekeepingProvider({ children }: { children: ReactNode }) {
  const { rooms, reservations, setHousekeeping } = useHotel()
  const { inspectionMode, options, features } = useFeatures()
  const [tasks, setTasks] = useState<HkTask[]>([])
  const [details, setDetails] = useState<Record<string, RoomDetails>>(() => seededHistory())
  const [threads, setThreads] = useState<Record<string, Thread>>({})
  // Rooms the front desk rushed that are now clean. They stay until the room is used or the alert is dismissed.
  const [readyAlerts, setReadyAlerts] = useState<Record<string, string>>({})
  const [syncKey, setSyncKey] = useState<string | null>(null)
  const [daySync, setDaySync] = useState<string | null>(null)
  // Days a guest refused the service, by room. Room 102 refused yesterday, so one more refusal escalates.
  const [declinedDays, setDeclinedDays] = useState<Record<string, string[]>>(() => ({ '102': [YESTERDAY] }))
  // Counts rooms considered for a spot-check, so "1 in N" is steady and easy to demonstrate.
  const spotCounter = useRef(0)

  const stays = useMemo(() => stayIndex(reservations), [reservations])
  const roomByNumber = useMemo(() => new Map(rooms.map((r) => [r.number, r])), [rooms])

  // Arrivals today, counted once: those with a room already set, and those still needing a room, by type.
  const arrivals = useMemo(() => {
    const byRoom = new Set<string>()
    const needByType = new Map<string, number>()
    for (const r of reservations) {
      if (r.status !== 'booked' || r.arrival !== TODAY) continue
      if (r.room) byRoom.add(r.room)
      else needByType.set(r.roomType, (needByType.get(r.roomType) ?? 0) + 1)
    }
    return { byRoom, needByType }
  }, [reservations])

  // Every dirty room gets a cleaning task, whether it came from a check-out or was already dirty.
  // Done while rendering (only when the set of dirty rooms changes), so there is no extra pass or flicker.
  const dirtyKey = useMemo(
    () => rooms.filter((r) => r.status === 'dirty').map((r) => r.number).join(','),
    [rooms],
  )
  if (dirtyKey !== syncKey) {
    setSyncKey(dirtyKey)
    setTasks((current) => {
      // A guest who checks out mid-service ends the service: the room now needs a full departure clean.
      const dirtyRooms = new Set(rooms.filter((r) => r.status === 'dirty').map((r) => r.number))
      const cleared = current.map((t) =>
        t.type === 'Stay Over' && isActive(t) && dirtyRooms.has(t.room)
          ? { ...t, status: 'Cancelled' as const, notes: 'The guest checked out before the service.' }
          : t,
      )
      // Public area work never blocks a room, and a cancelled service no longer counts as busy.
      const busy = new Set(cleared.filter((t) => isActive(t) && !t.area).map((t) => t.room))
      let nextId = cleared.reduce((m, t) => Math.max(m, t.id), 0)
      const added: HkTask[] = []
      for (const room of rooms) {
        if (room.status !== 'dirty' || busy.has(room.number)) continue
        added.push({
          id: ++nextId,
          room: room.number,
          type: 'Departure Clean',
          zone: zoneOf(room),
          priority: arrivals.byRoom.has(room.number) ? 'Urgent' : 'Normal',
          attendant: 'Unassigned',
          dueTime: CHECKIN_TIME,
          status: room.hk === 'cleaning' ? 'In Progress' : 'Unassigned',
          notes: AUTO_NOTE,
          day: TODAY,
        })
      }
      return added.length ? [...added, ...cleared] : cleared
    })
  }

  // Rooms with a guest still in them are serviced every day, and the public areas are on their own
  // schedule. Both are built once a day, so the head of housekeeping only has to hand the work out.
  const stayoverRooms = useMemo(
    () =>
      [...stays.values()]
        .filter((r) => r.room && r.departure !== TODAY)
        .map((r) => r.room as string)
        .sort(),
    [stays],
  )
  // The name and how often it is cleaned are both in the key, so an area that is renamed or
  // re-scheduled is picked up rather than waiting for tomorrow.
  const dayKey = `${TODAY}|${stayoverRooms.join(',')}|${options.areas
    .map((a) => `${a.id}:${a.name}:${a.frequency}:${a.weekday ?? ''}`)
    .join(',')}`
  if (dayKey !== daySync) {
    setDaySync(dayKey)
    setTasks((current) => {
      let nextId = current.reduce((m, t) => Math.max(m, t.id), 0)
      const doneToday = (room: string, type: TaskType) =>
        current.some((t) => t.room === room && t.type === type && t.day === TODAY)
      const added: HkTask[] = []

      for (const number of stayoverRooms) {
        const record = roomByNumber.get(number)
        const stay = stays.get(number)
        if (!record || !stay) continue
        if (!doneToday(number, 'Stay Over')) {
          added.push({
            id: ++nextId,
            room: number,
            type: 'Stay Over',
            zone: zoneOf(record),
            priority: 'Normal',
            attendant: 'Unassigned',
            dueTime: '12:00',
            status: 'Unassigned',
            notes: SERVICE_NOTE,
            day: TODAY,
            linen: linenDue(stay.arrival, TODAY, options.service),
          })
        }
        // Nobody has been inside for days. This is about the guest, not the cleaning.
        if (
          needsWelfareCheck(declinedDays[number] ?? [], TODAY, options.service) &&
          !doneToday(number, 'Inspection')
        ) {
          added.push({
            id: ++nextId,
            room: number,
            type: 'Inspection',
            zone: zoneOf(record),
            priority: 'Urgent',
            attendant: 'Unassigned',
            dueTime: '12:00',
            status: 'Unassigned',
            notes: WELFARE_NOTE,
            day: TODAY,
          })
        }
      }

      for (const area of options.areas) {
        // An area still being typed has no name yet. Nobody can be sent to clean a blank.
        if (!area.name.trim()) continue
        if (!areaDueOn(area, TODAY)) continue
        const times = AREA_TIMES[area.frequency] ?? ['10:00']
        times.forEach((time, index) => {
          if (current.some((t) => t.area === area.id && t.dueTime === time && t.day === TODAY)) return
          added.push({
            id: ++nextId,
            room: times.length > 1 ? `${area.name} (${index === 0 ? 'morning' : 'afternoon'})` : area.name,
            area: area.id,
            type: PUBLIC_AREA,
            zone: area.where,
            priority: 'Normal',
            attendant: 'Unassigned',
            dueTime: time,
            status: 'Unassigned',
            notes: AREA_NOTE,
            day: TODAY,
          })
        })
      }

      return added.length ? [...added, ...current] : current
    })
  }

  // Live priority. Where arrivals today outnumber the rooms that are clean and free, the first dirty rooms of that
  // type (by room number) are High. It reacts at once when a room goes out of service or a booking changes.
  const liveTasks = useMemo<HkTask[]>(() => {
    const high = new Set<string>()
    for (const [type, need] of arrivals.needByType) {
      const ready = rooms.filter(
        (x) => x.type === type && x.status === 'clean' && !arrivals.byRoom.has(x.number),
      ).length
      let short = Math.max(0, need - ready)
      if (short === 0) continue
      const waiting = rooms
        .filter((x) => x.type === type && x.status === 'dirty' && !arrivals.byRoom.has(x.number))
        .map((x) => x.number)
        .sort()
      for (const number of waiting) {
        if (short <= 0) break
        high.add(number)
        short--
      }
    }
    return tasks.map((t) => {
      if (!isActive(t) || t.notes !== AUTO_NOTE) return t
      const priority: HkTask['priority'] = arrivals.byRoom.has(t.room) ? 'Urgent' : high.has(t.room) ? 'High' : 'Normal'
      return priority === t.priority ? t : { ...t, priority }
    })
  }, [tasks, rooms, arrivals])

  // An alert ends as soon as the room is no longer clean (checked in, or dirty again).
  const staleAlerts = Object.keys(readyAlerts).filter((n) => roomByNumber.get(n)?.status !== 'clean')
  if (staleAlerts.length) {
    setReadyAlerts((current) => {
      const next = { ...current }
      for (const n of staleAlerts) delete next[n]
      return next
    })
  }

  const activeByRoom = useMemo(() => {
    const map = new Map<string, HkTask>()
    for (const t of liveTasks) if (isActive(t) && !t.area && !map.has(t.room)) map.set(t.room, t)
    return map
  }, [liveTasks])

  const hkRooms = useMemo<HkRoom[]>(() => {
    return rooms.map((room) => {
      // With inspections off there is no "waiting for inspection": a cleaned room is simply ready.
      // The stored status is kept, so the room goes back to the queue if the feature is switched on again.
      const raw = hkStatusOf(room)
      const status: HkRoom['status'] = inspectionMode === 'off' && raw === 'Clean' ? 'Inspected' : raw
      const task = activeByRoom.get(room.number)
      const waiting = status === 'Dirty' || status === 'Being Cleaned'
      const rushed = waiting && !!task && task.notes.startsWith(RUSH_NOTE)
      const readyTime = threads[room.number]?.readyBy
      const readyBy = rushed && task && readyTime?.taskId === task.id ? readyTime.time : undefined
      let arrival = ''
      if (rushed) arrival = readyBy ? `Front desk rush · ready by ${readyBy}` : 'Front desk rush'
      else if (arrivals.byRoom.has(room.number)) arrival = 'Guest arriving today'
      else if (waiting && task?.priority === 'High') arrival = `Needed for a ${room.type} arrival today`
      return {
        room: room.number,
        type: room.type,
        floor: floorOf(room),
        zone: zoneOf(room),
        status,
        priority: task?.priority ?? 'Normal',
        attendant: task?.attendant ?? 'Unassigned',
        arrival,
        reason: room.hkReason,
        rushed,
        readyBy,
      }
    })
  }, [rooms, activeByRoom, arrivals, threads, inspectionMode])

  const allDefects = useMemo(() => {
    const out: HkValue['allDefects'] = []
    for (const [room, d] of Object.entries(details)) for (const defect of d.defects) out.push({ room, defect })
    return out
  }, [details])

  // Every room's history in one list, newest first, so the cleaning record does not have to open each room.
  const allHistory = useMemo(() => {
    const out: HkValue['allHistory'] = []
    for (const [room, d] of Object.entries(details)) for (const entry of d.history) out.push({ room, entry })
    return out.sort((a, b) => b.entry.day.localeCompare(a.entry.day) || b.entry.time.localeCompare(a.entry.time))
  }, [details])

  const counts = useMemo(() => {
    let toClean = 0
    let toInspect = 0
    let exceptions = 0
    let requests = 0
    for (const r of hkRooms) {
      if (r.status === 'Dirty' || r.status === 'Being Cleaned') toClean++
      else if (r.status === 'Clean') toInspect++
      else if (r.status === 'Out of Service' || r.status === 'Out of Order' || r.status === 'Discrepancy') exceptions++
      if (r.rushed && !r.readyBy) requests++
    }
    const openDefects = allDefects.filter((d) => d.defect.status !== 'Resolved').length
    return { toClean, openTasks: tasks.filter(isActive).length, toInspect, issues: openDefects + exceptions, requests }
  }, [hkRooms, tasks, allDefects])

  // ---- helpers ----
  function patchDetails(room: string, change: (d: RoomDetails) => RoomDetails) {
    setDetails((current) => ({ ...current, [room]: change(current[room] ?? defaultDetails()) }))
  }

  function patchThread(room: string, change: (t: Thread) => Thread) {
    setThreads((current) => ({ ...current, [room]: change(current[room] ?? { messages: [] }) }))
  }

  function withMessage(t: Thread, from: RoomMessage['from'], text: string): Thread {
    return { ...t, messages: [...t.messages, { id: uid(), time: clock(), from, text }] }
  }

  function log(room: string, action: string, note: string, user = 'Housekeeping') {
    patchDetails(room, (d) => ({
      ...d,
      history: [{ id: uid(), day: TODAY, time: clock(), action, user, note }, ...d.history],
    }))
  }

  function setActiveTaskStatus(room: string, status: HkTask['status']) {
    setTasks((current) => {
      const target = current.find((t) => t.room === room && isActive(t) && !t.area)
      return target ? current.map((t) => (t.id === target.id ? { ...t, status } : t)) : current
    })
  }

  // Rule: does a freshly cleaned room need a supervisor?
  // Off: never. A room the front desk rushed: skipped if the hotel chose that. Every room: always.
  // Spot-check: a room with a guest arriving today (if the hotel chose that), otherwise 1 in N.
  function needsInspection(room: string, rushed: boolean): boolean {
    if (inspectionMode === 'off') return false
    if (rushed && options.skipRushed) return false
    if (inspectionMode === 'every') return true
    if (options.alwaysInspectArrivals && arrivals.byRoom.has(room)) return true
    spotCounter.current += 1
    const every = Math.max(1, Math.round(100 / Math.max(1, options.spotPercent)))
    return (spotCounter.current - 1) % every === 0
  }

  // One place for "the attendant finished this room", used by both the Rooms page and the Tasks page.
  function completeCleaning(room: string, rushed: boolean, attendant?: string) {
    const inspect = needsInspection(room, rushed)
    setHousekeeping(room, inspect ? 'cleaned' : 'ready')
    patchDetails(room, (d) => ({ ...d, lastCleaned: `Today ${clock()}` }))
    let note = 'Ready for inspection.'
    if (!inspect) {
      if (inspectionMode === 'off') note = 'Room ready. This hotel does not use inspections.'
      else if (rushed && options.skipRushed) note = 'Room ready. Rushed by the front desk, so inspection was skipped.'
      else note = 'Room ready. Not picked for inspection (spot-check).'
    }
    log(room, 'Cleaning completed', note, attendant && attendant !== 'Unassigned' ? attendant : 'Housekeeping')
    if (rushed) setReadyAlerts((current) => ({ ...current, [room]: clock() }))
  }

  // ---- rooms ----
  function advanceRoom(room: HkRoom) {
    const next = nextStatus(room.status)
    if (!next) return
    if (next === 'Being Cleaned') {
      setHousekeeping(room.room, 'cleaning')
      setActiveTaskStatus(room.room, 'In Progress')
      log(
        room.room,
        'Cleaning started',
        'Started cleaning.',
        room.attendant && room.attendant !== 'Unassigned' ? room.attendant : 'Housekeeping',
      )
    } else if (next === 'Clean') {
      setActiveTaskStatus(room.room, 'Completed')
      completeCleaning(room.room, !!room.rushed, room.attendant)
    } else if (next === 'Inspected') {
      inspectRoom(room.room, true, '')
    }
  }

  function moveRoomBack(room: HkRoom) {
    // With inspections off, "Inspected" is really "just cleaned", so the step back is to Being Cleaned.
    const previous =
      inspectionMode === 'off' && room.status === 'Inspected' ? 'Being Cleaned' : previousStatus(room.status)
    if (!previous) return
    if (previous === 'Dirty') {
      setHousekeeping(room.room, 'dirty')
    } else if (previous === 'Being Cleaned') {
      setHousekeeping(room.room, 'cleaning')
      // Reopen the last finished task so the work stays on record.
      setTasks((current) => {
        const last = [...current].reverse().find((t) => t.room === room.room && t.status === 'Completed')
        return last ? current.map((t) => (t.id === last.id ? { ...t, status: 'In Progress' as const } : t)) : current
      })
    } else {
      setHousekeeping(room.room, 'cleaned')
    }
    log(room.room, 'Status moved back', `Moved back to ${previous}.`)
  }

  function inspectRoom(room: string, pass: boolean, note: string) {
    if (pass) {
      setHousekeeping(room, 'ready')
      patchDetails(room, (d) => ({
        ...d,
        inspectedBy: 'Supervisor',
        inspectionNote: note.trim() || 'Inspection passed. Room ready for guest use.',
      }))
      log(room, 'Inspection passed', note.trim() || 'Room accepted.', 'Supervisor')
      return
    }
    // A failed inspection sends the room back with an urgent re-clean.
    const record = roomByNumber.get(room)
    setHousekeeping(room, 'dirty')
    patchDetails(room, (d) => ({ ...d, inspectedBy: 'Supervisor', inspectionNote: `Failed: ${note.trim()}` }))
    log(room, 'Inspection failed', note.trim(), 'Supervisor')
    setTasks((current) => [
      {
        id: current.reduce((m, t) => Math.max(m, t.id), 0) + 1,
        room,
        type: 'Departure Clean',
        zone: record ? zoneOf(record) : '',
        priority: 'Urgent',
        attendant: 'Unassigned',
        dueTime: CHECKIN_TIME,
        status: 'Unassigned',
        notes: `Failed inspection: ${note.trim()}`,
      },
      ...current,
    ])
  }

  function setException(room: string, kind: ExceptionKind, reason: string) {
    setHousekeeping(room, kind, reason.trim())
    if (kind !== 'discrepancy') {
      setTasks((current) =>
        current.map((t) => (t.room === room && isActive(t) ? { ...t, status: 'Cancelled' as const } : t)),
      )
    }
    log(room, exceptionLabel[kind], reason.trim())
  }

  // Back into the normal flow. A vacant room goes to Dirty so it is cleaned before it is sold again.
  function resetRoom(room: string) {
    setHousekeeping(room, 'dirty')
    log(room, 'Issue cleared', 'Room returned to the normal flow.')
  }

  // ---- front desk and housekeeping talking ----
  // The front desk asks for a room to be cleaned first: the task becomes Urgent and stays Urgent.
  function rushRoom(room: string, note: string) {
    const text = note.trim()
    setTasks((current) =>
      current.map((t) =>
        t.room === room && isActive(t)
          ? { ...t, priority: 'Urgent' as const, notes: text ? `${RUSH_NOTE}: ${text}` : `${RUSH_NOTE}.` }
          : t,
      ),
    )
    patchThread(room, (t) =>
      withMessage(t, 'Front desk', text ? `Please clean this room first. ${text}` : 'Please clean this room first.'),
    )
    log(room, 'Rush requested', text || 'Front desk asked for this room first.', 'Front desk')
  }

  function sendMessage(room: string, from: RoomMessage['from'], text: string) {
    const clean = text.trim()
    if (!clean) return
    patchThread(room, (t) => withMessage(t, from, clean))
  }

  // Housekeeping tells the front desk when the room will be ready.
  function setReadyBy(room: string, time: string) {
    const task = activeByRoom.get(room)
    if (!task) return
    patchThread(room, (t) => ({ ...withMessage(t, 'Housekeeping', `Ready by ${time}.`), readyBy: { time, taskId: task.id } }))
    log(room, 'Ready time given', `Ready by ${time}.`)
  }

  function threadOf(room: string) {
    const t = threads[room]
    const task = activeByRoom.get(room)
    const readyTime = t?.readyBy
    return {
      messages: t?.messages ?? [],
      readyBy: task && readyTime?.taskId === task.id ? readyTime.time : undefined,
    }
  }

  // ---- tasks ----
  function createTask(input: NewTask) {
    const record = input.area ? undefined : roomByNumber.get(input.room)
    // A room task needs a real room. An area task carries its own name and place.
    if (!input.area && !record) return
    setTasks((current) => [
      {
        id: current.reduce((m, t) => Math.max(m, t.id), 0) + 1,
        room: input.room,
        area: input.area,
        type: input.type,
        zone: record ? zoneOf(record) : (input.zone ?? ''),
        priority: input.priority,
        attendant: input.attendant,
        dueTime: input.dueTime,
        status: input.attendant === 'Unassigned' ? 'Unassigned' : 'Assigned',
        notes: input.notes.trim(),
        day: TODAY,
      },
      ...current,
    ])
  }

  /** What the attendant recorded, written into the room's own record so a supervisor can read it later. */
  function workNote(task: HkTask, checklist: string[], finishedAt: string): string {
    const parts: string[] = []
    if (task.startedAt) {
      const minutes = minutesBetween(task.startedAt, finishedAt)
      if (minutes >= 0) {
        parts.push(`Took ${minutes} minute${minutes === 1 ? '' : 's'}.`)
        if (tooQuick(task.type, minutes)) parts.push('Faster than this work usually takes. Worth a check.')
      }
    }
    if (task.linen) parts.push('Sheets were due today.')
    if (checklist.length) parts.push(`Done: ${checklist.join(', ')}.`)
    return parts.join(' ') || 'Task completed.'
  }

  function advanceTask(task: HkTask, checklist: string[] = []) {
    const next = nextTaskStatus(task.status)
    if (!next) return
    const at = clock()
    setTasks((current) =>
      current.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: next,
              startedAt: next === 'In Progress' ? at : t.startedAt,
              finishedAt: next === 'Completed' ? at : t.finishedAt,
              checklist: next === 'Completed' && checklist.length ? checklist : t.checklist,
            }
          : t,
      ),
    )
    const who = task.attendant && task.attendant !== 'Unassigned' ? task.attendant : 'Housekeeping'
    if (cleanTypes.includes(task.type)) {
      if (next === 'In Progress') {
        setHousekeeping(task.room, 'cleaning')
        log(task.room, 'Cleaning started', `Started the ${task.type.toLowerCase()}.`, who)
      }
      if (next === 'Completed') {
        completeCleaning(task.room, task.notes.startsWith(RUSH_NOTE), task.attendant)
        if (checklist.length || task.startedAt) {
          log(task.room, 'Work recorded', workNote(task, checklist, at), who)
        }
      }
      return
    }
    if (next === 'In Progress') {
      log(task.room, `${task.type} started`, 'Work started.', who)
      return
    }
    if (next === 'Completed') {
      const title = task.type === 'Stay Over' ? 'Daily service done' : `${task.type} done`
      log(task.room, title, workNote(task, checklist, at), who)
    }
  }

  /** The guest refused the service. That is an answer, not work nobody did, and it is counted. */
  function declineTask(task: HkTask, reason: string) {
    const days = declinedDays[task.room] ?? []
    const withToday = days.includes(TODAY) ? days : [...days, TODAY]
    // Checked here rather than once a morning, so the supervisor is raised the moment the run is reached.
    const escalate = !task.area && needsWelfareCheck(withToday, TODAY, options.service)
    const record = roomByNumber.get(task.room)
    setTasks((current) => {
      const marked = current.map((t) =>
        t.id === task.id ? { ...t, status: 'Cancelled' as const, declined: true } : t,
      )
      if (!escalate || !record) return marked
      const already = marked.some((t) => t.room === task.room && t.type === 'Inspection' && t.day === TODAY)
      if (already) return marked
      return [
        {
          id: marked.reduce((m, t) => Math.max(m, t.id), 0) + 1,
          room: task.room,
          type: 'Inspection' as const,
          zone: zoneOf(record),
          priority: 'Urgent' as const,
          attendant: 'Unassigned',
          dueTime: clock(),
          status: 'Unassigned' as const,
          notes: WELFARE_NOTE,
          day: TODAY,
        },
        ...marked,
      ]
    })
    setDeclinedDays((current) => ({ ...current, [task.room]: withToday }))
    if (escalate) {
      log(
        task.room,
        'Welfare check raised',
        `No service for ${declinedRun(withToday, TODAY)} days running. A supervisor must enter the room.`,
      )
    }
    const who = task.attendant && task.attendant !== 'Unassigned' ? task.attendant : 'Housekeeping'
    log(task.room, 'Service declined', reason.trim() || 'The guest asked not to be disturbed.', who)
  }

  function assignTask(taskId: number, attendant: string) {
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? {
              ...t,
              attendant,
              status: attendant === 'Unassigned' ? 'Unassigned' : t.status === 'Unassigned' ? 'Assigned' : t.status,
            }
          : t,
      ),
    )
  }

  function cancelTask(taskId: number) {
    setTasks((current) => current.map((t) => (t.id === taskId ? { ...t, status: 'Cancelled' as const } : t)))
  }

  // ---- room details ----
  function setMinibarUsed(room: string, index: number, value: number) {
    patchDetails(room, (d) => ({
      ...d,
      minibar: d.minibar.map((item, i) =>
        i === index ? { ...item, used: Math.max(0, Math.min(item.quantity, value)) } : item,
      ),
    }))
  }

  function setLinenFound(room: string, index: number, value: number) {
    patchDetails(room, (d) => ({
      ...d,
      linen: d.linen.map((item, i) =>
        i === index ? { ...item, found: Math.max(0, Math.min(item.expected, value)) } : item,
      ),
    }))
  }

  function addPhoto(room: string) {
    patchDetails(room, (d) => ({ ...d, photos: [...d.photos, `Photo ${d.photos.length + 1}`] }))
    log(room, 'Room photo added', 'Photo placeholder added.')
  }

  // ---- defects and maintenance ----
  function patchDefect(room: string, defectId: number, change: Partial<RoomDefect>) {
    patchDetails(room, (d) => ({
      ...d,
      defects: d.defects.map((x) => (x.id === defectId ? { ...x, ...change } : x)),
    }))
  }

  // Rule: a problem that takes the room out of sale goes straight to maintenance. In a hotel without
  // full maintenance there is no separate "request" step, so reporting is requesting.
  function reportDefect(
    room: string,
    input: { category: string; severity: RoomDefect['severity']; description: string; blocksRoom?: BlockKind },
  ) {
    const text = input.description.trim()
    const status: DefectStatus = input.blocksRoom || !features.maintenanceFull ? 'Maintenance Requested' : 'Open'
    patchDetails(room, (d) => ({
      ...d,
      defects: [
        {
          id: d.defects.reduce((m, x) => Math.max(m, x.id), 0) + 1,
          category: input.category,
          severity: input.severity,
          description: text,
          status,
          reportedAt: clock(),
          blocksRoom: input.blocksRoom,
        },
        ...d.defects,
      ],
    }))
    log(room, 'Defect reported', text)
    if (input.blocksRoom) setException(room, input.blocksRoom, text)
  }

  function requestMaintenance(room: string, defectId: number) {
    patchDefect(room, defectId, { status: 'Maintenance Requested' })
    log(room, 'Maintenance request created', `Maintenance requested for defect #${defectId}.`)
  }

  function assignDefect(room: string, defectId: number, technician: string) {
    patchDefect(room, defectId, { technician: technician === 'Unassigned' ? undefined : technician })
    log(room, 'Technician assigned', `${technician} for defect #${defectId}.`, 'Maintenance')
  }

  function startDefect(room: string, defectId: number) {
    patchDefect(room, defectId, { status: 'In Progress' })
    log(room, 'Repair started', `Work started on defect #${defectId}.`, 'Maintenance')
  }

  // Closing a repair. If it was what kept the room out of sale (and nothing else does), the room is released
  // to Dirty so it is cleaned before it is sold.
  function closeDefect(room: string, defectId: number, note: string) {
    const all = details[room]?.defects ?? []
    const defect = all.find((x) => x.id === defectId)
    if (!defect) return
    patchDefect(room, defectId, { status: 'Resolved', note: note || defect.note })
    log(room, 'Defect resolved', note ? `Defect #${defectId} closed. ${note}` : `Defect #${defectId} closed.`, 'Maintenance')
    if (!defect.blocksRoom) return
    const stillBlocked = all.some((x) => x.id !== defectId && x.blocksRoom && x.status !== 'Resolved')
    const blockedAs = roomByNumber.get(room)?.hk
    if (!stillBlocked && (blockedAs === 'out-of-service' || blockedAs === 'out-of-order')) {
      setHousekeeping(room, 'dirty')
      log(room, 'Room released', 'Repair finished. Room sent for cleaning.', 'Maintenance')
    }
  }

  // With repair sign-off on, "done" waits for someone to verify it. Without it, done closes the repair.
  function finishDefect(room: string, defectId: number) {
    if (features.repairSignoff) {
      patchDefect(room, defectId, { status: 'Done' })
      log(room, 'Repair done', `Defect #${defectId} fixed, waiting to be verified.`, 'Maintenance')
    } else {
      closeDefect(room, defectId, '')
    }
  }

  function verifyDefect(room: string, defectId: number, pass: boolean, note: string) {
    if (pass) {
      closeDefect(room, defectId, note.trim())
      return
    }
    patchDefect(room, defectId, { status: 'Maintenance Requested', note: `Reopened: ${note.trim()}` })
    log(room, 'Repair rejected', note.trim() || 'Sent back to maintenance.', 'Supervisor')
  }

  const blockedByRepair = (room: string) =>
    (details[room]?.defects ?? []).some((x) => x.blocksRoom && x.status !== 'Resolved')

  const readyRooms = Object.entries(readyAlerts).map(([room, time]) => ({
    room,
    type: roomByNumber.get(room)?.type ?? '',
    time,
  }))

  function dismissReady(room: string) {
    setReadyAlerts((current) => {
      const next = { ...current }
      delete next[room]
      return next
    })
  }

  const value: HkValue = {
    rooms: hkRooms,
    tasks: liveTasks,
    counts,
    allDefects,
    allHistory,
    detailsOf: (room) => details[room] ?? defaultDetails(),
    stayOf: (room) => stays.get(room),
    threadOf,
    advanceRoom,
    moveRoomBack,
    inspectRoom,
    setException,
    resetRoom,
    createTask,
    advanceTask,
    declineTask,
    areas: options.areas,
    assignTask,
    cancelTask,
    rushRoom,
    sendMessage,
    setReadyBy,
    readyRooms,
    dismissReady,
    setMinibarUsed,
    setLinenFound,
    addPhoto,
    reportDefect,
    requestMaintenance,
    assignDefect,
    startDefect,
    finishDefect,
    verifyDefect,
    resolveDefect: finishDefect,
    blockedByRepair,
  }

  return <HkContext.Provider value={value}>{children}</HkContext.Provider>
}