import type { Room, Reservation } from '../../types'
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
export type TaskType = HousekeepingTaskType

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
  room: string
  type: TaskType
  zone: string
  priority: Priority
  attendant: string
  dueTime: string
  status: TaskStatus
  notes: string
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
  note?: string
}

export type RoomHistory = { id: string; time: string; action: string; user: string; note: string }
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
  'Inspection',
]
export const taskStatuses: TaskStatus[] = ['Unassigned', 'Assigned', 'In Progress', 'Completed', 'Cancelled']
export const cleanTypes: TaskType[] = ['Departure Clean', 'Arrival Preparation', 'Deep Clean']

export const statusStyles: Record<HkStatus, string> = {
  Dirty: 'bg-red-50 text-red-700 ring-red-200',
  'Being Cleaned': 'bg-amber-50 text-amber-700 ring-amber-200',
  Clean: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Inspected: 'bg-blue-50 text-blue-700 ring-blue-200',
  'Out of Service': 'bg-orange-50 text-orange-700 ring-orange-200',
  'Out of Order': 'bg-slate-200 text-slate-700 ring-slate-300',
  Discrepancy: 'bg-purple-50 text-purple-700 ring-purple-200',
  Occupied: 'bg-ink/5 text-ink/70 ring-ink/15',
}

export const priorityStyles: Record<Priority, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Normal: 'bg-slate-100 text-slate-600',
}

export const taskStatusStyles: Record<TaskStatus, string> = {
  Unassigned: 'bg-slate-100 text-slate-600',
  Assigned: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
}

export const priorityRank: Record<Priority, number> = { Urgent: 0, High: 1, Normal: 2 }

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

export const defectStatusStyles: Record<DefectStatus, string> = {
  Open: 'bg-slate-100 text-slate-600',
  'Maintenance Requested': 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  Done: 'bg-purple-50 text-purple-700',
  Resolved: 'bg-emerald-50 text-emerald-700',
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
