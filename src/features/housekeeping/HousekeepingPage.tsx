import { useMemo, useState } from 'react'

type RoomStatus =
  | 'Dirty'
  | 'Being Cleaned'
  | 'Clean'
  | 'Inspected'
  | 'Out of Service'
  | 'Out of Order'
  | 'Discrepancy'

type Priority = 'Urgent' | 'High' | 'Normal'

type TaskStatus =
  | 'Unassigned'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled'

type TaskType =
  | 'Departure Clean'
  | 'Stay Over'
  | 'Arrival Preparation'
  | 'Deep Clean'
  | 'Turndown'
  | 'Inspection'

type Room = {
  room: string
  type: string
  zone: string
  status: RoomStatus
  priority: Priority
  attendant: string
  arrival: string
}

type HousekeepingTask = {
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

type MinibarItem = {
  name: string
  quantity: number
  used: number
}

type LinenItem = {
  name: string
  expected: number
  found: number
}

type RoomDefect = {
  id: number
  category: string
  description: string
  severity: 'Low' | 'Medium' | 'High'
  status: 'Open' | 'Maintenance Requested' | 'Resolved'
  reportedAt: string
}

type RoomHistory = {
  id: number
  time: string
  action: string
  user: string
  note: string
}

type RoomDetails = {
  occupancy: 'Vacant' | 'Occupied'
  guest: string
  reservation: string
  lastCleaned: string
  inspectedBy: string
  inspectionNote: string
  minibar: MinibarItem[]
  linen: LinenItem[]
  photos: string[]
  defects: RoomDefect[]
  history: RoomHistory[]
}

const initialRooms: Room[] = [
  {
    room: '101',
    type: 'Deluxe King',
    zone: 'Ground Floor',
    status: 'Dirty',
    priority: 'High',
    attendant: 'Sarah',
    arrival: '14:00',
  },
  {
    room: '102',
    type: 'Standard Twin',
    zone: 'Ground Floor',
    status: 'Being Cleaned',
    priority: 'High',
    attendant: 'John',
    arrival: '15:00',
  },
  {
    room: '201',
    type: 'Executive Suite',
    zone: 'East Wing',
    status: 'Clean',
    priority: 'Normal',
    attendant: 'Mary',
    arrival: '16:30',
  },
  {
    room: '202',
    type: 'Deluxe King',
    zone: 'East Wing',
    status: 'Inspected',
    priority: 'Normal',
    attendant: 'David',
    arrival: '17:00',
  },
  {
    room: '301',
    type: 'Standard Queen',
    zone: 'West Wing',
    status: 'Dirty',
    priority: 'Urgent',
    attendant: 'Grace',
    arrival: '13:30',
  },
  {
    room: '302',
    type: 'Deluxe Twin',
    zone: 'West Wing',
    status: 'Clean',
    priority: 'Normal',
    attendant: 'Peter',
    arrival: '18:00',
  },
]

const initialTasks: HousekeepingTask[] = [
  {
    id: 1,
    room: '101',
    type: 'Departure Clean',
    zone: 'Ground Floor',
    priority: 'High',
    attendant: 'Sarah',
    dueTime: '13:30',
    status: 'Assigned',
    notes: 'Prepare room for 14:00 arrival.',
  },
  {
    id: 2,
    room: '102',
    type: 'Departure Clean',
    zone: 'Ground Floor',
    priority: 'High',
    attendant: 'John',
    dueTime: '14:30',
    status: 'In Progress',
    notes: 'Check minibar and linen.',
  },
  {
    id: 3,
    room: '201',
    type: 'Arrival Preparation',
    zone: 'East Wing',
    priority: 'Normal',
    attendant: 'Mary',
    dueTime: '16:00',
    status: 'Assigned',
    notes: 'Guest arriving at 16:30.',
  },
  {
    id: 4,
    room: '202',
    type: 'Inspection',
    zone: 'East Wing',
    priority: 'Normal',
    attendant: 'David',
    dueTime: '16:30',
    status: 'Completed',
    notes: 'Supervisor inspection completed.',
  },
  {
    id: 5,
    room: '301',
    type: 'Departure Clean',
    zone: 'West Wing',
    priority: 'Urgent',
    attendant: 'Grace',
    dueTime: '13:00',
    status: 'Assigned',
    notes: 'Priority arrival preparation.',
  },
]


const initialDetails: Record<string, RoomDetails> = {
  '101': { occupancy: 'Vacant', guest: '—', reservation: 'ARR-1048', lastCleaned: 'Today 09:15', inspectedBy: '—', inspectionNote: 'Awaiting cleaning and inspection.', minibar: [{ name: 'Water', quantity: 2, used: 0 }, { name: 'Soda', quantity: 2, used: 1 }, { name: 'Juice', quantity: 2, used: 0 }], linen: [{ name: 'Bath towels', expected: 2, found: 2 }, { name: 'Hand towels', expected: 2, found: 1 }, { name: 'Bed sheets', expected: 1, found: 1 }], photos: ['Room entrance', 'Bathroom', 'Bed area'], defects: [], history: [{ id: 1, time: '09:15', action: 'Checkout', user: 'Front Desk', note: 'Room moved to Dirty.' }] },
  '102': { occupancy: 'Vacant', guest: '—', reservation: 'ARR-1051', lastCleaned: 'Today 10:05', inspectedBy: '—', inspectionNote: 'Cleaning in progress.', minibar: [{ name: 'Water', quantity: 2, used: 0 }, { name: 'Soda', quantity: 2, used: 0 }, { name: 'Juice', quantity: 2, used: 1 }], linen: [{ name: 'Bath towels', expected: 2, found: 2 }, { name: 'Hand towels', expected: 2, found: 2 }, { name: 'Bed sheets', expected: 1, found: 1 }], photos: ['Room entrance'], defects: [{ id: 1, category: 'Bathroom', description: 'Faucet handle is loose.', severity: 'Medium', status: 'Open', reportedAt: '10:12' }], history: [{ id: 1, time: '10:05', action: 'Cleaning started', user: 'John', note: 'Departure clean in progress.' }] },
  '201': { occupancy: 'Vacant', guest: '—', reservation: 'ARR-1054', lastCleaned: 'Today 11:20', inspectedBy: '—', inspectionNote: 'Clean and awaiting supervisor inspection.', minibar: [{ name: 'Water', quantity: 2, used: 0 }, { name: 'Soda', quantity: 2, used: 0 }, { name: 'Juice', quantity: 2, used: 0 }], linen: [{ name: 'Bath towels', expected: 2, found: 2 }, { name: 'Hand towels', expected: 2, found: 2 }, { name: 'Bed sheets', expected: 1, found: 1 }], photos: ['Suite entrance', 'Living area'], defects: [], history: [{ id: 1, time: '11:20', action: 'Cleaning completed', user: 'Mary', note: 'Ready for inspection.' }] },
  '202': { occupancy: 'Occupied', guest: 'Daniel Okello', reservation: 'RES-2042', lastCleaned: 'Today 08:40', inspectedBy: 'David', inspectionNote: 'Inspection passed. Room ready for guest use.', minibar: [{ name: 'Water', quantity: 2, used: 1 }, { name: 'Soda', quantity: 2, used: 0 }, { name: 'Juice', quantity: 2, used: 0 }], linen: [{ name: 'Bath towels', expected: 2, found: 2 }, { name: 'Hand towels', expected: 2, found: 2 }, { name: 'Bed sheets', expected: 1, found: 1 }], photos: ['Bedroom', 'Bathroom'], defects: [], history: [{ id: 1, time: '09:00', action: 'Inspection passed', user: 'David', note: 'Room accepted.' }] },
  '301': { occupancy: 'Vacant', guest: '—', reservation: 'ARR-1044', lastCleaned: 'Yesterday 18:30', inspectedBy: '—', inspectionNote: 'Urgent departure clean required.', minibar: [{ name: 'Water', quantity: 2, used: 0 }, { name: 'Soda', quantity: 2, used: 0 }, { name: 'Juice', quantity: 2, used: 0 }], linen: [{ name: 'Bath towels', expected: 2, found: 0 }, { name: 'Hand towels', expected: 2, found: 0 }, { name: 'Bed sheets', expected: 1, found: 0 }], photos: [], defects: [], history: [{ id: 1, time: '08:30', action: 'Checkout', user: 'Front Desk', note: 'Urgent arrival preparation.' }] },
  '302': { occupancy: 'Vacant', guest: '—', reservation: 'ARR-1057', lastCleaned: 'Today 12:10', inspectedBy: '—', inspectionNote: 'Clean and awaiting supervisor inspection.', minibar: [{ name: 'Water', quantity: 2, used: 0 }, { name: 'Soda', quantity: 2, used: 0 }, { name: 'Juice', quantity: 2, used: 0 }], linen: [{ name: 'Bath towels', expected: 2, found: 2 }, { name: 'Hand towels', expected: 2, found: 2 }, { name: 'Bed sheets', expected: 1, found: 1 }], photos: ['Bedroom'], defects: [], history: [{ id: 1, time: '12:10', action: 'Cleaning completed', user: 'Peter', note: 'Ready for inspection.' }] },
}

const attendants = [
  'Unassigned',
  'Sarah',
  'John',
  'Mary',
  'David',
  'Grace',
  'Peter',
]

const statusStyles: Record<RoomStatus, string> = {
  Dirty: 'bg-red-50 text-red-700 ring-red-200',
  'Being Cleaned': 'bg-amber-50 text-amber-700 ring-amber-200',
  Clean: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Inspected: 'bg-blue-50 text-blue-700 ring-blue-200',
  'Out of Service': 'bg-orange-50 text-orange-700 ring-orange-200',
  'Out of Order': 'bg-slate-200 text-slate-700 ring-slate-300',
  Discrepancy: 'bg-purple-50 text-purple-700 ring-purple-200',
}

const priorityStyles: Record<Priority, string> = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Normal: 'bg-slate-100 text-slate-600',
}

const taskStatusStyles: Record<TaskStatus, string> = {
  Unassigned: 'bg-slate-100 text-slate-600',
  Assigned: 'bg-blue-50 text-blue-700',
  'In Progress': 'bg-amber-50 text-amber-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
}

const statusFlow: RoomStatus[] = [
  'Dirty',
  'Being Cleaned',
  'Clean',
  'Inspected',
]

const exceptionStatuses: RoomStatus[] = [
  'Out of Service',
  'Out of Order',
  'Discrepancy',
]

const taskTypes: TaskType[] = [
  'Departure Clean',
  'Stay Over',
  'Arrival Preparation',
  'Deep Clean',
  'Turndown',
  'Inspection',
]

const taskStatuses: TaskStatus[] = [
  'Unassigned',
  'Assigned',
  'In Progress',
  'Completed',
  'Cancelled',
]

function getNextStatus(status: RoomStatus): RoomStatus | null {
  const index = statusFlow.indexOf(status)

  if (index === -1 || index === statusFlow.length - 1) {
    return null
  }

  return statusFlow[index + 1]
}

function getPreviousStatus(status: RoomStatus): RoomStatus | null {
  const index = statusFlow.indexOf(status)

  if (index <= 0) {
    return null
  }

  return statusFlow[index - 1]
}

function isNormalStatus(status: RoomStatus) {
  return statusFlow.includes(status)
}

function getNextTaskStatus(
  status: TaskStatus,
): TaskStatus | null {
  if (status === 'Unassigned') {
    return 'Assigned'
  }

  if (status === 'Assigned') {
    return 'In Progress'
  }

  if (status === 'In Progress') {
    return 'Completed'
  }

  return null
}

export default function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [tasks, setTasks] =
    useState<HousekeepingTask[]>(initialTasks)

  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('All zones')
  const [statusFilter, setStatusFilter] = useState('All statuses')

  const [taskSearch, setTaskSearch] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] =
    useState('All task statuses')
  const [taskPriorityFilter, setTaskPriorityFilter] =
    useState('All priorities')

  const [exceptionRoom, setExceptionRoom] =
    useState<Room | null>(null)

  const [exceptionType, setExceptionType] =
    useState<RoomStatus>('Discrepancy')

  const [exceptionReason, setExceptionReason] = useState('')

  const [showTaskForm, setShowTaskForm] = useState(false)

  const [taskRoom, setTaskRoom] = useState('101')
  const [taskType, setTaskType] =
    useState<TaskType>('Departure Clean')
  const [taskZone, setTaskZone] =
    useState('Ground Floor')
  const [taskPriority, setTaskPriority] =
    useState<Priority>('Normal')
  const [taskAttendant, setTaskAttendant] =
    useState('Unassigned')
  const [taskDueTime, setTaskDueTime] = useState('14:00')
  const [taskNotes, setTaskNotes] = useState('')

  const [roomDetails, setRoomDetails] = useState<Record<string, RoomDetails>>(
    () => Object.fromEntries(
      Object.entries(initialDetails).map(([room, value]) => [
        room,
        {
          ...value,
          minibar: value.minibar.map((item) => ({ ...item })),
          linen: value.linen.map((item) => ({ ...item })),
          photos: [...value.photos],
          defects: value.defects.map((item) => ({ ...item })),
          history: value.history.map((item) => ({ ...item })),
        },
      ]),
    ),
  )
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'minibar' | 'linen' | 'defects' | 'history'>('overview')
  const [showDefectForm, setShowDefectForm] = useState(false)
  const [defectCategory, setDefectCategory] = useState('General')
  const [defectSeverity, setDefectSeverity] = useState<RoomDefect['severity']>('Medium')
  const [defectDescription, setDefectDescription] = useState('')



  const selectedRoom = rooms.find((room) => room.room === selectedRoomNumber) ?? null
  const selectedRoomDetails = selectedRoomNumber
    ? roomDetails[selectedRoomNumber] ?? null
    : null

  const zones = useMemo(
    () => ['All zones', ...new Set(rooms.map((room) => room.zone))],
    [rooms],
  )

  const statuses = useMemo(
    () => ['All statuses', ...statusFlow, ...exceptionStatuses],
    [],
  )

  const filteredRooms = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    return rooms.filter((room) => {
      const matchesSearch =
        !searchValue ||
        room.room.toLowerCase().includes(searchValue) ||
        room.type.toLowerCase().includes(searchValue) ||
        room.attendant.toLowerCase().includes(searchValue)

      const matchesZone =
        zoneFilter === 'All zones' || room.zone === zoneFilter

      const matchesStatus =
        statusFilter === 'All statuses' ||
        room.status === statusFilter

      return matchesSearch && matchesZone && matchesStatus
    })
  }, [rooms, search, zoneFilter, statusFilter])

  const filteredTasks = useMemo(() => {
    const searchValue = taskSearch.trim().toLowerCase()

    return tasks.filter((task) => {
      const matchesSearch =
        !searchValue ||
        task.room.toLowerCase().includes(searchValue) ||
        task.type.toLowerCase().includes(searchValue) ||
        task.attendant.toLowerCase().includes(searchValue) ||
        task.zone.toLowerCase().includes(searchValue)

      const matchesStatus =
        taskStatusFilter === 'All task statuses' ||
        task.status === taskStatusFilter

      const matchesPriority =
        taskPriorityFilter === 'All priorities' ||
        task.priority === taskPriorityFilter

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      )
    })
  }, [
    tasks,
    taskSearch,
    taskStatusFilter,
    taskPriorityFilter,
  ])

  const kpis = useMemo(() => {
    const roomsToClean = rooms.filter(
      (room) => room.status === 'Dirty',
    ).length

    const beingCleaned = rooms.filter(
      (room) => room.status === 'Being Cleaned',
    ).length

    const readyForInspection = rooms.filter(
      (room) => room.status === 'Clean',
    ).length

    const inspected = rooms.filter(
      (room) => room.status === 'Inspected',
    ).length

    return [
      {
        label: 'Rooms to clean',
        value: roomsToClean.toString(),
        detail: 'Requires cleaning',
      },
      {
        label: 'Being cleaned',
        value: beingCleaned.toString(),
        detail: 'Currently active',
      },
      {
        label: 'Ready for inspection',
        value: readyForInspection.toString(),
        detail: 'Awaiting inspection',
      },
      {
        label: 'Inspected',
        value: inspected.toString(),
        detail: 'Ready for assignment',
      },
    ]
  }, [rooms])

  const taskSummary = useMemo(() => {
    return {
      total: tasks.length,
      unassigned: tasks.filter(
        (task) => task.status === 'Unassigned',
      ).length,
      assigned: tasks.filter(
        (task) => task.status === 'Assigned',
      ).length,
      inProgress: tasks.filter(
        (task) => task.status === 'In Progress',
      ).length,
      completed: tasks.filter(
        (task) => task.status === 'Completed',
      ).length,
      urgent: tasks.filter(
        (task) => task.priority === 'Urgent',
      ).length,
    }
  }, [tasks])

  const completedCount = rooms.filter(
    (room) =>
      room.status === 'Clean' ||
      room.status === 'Inspected',
  ).length

  const normalRoomCount = rooms.filter((room) =>
    isNormalStatus(room.status),
  ).length

  const workloadPercentage =
    normalRoomCount === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            (completedCount / normalRoomCount) * 100,
          ),
        )

  function updateRoomStatus(
    roomNumber: string,
    nextStatus: RoomStatus,
  ) {
    setRooms((currentRooms) =>
      currentRooms.map((room) =>
        room.room === roomNumber
          ? {
              ...room,
              status: nextStatus,
            }
          : room,
      ),
    )
  }

  function advanceRoom(room: Room) {
    const nextStatus = getNextStatus(room.status)

    if (!nextStatus) {
      return
    }

    updateRoomStatus(room.room, nextStatus)

    if (
      nextStatus === 'Being Cleaned' ||
      nextStatus === 'Clean' ||
      nextStatus === 'Inspected'
    ) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.room === room.room &&
          task.status !== 'Completed' &&
          task.status !== 'Cancelled'
            ? {
                ...task,
                status:
                  nextStatus === 'Being Cleaned'
                    ? 'In Progress'
                    : nextStatus === 'Inspected'
                      ? 'Completed'
                      : task.status,
              }
            : task,
        ),
      )
    }
  }

  function moveRoomBack(room: Room) {
    const previousStatus = getPreviousStatus(room.status)

    if (!previousStatus) {
      return
    }

    updateRoomStatus(room.room, previousStatus)
  }


  function openRoomDetails(roomNumber: string, tab: typeof detailTab = 'overview') {
    setSelectedRoomNumber(roomNumber)
    setDetailTab(tab)
    setShowDefectForm(false)
    setDefectDescription('')
  }

  function closeRoomDetails() {
    setSelectedRoomNumber(null)
    setShowDefectForm(false)
  }

  function updateRoomDetails(
    roomNumber: string,
    updater: (details: RoomDetails) => RoomDetails,
  ) {
    setRoomDetails((current) => {
      const details = current[roomNumber]
      if (!details) return current
      return { ...current, [roomNumber]: updater({
        ...details,
        minibar: details.minibar.map((item) => ({ ...item })),
        linen: details.linen.map((item) => ({ ...item })),
        photos: [...details.photos],
        defects: details.defects.map((item) => ({ ...item })),
        history: [...details.history],
      }) }
    })
  }

  function updateMinibarUsed(index: number, value: number) {
    if (!selectedRoomNumber) return
    updateRoomDetails(selectedRoomNumber, (details) => {
      details.minibar[index].used = Math.max(
        0,
        Math.min(details.minibar[index].quantity, value),
      )
      return details
    })
  }

  function updateLinenFound(index: number, value: number) {
    if (!selectedRoomNumber) return
    updateRoomDetails(selectedRoomNumber, (details) => {
      details.linen[index].found = Math.max(
        0,
        Math.min(details.linen[index].expected, value),
      )
      return details
    })
  }

  function addMockPhoto() {
    if (!selectedRoomNumber) return
    updateRoomDetails(selectedRoomNumber, (details) => {
      details.photos.push(`Photo ${details.photos.length + 1}`)
      details.history.unshift({
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Room photo added',
        user: 'Housekeeping',
        note: 'Frontend photo placeholder added.',
      })
      return details
    })
  }

  function createDefect() {
    if (!selectedRoomNumber || !defectDescription.trim()) return

    updateRoomDetails(selectedRoomNumber, (details) => {
      const nextId = details.defects.length
        ? Math.max(...details.defects.map((item) => item.id)) + 1
        : 1

      details.defects.unshift({
        id: nextId,
        category: defectCategory,
        description: defectDescription.trim(),
        severity: defectSeverity,
        status: 'Open',
        reportedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })

      details.history.unshift({
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Defect reported',
        user: 'Housekeeping',
        note: defectDescription.trim(),
      })

      return details
    })

    setDefectDescription('')
    setShowDefectForm(false)
  }

  function requestMaintenance(defectId: number) {
    if (!selectedRoomNumber) return
    updateRoomDetails(selectedRoomNumber, (details) => {
      details.defects = details.defects.map((defect) =>
        defect.id === defectId
          ? { ...defect, status: 'Maintenance Requested' }
          : defect,
      )
      details.history.unshift({
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Maintenance request created',
        user: 'Housekeeping',
        note: `Maintenance requested for defect #${defectId}.`,
      })
      return details
    })
  }

  function resolveDefect(defectId: number) {
    if (!selectedRoomNumber) return
    updateRoomDetails(selectedRoomNumber, (details) => {
      details.defects = details.defects.map((defect) =>
        defect.id === defectId
          ? { ...defect, status: 'Resolved' }
          : defect,
      )
      details.history.unshift({
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: 'Defect resolved',
        user: 'Maintenance',
        note: `Defect #${defectId} marked resolved.`,
      })
      return details
    })
  }

  function openExceptionDialog(
    room: Room,
    type: RoomStatus,
  ) {
    setExceptionRoom(room)
    setExceptionType(type)
    setExceptionReason('')
  }

  function closeExceptionDialog() {
    setExceptionRoom(null)
    setExceptionReason('')
  }

  function saveException() {
    if (!exceptionRoom || !exceptionReason.trim()) {
      return
    }

    updateRoomStatus(exceptionRoom.room, exceptionType)
    closeExceptionDialog()
  }

  function resolveException(room: Room) {
    updateRoomStatus(room.room, 'Dirty')
  }

  function resetTaskForm() {
    setTaskRoom('101')
    setTaskType('Departure Clean')
    setTaskZone('Ground Floor')
    setTaskPriority('Normal')
    setTaskAttendant('Unassigned')
    setTaskDueTime('14:00')
    setTaskNotes('')
  }

  function openTaskForm() {
    resetTaskForm()
    setShowTaskForm(true)
  }

  function closeTaskForm() {
    setShowTaskForm(false)
    resetTaskForm()
  }

  function createTask() {
    const room = rooms.find(
      (item) => item.room === taskRoom,
    )

    if (!room) {
      return
    }

    const nextId =
      tasks.length === 0
        ? 1
        : Math.max(...tasks.map((task) => task.id)) + 1

    const newTask: HousekeepingTask = {
      id: nextId,
      room: taskRoom,
      type: taskType,
      zone: taskZone,
      priority: taskPriority,
      attendant: taskAttendant,
      dueTime: taskDueTime,
      status:
        taskAttendant === 'Unassigned'
          ? 'Unassigned'
          : 'Assigned',
      notes: taskNotes.trim(),
    }

    setTasks((currentTasks) => [
      newTask,
      ...currentTasks,
    ])

    closeTaskForm()
  }

  function advanceTask(task: HousekeepingTask) {
    const nextStatus = getNextTaskStatus(task.status)

    if (!nextStatus) {
      return
    }

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              status: nextStatus,
            }
          : currentTask,
      ),
    )

    if (nextStatus === 'In Progress') {
      updateRoomStatus(task.room, 'Being Cleaned')
    }

    if (nextStatus === 'Completed') {
      updateRoomStatus(task.room, 'Clean')
    }
  }

  function assignTask(
    taskId: number,
    attendant: string,
  ) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              attendant,
              status:
                attendant === 'Unassigned'
                  ? 'Unassigned'
                  : task.status === 'Unassigned'
                    ? 'Assigned'
                    : task.status,
            }
          : task,
      ),
    )
  }

  function cancelTask(taskId: number) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'Cancelled',
            }
          : task,
      ),
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Operations / Housekeeping
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Housekeeping
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Manage room readiness, housekeeping tasks,
            assignments and daily workload.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={zoneFilter}
            onChange={(event) =>
              setZoneFilter(event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            {zones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-slate-400"
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={openTaskForm}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            + New task
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">
              {kpi.label}
            </p>

            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-3xl font-bold tracking-tight text-slate-900">
                {kpi.value}
              </p>

              <span className="text-right text-xs text-slate-500">
                {kpi.detail}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Room status workflow
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Standard flow: Dirty → Being Cleaned → Clean →
              Inspected.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium">
            {statusFlow.map((status, index) => (
              <div
                key={status}
                className="flex items-center gap-2"
              >
                <span
                  className={`rounded-full px-2.5 py-1 ring-1 ring-inset ${statusStyles[status]}`}
                >
                  {status}
                </span>

                {index < statusFlow.length - 1 && (
                  <span className="text-slate-300">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Room readiness
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Update the operational housekeeping state of
                each room.
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search room..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:bg-white sm:w-56"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    Room
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Zone
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Priority
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Attendant
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    Arrival
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRooms.map((room) => {
                  const nextStatus = getNextStatus(room.status)
                  const previousStatus =
                    getPreviousStatus(room.status)

                  return (
                    <tr
                      key={room.room}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <button
                            type="button"
                            onClick={() => openRoomDetails(room.room)}
                            className="font-semibold text-slate-900 hover:text-blue-700"
                          >
                            Room {room.room}
                          </button>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {room.type}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {room.zone}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[room.status]}`}
                        >
                          {room.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[room.priority]}`}
                        >
                          {room.priority}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {room.attendant}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {room.arrival}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {nextStatus && (
                            <button
                              type="button"
                              onClick={() =>
                                advanceRoom(room)
                              }
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              → {nextStatus}
                            </button>
                          )}

                          {previousStatus && (
                            <button
                              type="button"
                              onClick={() =>
                                moveRoomBack(room)
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Back
                            </button>
                          )}

                          {(room.status === 'Inspected' ||
                            room.status ===
                              'Out of Service' ||
                            room.status ===
                              'Out of Order' ||
                            room.status ===
                              'Discrepancy') && (
                            <button
                              type="button"
                              onClick={() =>
                                resolveException(room)
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Reset
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              openExceptionDialog(
                                room,
                                'Discrepancy',
                              )
                            }
                            className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                          >
                            Issue
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredRooms.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="font-medium text-slate-900">
                No rooms found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Try changing the search or filters.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <p className="text-xs text-slate-500">
              Showing {filteredRooms.length} of {rooms.length}{' '}
              rooms
            </p>

            <p className="text-xs text-slate-500">
              Status changes are currently stored in this
              browser session only.
            </p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Today&apos;s workload
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Current room readiness
                </p>
              </div>

              <span className="text-sm font-semibold text-slate-700">
                {workloadPercentage}%
              </span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{
                  width: `${workloadPercentage}%`,
                }}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Ready
                </p>

                <p className="mt-1 text-lg font-bold text-slate-900">
                  {completedCount}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">
                  Remaining
                </p>

                <p className="mt-1 text-lg font-bold text-slate-900">
                  {Math.max(
                    normalRoomCount - completedCount,
                    0,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-900">
                Task summary
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Today&apos;s housekeeping workload.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Total tasks
                </span>

                <span className="font-semibold text-slate-900">
                  {taskSummary.total}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Unassigned
                </span>

                <span className="font-semibold text-slate-900">
                  {taskSummary.unassigned}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Assigned
                </span>

                <span className="font-semibold text-slate-900">
                  {taskSummary.assigned}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  In progress
                </span>

                <span className="font-semibold text-slate-900">
                  {taskSummary.inProgress}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Completed
                </span>

                <span className="font-semibold text-emerald-700">
                  {taskSummary.completed}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-medium text-slate-600">
                  Urgent
                </span>

                <span className="font-semibold text-red-700">
                  {taskSummary.urgent}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-900">
                Status controls
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Exceptional room states require a reason.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {exceptionStatuses.map((status) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
                >
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status]}`}
                  >
                    {status}
                  </span>

                  <span className="text-xs text-slate-400">
                    Reason required
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Housekeeping tasks
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Assign and track cleaning work by room, attendant,
              priority and due time.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={taskSearch}
              onChange={(event) =>
                setTaskSearch(event.target.value)
              }
              placeholder="Search tasks..."
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />

            <select
              value={taskStatusFilter}
              onChange={(event) =>
                setTaskStatusFilter(event.target.value)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option>All task statuses</option>

              {taskStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <select
              value={taskPriorityFilter}
              onChange={(event) =>
                setTaskPriorityFilter(event.target.value)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option>All priorities</option>
              <option>Urgent</option>
              <option>High</option>
              <option>Normal</option>
            </select>

            <button
              type="button"
              onClick={openTaskForm}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + New task
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">
                  Task
                </th>

                <th className="px-5 py-3 font-semibold">
                  Room
                </th>

                <th className="px-5 py-3 font-semibold">
                  Zone
                </th>

                <th className="px-5 py-3 font-semibold">
                  Priority
                </th>

                <th className="px-5 py-3 font-semibold">
                  Attendant
                </th>

                <th className="px-5 py-3 font-semibold">
                  Due
                </th>

                <th className="px-5 py-3 font-semibold">
                  Status
                </th>

                <th className="px-5 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredTasks.map((task) => {
                const nextTaskStatus = getNextTaskStatus(
                  task.status,
                )

                return (
                  <tr
                    key={task.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {task.type}
                        </p>

                        {task.notes && (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                            {task.notes}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 font-semibold text-slate-700">
                      <button
                        type="button"
                        onClick={() => openRoomDetails(task.room)}
                        className="hover:text-blue-700"
                      >
                        {task.room}
                      </button>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {task.zone}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <select
                        value={task.attendant}
                        onChange={(event) =>
                          assignTask(
                            task.id,
                            event.target.value,
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
                      >
                        {attendants.map((attendant) => (
                          <option
                            key={attendant}
                            value={attendant}
                          >
                            {attendant}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-5 py-4 font-medium text-slate-700">
                      {task.dueTime}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${taskStatusStyles[task.status]}`}
                      >
                        {task.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {nextTaskStatus && (
                          <button
                            type="button"
                            onClick={() => advanceTask(task)}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            → {nextTaskStatus}
                          </button>
                        )}

                        {task.status !== 'Completed' &&
                          task.status !== 'Cancelled' && (
                            <button
                              type="button"
                              onClick={() =>
                                cancelTask(task.id)
                              }
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Cancel
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredTasks.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-slate-900">
              No tasks found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try changing the task search or filters.
            </p>
          </div>
        )}

        <div className="border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            Showing {filteredTasks.length} of {tasks.length}{' '}
            tasks.
          </p>
        </div>
      </section>


      {selectedRoom && selectedRoomDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Housekeeping / Room details
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">
                    Room {selectedRoom.room}
                  </h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[selectedRoom.status]}`}>
                    {selectedRoom.status}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[selectedRoom.priority]}`}>
                    {selectedRoom.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedRoom.type} · {selectedRoom.zone} · Arrival {selectedRoom.arrival}
                </p>
              </div>

              <button
                type="button"
                onClick={closeRoomDetails}
                aria-label="Close room details"
                className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-slate-200 px-6 pt-3">
              {[
                ['overview', 'Overview'],
                ['minibar', 'Minibar'],
                ['linen', 'Linen'],
                [
                  'defects',
                  `Defects (${selectedRoomDetails.defects.filter((item) => item.status !== 'Resolved').length})`,
                ],
                ['history', 'History'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDetailTab(key as typeof detailTab)}
                  className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                    detailTab === key
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Occupancy', selectedRoomDetails.occupancy],
                      ['Guest', selectedRoomDetails.guest],
                      ['Reservation', selectedRoomDetails.reservation],
                      ['Last cleaned', selectedRoomDetails.lastCleaned],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {label}
                        </p>
                        <p className="mt-2 font-semibold text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-slate-900">Inspection</h3>
                        <span className="text-xs text-slate-500">
                          {selectedRoomDetails.inspectedBy === '—'
                            ? 'Pending'
                            : `By ${selectedRoomDetails.inspectedBy}`}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {selectedRoomDetails.inspectionNote}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-5">
                      <h3 className="font-semibold text-slate-900">
                        Current housekeeping task
                      </h3>
                      {tasks
                        .filter(
                          (task) =>
                            task.room === selectedRoom.room &&
                            task.status !== 'Cancelled',
                        )
                        .slice(0, 1)
                        .map((task) => (
                          <div key={task.id} className="mt-3 rounded-lg bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold text-slate-900">{task.type}</span>
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${taskStatusStyles[task.status]}`}>
                                {task.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              {task.attendant} · Due {task.dueTime}
                            </p>
                            {task.notes && (
                              <p className="mt-2 text-sm text-slate-600">{task.notes}</p>
                            )}
                          </div>
                        ))}
                      {!tasks.some(
                        (task) =>
                          task.room === selectedRoom.room &&
                          task.status !== 'Cancelled',
                      ) && (
                        <p className="mt-3 text-sm text-slate-500">
                          No active task for this room.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">Room photos</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Frontend placeholders for future photo uploads.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addMockPhoto}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        + Add photo
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {selectedRoomDetails.photos.map((photo, index) => (
                        <div
                          key={`${photo}-${index}`}
                          className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500"
                        >
                          {photo}
                        </div>
                      ))}
                      {selectedRoomDetails.photos.length === 0 && (
                        <p className="text-sm text-slate-500">No photos captured.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'minibar' && (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900">Minibar capture</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Record consumed items for future Billing integration.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Item</th>
                          <th className="px-5 py-3">Stocked</th>
                          <th className="px-5 py-3">Used</th>
                          <th className="px-5 py-3">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedRoomDetails.minibar.map((item, index) => (
                          <tr key={item.name}>
                            <td className="px-5 py-4 font-medium text-slate-900">{item.name}</td>
                            <td className="px-5 py-4 text-slate-600">{item.quantity}</td>
                            <td className="px-5 py-4">
                              <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={item.used}
                                onChange={(event) =>
                                  updateMinibarUsed(index, Number(event.target.value))
                                }
                                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                              />
                            </td>
                            <td className="px-5 py-4 font-semibold text-slate-900">
                              {item.quantity - item.used}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab === 'linen' && (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900">Linen capture</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Confirm linen quantities during room servicing.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-5 py-3">Item</th>
                          <th className="px-5 py-3">Expected</th>
                          <th className="px-5 py-3">Found</th>
                          <th className="px-5 py-3">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedRoomDetails.linen.map((item, index) => {
                          const variance = item.found - item.expected
                          return (
                            <tr key={item.name}>
                              <td className="px-5 py-4 font-medium text-slate-900">{item.name}</td>
                              <td className="px-5 py-4 text-slate-600">{item.expected}</td>
                              <td className="px-5 py-4">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.expected}
                                  value={item.found}
                                  onChange={(event) =>
                                    updateLinenFound(index, Number(event.target.value))
                                  }
                                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                />
                              </td>
                              <td className={`px-5 py-4 font-semibold ${variance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                {variance}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab === 'defects' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Defects and maintenance
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Record defects and create maintenance requests.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDefectForm((value) => !value)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      + Report defect
                    </button>
                  </div>

                  {showDefectForm && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <select
                          value={defectCategory}
                          onChange={(event) => setDefectCategory(event.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        >
                          <option>General</option>
                          <option>Bathroom</option>
                          <option>Electrical</option>
                          <option>Furniture</option>
                          <option>HVAC</option>
                          <option>Plumbing</option>
                        </select>

                        <select
                          value={defectSeverity}
                          onChange={(event) =>
                            setDefectSeverity(event.target.value as RoomDefect['severity'])
                          }
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                        >
                          <option>Low</option>
                          <option>Medium</option>
                          <option>High</option>
                        </select>

                        <input
                          value={defectDescription}
                          onChange={(event) => setDefectDescription(event.target.value)}
                          placeholder="Describe the defect..."
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:col-span-3"
                        />
                      </div>

                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDefectForm(false)}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={createDefect}
                          disabled={!defectDescription.trim()}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          Save defect
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedRoomDetails.defects.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
                      <p className="font-medium text-slate-900">No defects recorded</p>
                      <p className="mt-1 text-sm text-slate-500">
                        The room currently has no recorded defects.
                      </p>
                    </div>
                  )}

                  {selectedRoomDetails.defects.map((defect) => (
                    <div key={defect.id} className="rounded-xl border border-slate-200 p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{defect.category}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                              {defect.severity}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              {defect.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{defect.description}</p>
                          <p className="mt-2 text-xs text-slate-400">
                            Reported {defect.reportedAt}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {defect.status === 'Open' && (
                            <button
                              type="button"
                              onClick={() => requestMaintenance(defect.id)}
                              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700"
                            >
                              Request maintenance
                            </button>
                          )}
                          {defect.status === 'Maintenance Requested' && (
                            <button
                              type="button"
                              onClick={() => resolveDefect(defect.id)}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                            >
                              Mark resolved
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'history' && (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900">Room history</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Operational events recorded during this mock session.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedRoomDetails.history.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-2 p-5 sm:grid-cols-[90px_180px_120px_1fr]"
                      >
                        <span className="text-xs font-medium text-slate-400">{item.time}</span>
                        <span className="font-semibold text-slate-900">{item.action}</span>
                        <span className="text-sm text-slate-500">{item.user}</span>
                        <span className="text-sm text-slate-600">{item.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
              <p className="text-xs text-slate-500">
                Phase 5 room detail changes are stored in browser memory only.
              </p>
              <button
                type="button"
                onClick={closeRoomDetails}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {exceptionRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Room {exceptionRoom.room}
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Report room issue
                </h2>
              </div>

              <button
                type="button"
                onClick={closeExceptionDialog}
                aria-label="Close dialog"
                className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="exception-type"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Issue type
                </label>

                <select
                  id="exception-type"
                  value={exceptionType}
                  onChange={(event) =>
                    setExceptionType(
                      event.target.value as RoomStatus,
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Discrepancy">
                    Discrepancy
                  </option>

                  <option value="Out of Service">
                    Out of Service
                  </option>

                  <option value="Out of Order">
                    Out of Order
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="exception-reason"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Reason
                </label>

                <textarea
                  id="exception-reason"
                  value={exceptionReason}
                  onChange={(event) =>
                    setExceptionReason(event.target.value)
                  }
                  rows={4}
                  placeholder="Enter the reason for this room status..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeExceptionDialog}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={saveException}
                  disabled={!exceptionReason.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTaskForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Housekeeping
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Create housekeeping task
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create and optionally assign a task to an
                  attendant.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTaskForm}
                aria-label="Close task form"
                className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="task-room"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Room
                </label>

                <select
                  id="task-room"
                  value={taskRoom}
                  onChange={(event) => {
                    const room = rooms.find(
                      (item) =>
                        item.room === event.target.value,
                    )

                    setTaskRoom(event.target.value)

                    if (room) {
                      setTaskZone(room.zone)
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  {rooms.map((room) => (
                    <option
                      key={room.room}
                      value={room.room}
                    >
                      Room {room.room} — {room.type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-type"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Task type
                </label>

                <select
                  id="task-type"
                  value={taskType}
                  onChange={(event) =>
                    setTaskType(
                      event.target.value as TaskType,
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  {taskTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-zone"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Zone
                </label>

                <select
                  id="task-zone"
                  value={taskZone}
                  onChange={(event) =>
                    setTaskZone(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  {rooms
                    .map((room) => room.zone)
                    .filter(
                      (zone, index, allZones) =>
                        allZones.indexOf(zone) === index,
                    )
                    .map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-priority"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Priority
                </label>

                <select
                  id="task-priority"
                  value={taskPriority}
                  onChange={(event) =>
                    setTaskPriority(
                      event.target.value as Priority,
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option>Urgent</option>
                  <option>High</option>
                  <option>Normal</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-attendant"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Assign attendant
                </label>

                <select
                  id="task-attendant"
                  value={taskAttendant}
                  onChange={(event) =>
                    setTaskAttendant(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  {attendants.map((attendant) => (
                    <option key={attendant}>
                      {attendant}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-due-time"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Due time
                </label>

                <input
                  id="task-due-time"
                  type="time"
                  value={taskDueTime}
                  onChange={(event) =>
                    setTaskDueTime(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="task-notes"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Notes
                </label>

                <textarea
                  id="task-notes"
                  value={taskNotes}
                  onChange={(event) =>
                    setTaskNotes(event.target.value)
                  }
                  rows={4}
                  placeholder="Add instructions, guest arrival notes, minibar instructions, linen requirements, or other task details..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeTaskForm}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createTask}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Create task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}