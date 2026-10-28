/** Shared POS/KDS contracts. Optional fields are additive to existing localStorage records. */
/**
 * The outlet a menu item, order or sale belongs to. Restaurant and Bar are the original two; hotels with
 * several outlets add their own (Room service, Minibar, Pool bar, Gift shop), stored by outlet name.
 */
export type Outlet = 'Restaurant' | 'Bar' | (string & Record<never, never>)
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
  /** Additive (schema v4): service charge, tip and split-bill details. */
  serviceCharge?: number
  tip?: number
  orderId?: string
  /** Set when the order was paid in several checks: "A", "B"… */
  checkLabel?: string
  checkCount?: number
  roomPostingId?: string
  recordedBy?: string
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
  /** Additive (schema v4). Chosen modifiers with their price add-on per unit. */
  modifiers?: LineModifier[]
  /** Price per unit before modifiers. Absent means the menu price; set for combo components. */
  unitPrice?: number
  comboId?: string
  /** Groups the component lines of one combo sold together. */
  comboRef?: string
  comboName?: string
  /** Seat number at the table, for splitting by seat. */
  seat?: number
  discountPercent?: number
  discountReason?: string
  discountApprovedBy?: string
  /** When the line's course was fired to the kitchen. */
  firedAt?: string
}

export type LineModifier = { groupId: string; modifierId: string; name: string; price: number }

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
  /** Additive (schema v4). */
  covers?: number
  orderDiscountReason?: string
  /** Who approved a discount above the outlet's limit. Absent while it waits for a manager. */
  discountApprovedBy?: string
  discountNeedsApproval?: boolean
  serviceChargePercent?: number
  /** Courses held back from the kitchen until fired. A course not listed is fired. */
  heldCourses?: string[]
  createdBy?: string
}

export type RecipeIngredient = {
  stockId: string
  qty: number
  unit?: string
  wastePercent?: number
  /** Usable share of the item as bought, after trimming (fish 85%). Absent means 100%. */
  yieldPercent?: number
}
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
export const POS_SCHEMA_VERSION = 4

export const COURSES = ['Drinks', 'Starter', 'Main', 'Dessert'] as const
