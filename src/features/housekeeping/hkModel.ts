import type { Room, Reservation } from '../../types'
import type { Tone } from '../../components/ui'
import type { UsedPart } from '../../lib/parts'
import { floorLabel, floorOf } from '../../lib/rooms'
import type {
  HousekeepingPriority,
  HousekeepingRoomStatus,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
} from './api/housekeepingContracts'

// The status names and flow come from the contracts file, so the screens and the future API agree.
export type HkStatus = HousekeepingRoomStatus | 'Occupied'
export type Priority = HousekeepingPriority
export type TaskStatus = HousekeepingTaskStatus
/**
 * A corridor or the lobby is cleaned too, and it is not a room. The API contract covers rooms only,
 * so this one is added here; the mapper to the API has to handle it when the backend learns about areas.
 */
export const PUBLIC_AREA = 'Public Area'
export type TaskType = HousekeepingTaskType | typeof PUBLIC_AREA

export type HkRoom = {
  room: string
  type: string
  floor: number
  zone: string
  status: HkStatus
  priority: Priority
  attendant: string
  arrival: string
  reason?: string
  rushed?: boolean
  readyBy?: string
}

export type HkTask = {
  id: number
  /** A room number, or the name of a public area. `area` says which. */
  room: string
  type: TaskType
  zone: string
  priority: Priority
  attendant: string
  dueTime: string
  status: TaskStatus
  notes: string
  /** Set on a public area task: the area it belongs to. Room tasks leave it empty. */
  area?: string
  /** The day this work belongs to, so the list is built once a day and not again. */
  day?: string
  /** Clock times, used to show how long the work took. */
  startedAt?: string
  finishedAt?: string
  /** What the attendant recorded doing. */
  checklist?: string[]
  /** A stayover the guest refused. Not the same as work nobody did. */
  declined?: boolean
  /** Stayover only: the sheets are due today, not just the towels. */
  linen?: boolean
}

export type MinibarItem = { name: string; quantity: number; used: number }
export type LinenItem = { name: string; expected: number; found: number }

export type DefectStatus = 'Open' | 'Maintenance Requested' | 'In Progress' | 'Done' | 'Resolved'

export type RoomDefect = {
  id: number
  category: string
  description: string
  severity: 'Low' | 'Medium' | 'High'
  status: DefectStatus
  reportedAt: string
  // Added for maintenance. All optional, so older code keeps working.
  technician?: string
  /** Set when this problem took the room out of sale. Closing the repair releases the room. */
  blocksRoom?: 'out-of-service' | 'out-of-order'
  /** The piece of equipment that failed, when the hotel keeps an asset register. */
  assetId?: string
  /** The day it was reported. `reportedAt` is only a clock time, which cannot answer a question next month. */
  reportedOn?: string
  /** What the repair consumed. Issued parts carry their cost; the rest are still with the store. */
  parts?: UsedPart[]
  /**
   * Real timestamps, for the targets. `reportedAt` is a clock face and `reportedOn` a day; neither can
   * answer "was this picked up within the hour". A defect raised before these existed has none, and the
   * targets say so rather than guessing a time.
   */
  reportedIso?: string
  startedIso?: string
  closedIso?: string
  note?: string
}

/** `day` is what makes the record answer a question asked a week later. */
export type RoomHistory = { id: string; day: string; time: string; action: string; user: string; note: string }
export type RoomMessage = { id: string; time: string; from: 'Front desk' | 'Housekeeping'; text: string }
export type RoomThread = { messages: RoomMessage[]; readyBy?: string }

export type RoomDetails = {
  lastCleaned: string
  inspectedBy: string
  inspectionNote: string
  minibar: MinibarItem[]
  linen: LinenItem[]
  photos: string[]
  defects: RoomDefect[]
  history: RoomHistory[]
}

export type TabKey = 'overview' | 'minibar' | 'linen' | 'defects' | 'history'

// Sample staff and policy values. Real ones come from hotel settings later.
export const attendants = ['Unassigned', 'Sarah', 'John', 'Mary', 'David', 'Grace', 'Peter']
export const technicians = ['Unassigned', 'Joseph', 'Ali', 'Ruth']
export const defectCategories = ['General', 'Bathroom', 'Electrical', 'Furniture', 'HVAC', 'Plumbing']
export const CHECKIN_TIME = '14:00'

// Front desk rush requests start with this text, which also stops the live priority from overriding them.
export const RUSH_NOTE = 'Rush from front desk'

export const statusFlow: HousekeepingRoomStatus[] = ['Dirty', 'Being Cleaned', 'Clean', 'Inspected']
export const exceptionStatuses: HousekeepingRoomStatus[] = ['Out of Service', 'Out of Order', 'Discrepancy']
export const taskTypes: TaskType[] = [
  'Departure Clean',
  'Stay Over',
  'Arrival Preparation',
  'Deep Clean',
  'Turndown',
  PUBLIC_AREA,
  'Inspection',
]
export const taskStatuses: TaskStatus[] = ['Unassigned', 'Assigned', 'In Progress', 'Completed', 'Cancelled']
export const cleanTypes: TaskType[] = ['Departure Clean', 'Arrival Preparation', 'Deep Clean']

// A button says what it does, not what the room becomes.
export const ADVANCE_LABEL: Record<string, string> = {
  'Being Cleaned': 'Start cleaning',
  Clean: 'Mark clean',
  Inspected: 'Mark inspected',
}

export const TASK_ADVANCE_LABEL: Record<TaskStatus, string> = {
  Unassigned: 'Assign',
  Assigned: 'Start',
  'In Progress': 'Finish',
  Completed: 'Done',
  Cancelled: 'Cancelled',
}

export const priorityRank: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2 }

// Colour carries meaning and comes from the shared palette, so a status reads the same here as it does
// on the front desk: good = ready, warn = needs work, bad = a problem, info = under way.
export const statusTone: Record<HkStatus, Tone> = {
  Dirty: 'warn',
  'Being Cleaned': 'info',
  Clean: 'brand',
  Inspected: 'good',
  'Out of Service': 'warn',
  'Out of Order': 'bad',
  Discrepancy: 'accent',
  Occupied: 'neutral',
}

export const priorityTone: Record<Priority, Tone> = { Urgent: 'bad', High: 'warn', Normal: 'neutral' }

export const taskStatusTone: Record<TaskStatus, Tone> = {
  Unassigned: 'neutral',
  Assigned: 'info',
  'In Progress': 'warn',
  Completed: 'good',
  Cancelled: 'bad',
}

export const defectStatusTone: Record<DefectStatus, Tone> = {
  Open: 'neutral',
  'Maintenance Requested': 'info',
  'In Progress': 'warn',
  Done: 'brand',
  Resolved: 'good',
}


// Rule: how urgent a defect is. A problem that takes the room out of sale, or a High severity, is Urgent.
export function defectPriority(d: RoomDefect): Priority {
  if (d.blocksRoom || d.severity === 'High') return 'Urgent'
  return d.severity === 'Medium' ? 'High' : 'Normal'
}

export const defectTarget: Record<Priority, string> = {
  Urgent: 'within 2 hours',
  High: 'today',
  Normal: 'within 3 days',
}

export function nextStatus(status: HkStatus): HousekeepingRoomStatus | null {
  const i = statusFlow.indexOf(status as HousekeepingRoomStatus)
  return i === -1 || i === statusFlow.length - 1 ? null : statusFlow[i + 1]
}

export function previousStatus(status: HkStatus): HousekeepingRoomStatus | null {
  const i = statusFlow.indexOf(status as HousekeepingRoomStatus)
  return i <= 0 ? null : statusFlow[i - 1]
}

export function nextTaskStatus(status: TaskStatus): TaskStatus | null {
  if (status === 'Unassigned') return 'Assigned'
  if (status === 'Assigned') return 'In Progress'
  if (status === 'In Progress') return 'Completed'
  return null
}

export const isActive = (t: HkTask) => t.status !== 'Completed' && t.status !== 'Cancelled'

// The housekeeping view of a room, worked out from the shared room record.
export function hkStatusOf(room: Room): HkStatus {
  if (room.hk === 'out-of-service') return 'Out of Service'
  if (room.hk === 'out-of-order') return 'Out of Order'
  if (room.hk === 'discrepancy') return 'Discrepancy'
  if (room.status === 'occupied') return 'Occupied'
  if (room.status === 'blocked') return 'Out of Service'
  if (room.status === 'dirty') return room.hk === 'cleaning' ? 'Being Cleaned' : 'Dirty'
  return room.hk === 'cleaned' ? 'Clean' : 'Inspected'
}

export const zoneOf = (room: Room) => floorLabel(floorOf(room))

/**
 * What to call a place in a list. Rooms are numbered and read as "Room 102"; a public area already
 * has a name of its own and must not be called a room.
 */
export const placeLabel = (name: string) => (/^\d/.test(name) ? `Room ${name}` : name)

export function defaultDetails(): RoomDetails {
  return {
    lastCleaned: '—',
    inspectedBy: '—',
    inspectionNote: 'No inspection recorded yet.',
    minibar: [
      { name: 'Water', quantity: 2, used: 0 },
      { name: 'Soda', quantity: 2, used: 0 },
      { name: 'Juice', quantity: 2, used: 0 },
    ],
    linen: [
      { name: 'Bath towels', expected: 2, found: 2 },
      { name: 'Hand towels', expected: 2, found: 2 },
      { name: 'Bed sheets', expected: 1, found: 1 },
    ],
    photos: [],
    defects: [],
    history: [],
  }
}

let counter = 0
export const uid = () => `${Date.now()}-${counter++}`

export const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// A guest staying in this room, if any, from the shared reservations.
export function stayIndex(reservations: Reservation[]) {
  const map = new Map<string, Reservation>()
  for (const r of reservations) if (r.status === 'in-house' && r.room) map.set(r.room, r)
  return map
}

export const inMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

// Sample average clean times in minutes. In the real system these come from the hotel's own cleaning records.
export const cleanMinutes: Record<string, number> = { Standard: 30, Deluxe: 40, Suite: 60 }

// Rough time a room will be ready: now plus the average clean time (half of it if cleaning has already started).
export function estimateReady(room: HkRoom): string {
  const full = cleanMinutes[room.type] ?? 35
  return inMinutes(room.status === 'Being Cleaned' ? Math.ceil(full / 2) : full)
}
