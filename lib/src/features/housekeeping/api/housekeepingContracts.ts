export type HousekeepingRoomStatus =
  | 'Dirty'
  | 'Being Cleaned'
  | 'Clean'
  | 'Inspected'
  | 'Out of Service'
  | 'Out of Order'
  | 'Discrepancy'

export type HousekeepingPriority = 'Urgent' | 'High' | 'Normal'

export type HousekeepingTaskStatus =
  | 'Unassigned'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'

export type HousekeepingTaskType =
  | 'Departure Clean'
  | 'Stay Over'
  | 'Arrival Preparation'
  | 'Deep Clean'
  | 'Turndown'
  | 'Inspection'

export type HousekeepingRoomSummary = {
  roomId: string
  roomNumber: string
  roomType: string
  zone: string
  status: HousekeepingRoomStatus
  priority: HousekeepingPriority
  attendantId: string | null
  attendantName: string | null
  arrivalTime: string | null
}

export type HousekeepingTaskDto = {
  taskId: string
  roomId: string
  roomNumber: string
  type: HousekeepingTaskType
  zone: string
  priority: HousekeepingPriority
  attendantId: string | null
  attendantName: string | null
  dueTime: string
  status: HousekeepingTaskStatus
  notes: string
}

export type ChangeRoomStatusRequest = {
  roomId: string
  status: HousekeepingRoomStatus
  reason?: string
  idempotencyKey: string
}

export type ChangeRoomStatusResponse = {
  roomId: string
  status: HousekeepingRoomStatus
  changedAt: string
  changedByUserId: string
}

export type RoomStatusChangedEvent = {
  eventId: string
  tenantId: string
  propertyId: string
  roomId: string
  roomNumber: string
  previousStatus: HousekeepingRoomStatus
  status: HousekeepingRoomStatus
  changedAt: string
  changedByUserId: string
}

export type HousekeepingRoomDetailsDto = {
  roomId: string
  roomNumber: string
  occupancy: 'Vacant' | 'Occupied'
  guestName: string | null
  reservationId: string | null
  lastCleanedAt: string | null
  inspectedByUserId: string | null
  inspectionNote: string | null
}

export type CreateHousekeepingTaskRequest = {
  roomId: string
  type: HousekeepingTaskType
  priority: HousekeepingPriority
  attendantId: string | null
  dueTime: string
  notes: string
}

export type HousekeepingApiError = {
  status: number
  code: string
  message: string
  traceId?: string
}

export type PageResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}
