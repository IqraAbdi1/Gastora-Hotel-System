import { createContext, useContext } from 'react'
import type { HkRequest, Reservation } from '../../types'
import type {
  HkRoom,
  HkTask,
  Priority,
  RoomDefect,
  RoomDetails,
  RoomHistory,
  RoomMessage,
  RoomThread,
  TaskType,
} from './hkModel'

export type NewTask = {
  room: string
  type: TaskType
  priority: Priority
  attendant: string
  dueTime: string
  notes: string
}

export type ExceptionKind = Extract<HkRequest, 'out-of-service' | 'out-of-order' | 'discrepancy'>
export type BlockKind = Extract<ExceptionKind, 'out-of-service' | 'out-of-order'>
export type HkValue = {
  rooms: HkRoom[]
  tasks: HkTask[]
  counts: { toClean: number; openTasks: number; toInspect: number; issues: number; requests: number }
  allDefects: { room: string; defect: RoomDefect }[]

  detailsOf: (room: string) => RoomDetails
  /** Everything that happened in every room, newest first. Used by the cleaning record. */
  allHistory: { room: string; entry: RoomHistory }[]
  stayOf: (room: string) => Reservation | undefined
  threadOf: (room: string) => RoomThread

  advanceRoom: (room: HkRoom) => void
  moveRoomBack: (room: HkRoom) => void
  inspectRoom: (room: string, pass: boolean, note: string) => void
  setException: (room: string, kind: ExceptionKind, reason: string) => void
  resetRoom: (room: string) => void

  createTask: (input: NewTask) => void
  advanceTask: (task: HkTask) => void
  assignTask: (taskId: number, attendant: string) => void
  cancelTask: (taskId: number) => void

  rushRoom: (room: string, note: string) => void
  sendMessage: (room: string, from: RoomMessage['from'], text: string) => void
  setReadyBy: (room: string, time: string) => void
  readyRooms: { room: string; type: string; time: string }[]
  dismissReady: (room: string) => void
  setMinibarUsed: (room: string, index: number, value: number) => void
  setLinenFound: (room: string, index: number, value: number) => void
  addPhoto: (room: string) => void
   reportDefect: (
    room: string,
    input: Pick<RoomDefect, 'category' | 'severity' | 'description'> & { blocksRoom?: BlockKind },
  ) => void
  requestMaintenance: (room: string, defectId: number) => void
  assignDefect: (room: string, defectId: number, technician: string) => void
  startDefect: (room: string, defectId: number) => void
  finishDefect: (room: string, defectId: number) => void
  verifyDefect: (room: string, defectId: number, pass: boolean, note: string) => void
  resolveDefect: (room: string, defectId: number) => void
  /** True while an open repair is what keeps this room out of sale. */
  blockedByRepair: (room: string) => boolean
}

export const HkContext = createContext<HkValue | null>(null)

export function useHousekeeping() {
  const value = useContext(HkContext)
  if (!value) throw new Error('useHousekeeping must be used inside HousekeepingProvider')
  return value
}