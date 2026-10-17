/** Shared POS/KDS contracts. Optional fields are additive to existing localStorage records. */
export type Outlet = 'Restaurant' | 'Bar'
export type Payment = 'Cash' | 'Mobile money' | 'Card' | 'Room charge'
export type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery' | 'Room service'
export type KitchenStatus = 'New' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled'

export type Product = {
  id: string
  name: string
  category: string
  outlet: Outlet
  price: number
  /** False only for explicitly untracked menu items; tracked items require a valid recipe. */
  trackStock?: boolean
  unit: string
  emoji: string
  available?: boolean
}

export type SaleItem = { name: string; qty: number; price: number }
export type Sale = {
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
  /** Additive fields for future folio integration. */
  reservationId?: string
  guestId?: string
}

export type LineStatus = 'New' | 'Preparing' | 'Ready' | 'Served' | 'Cancelled'

export type OrderLine = {
  productId: string
  qty: number
  /** Stable identity used for idempotent stock deductions; generated during migration for legacy orders. */
  lineId?: string
  status?: LineStatus
  preparingAt?: string
  readyAt?: string
  servedAt?: string
  stockDeductionError?: string
  /** Added in the deduction-policy phase; absent means not yet recorded by the legacy flow. */
  stockDeducted?: boolean
  note?: string
  course?: string
  stockDeductionRef?: string
}

export type Line = OrderLine

export type HeldOrder = {
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
  course?: string
  allergy?: string
  severeAllergy?: boolean
  vip?: boolean
  /** Additive lifecycle timestamps; populated in the order lifecycle phase. */
  preparingAt?: string
  readyAt?: string
  servedAt?: string
  cancelledAt?: string
  updatedAt?: string
  paidAt?: string
  guestId?: string
  deliverySetup?: 'Tray' | 'Rolling table' | 'Silver service'
  roomFloor?: string
}

export type RecipeIngredient = { stockId: string; qty: number; unit?: string; wastePercent?: number }
export type Recipes = Record<string, RecipeIngredient[]>

export const POS_STORAGE_KEYS = {
  products: 'gastora.pos.products.v1',
  heldOrders: 'gastora.pos.heldOrders.v1',
  tables: 'gastora.pos.tables.v1',
  sales: 'gastora.pos.sales.v1',
  recipes: 'gastora.pos.recipes.v1',
  deductionLedger: 'gastora.pos.deductionLedger.v1',
  orderHistory: 'gastora.pos.orderHistory.v1',
} as const

export const POS_SCHEMA_VERSION_KEY = 'gastora.pos.schemaVersion'
export const POS_SCHEMA_VERSION = 3
