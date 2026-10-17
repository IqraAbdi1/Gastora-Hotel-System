/** Shared POS/KDS domain types. Existing persisted fields remain optional-compatible. */
export type Outlet = 'Restaurant' | 'Bar'
export type Payment = 'Cash' | 'Mobile money' | 'Card' | 'Room charge'
export type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery' | 'Room service'
export type KitchenStatus = 'New' | 'Preparing' | 'Ready'
export type OrderStatus = KitchenStatus | 'Served' | 'Cancelled' | 'Draft'
export type Course = 'Drinks' | 'Starter' | 'Main' | 'Dessert'

export interface Product {
  id: string
  name: string
  category: string
  outlet: Outlet
  price: number
  /** Explicit opt-out for menu items intentionally not tracked in inventory. */
  trackStock?: boolean
  assemblySteps?: string[]
  portionWeight?: string
  unit: string
  emoji: string
  available?: boolean
}

export interface SaleItem {
  name: string
  qty: number
  price: number
}

export interface Sale {
  id: string
  createdAt: string
  outlet: Outlet
  payment: Payment
  total: number
  subtotal?: number
  discount?: number
  orderType?: OrderType
  table?: string
  customer?: string
  notes?: string
  paymentReference?: string
  amountTendered?: number
  changeDue?: number
  items: SaleItem[]
  room?: string
  reservationId?: string
  guestId?: string
  folioChargeId?: string
}

export interface OrderLine {
  productId: string
  qty: number
  /** Future-compatible fields; existing records need not contain them. */
  id?: string
  note?: string
  course?: Course
  stockDeducted?: boolean
}

export interface HeldOrder {
  id: string
  createdAt: string
  outlet: Outlet
  orderType: OrderType
  table: string
  room: string
  customer: string
  notes: string
  discountPercent: number
  items: OrderLine[]
  kitchenStatus?: KitchenStatus
  /** Lifecycle/history fields are optional to keep old localStorage records valid. */
  status?: OrderStatus
  updatedAt?: string
  preparingAt?: string
  readyAt?: string
  servedAt?: string
  cancelledAt?: string
  course?: string
  allergy?: string
  vip?: boolean
  guestId?: string
}

export interface RecipeIngredient {
  stockId: string
  qty: number
  unit?: string
  yieldPercent?: number
  wastePercent?: number
}
export type Recipes = Record<string, RecipeIngredient[]>

export interface OrderLifecycleEvent {
  status: OrderStatus
  at: string
  actorId?: string
  note?: string
}

export interface OrderHistoryRecord extends HeldOrder {
  status: OrderStatus
  history: OrderLifecycleEvent[]
}
