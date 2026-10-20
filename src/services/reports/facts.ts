import type { Reservation, Room, Guest } from '../../types'

// The hotel's own records, in the shape the reports read them. The screens build this from the
// existing hooks (bookings, the till, stock, maintenance, company accounts); a backend builds it from
// its tables. Every figure on the reports pages is worked out from this, except costs and budgets.

export interface FactSale {
  id: string
  createdAt: string
  outlet: string
  payment: string
  total: number
  items: number
  /** True when it comes from the sample till history, because the hotel's till has recorded nothing yet. */
  sample: boolean
}

export interface FactWorkOrder {
  id: string
  room: string
  category: string
  description: string
  priority: 'Urgent' | 'High' | 'Normal'
  status: string
  technician: string
  reportedOn: string
  closedOn?: string
  overdue: boolean
}

export interface FactStock {
  id: string
  name: string
  category: string
  unit: string
  onHand: number
  reorderAt: number
  unitCost: number
}

export interface FactOrder {
  id: string
  supplier: string
  createdAt: string
  total: number
  status: string
}

export interface FactRequest {
  id: string
  department: string
  status: string
  createdAt: string
}

export interface FactAccount {
  id: string
  name: string
  status: string
  creditLimit: number
  outstandingBalance: number
}

export interface FactHousekeeping {
  toClean: number
  openTasks: number
  toInspect: number
  issues: number
  tasksDoneToday: number
}

export interface ReportFacts {
  propertyId: string
  propertyName: string
  today: string
  reservations: Reservation[]
  rooms: Room[]
  guests: Guest[]
  sales: FactSale[]
  /** True when `sales` is the sample till history. */
  salesAreSample: boolean
  stock: FactStock[]
  orders: FactOrder[]
  requests: FactRequest[]
  activeSuppliers: number
  workOrders: FactWorkOrder[]
  accounts: FactAccount[]
  housekeeping: FactHousekeeping
}
