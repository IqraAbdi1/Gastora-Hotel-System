// Records of the POS, F&B and kitchen area, named after the gst_pos tables. Menu items, recipes and
// open orders already live in the POS feature; their contracts are re-exported here so a backend
// client sees the whole area in one place.
import type { Actor } from '../types'

export type {
  HeldOrder,
  LineModifier,
  OrderLine,
  Product,
  RecipeIngredient,
  Recipes,
  Sale,
} from '../../features/pos/posTypes'

export type OutletType = 'restaurant' | 'bar' | 'roomService' | 'minibar' | 'poolSpa' | 'retail'

export const OUTLET_TYPE_LABEL: Record<OutletType, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  roomService: 'Room service',
  minibar: 'Minibar',
  poolSpa: 'Pool / spa',
  retail: 'Retail',
}

/** gst_pos.outlets */
export interface PosOutlet {
  id: string
  propertyId: string
  /** Also the key menu items, orders and sales carry in their `outlet` field. Fixed once created. */
  name: string
  type: OutletType
  emoji: string
  /** "07:00"; open equal to close means open all day. */
  opensAt: string
  closesAt: string
  serviceChargePercent: number
  tipsEnabled: boolean
  /** A discount above this share of the bill waits for a manager. */
  discountApprovalPercent: number
  /** Folio category used when a bill is charged to a room. */
  folioCategory: string
  /** Dine-in at tables: a floor plan and table bookings. */
  hasTables: boolean
  active: boolean
  sortOrder: number
}

/** gst_pos.floor_areas */
export interface FloorArea {
  id: string
  propertyId: string
  outletId: string
  name: string
}

export type TableShape = 'round' | 'square' | 'long'
/** What staff set by hand. "Ordered" is worked out from the open orders. */
export type TableManualStatus = 'free' | 'seated' | 'billAsked' | 'cleaning'
export type TableStatus = TableManualStatus | 'ordered'

/** gst_pos.tables */
export interface PosTable {
  id: string
  propertyId: string
  outletId: string
  areaId: string
  /** Matches the `table` field on orders, such as "T04". */
  name: string
  seats: number
  shape: TableShape
  /** Position on the plan, 0 to 100 across and down. */
  x: number
  y: number
  status: TableManualStatus
  covers?: number
  seatedAt?: string
  /** Set on a table joined to another; the other table carries the order. */
  mergedInto?: string
  updatedAt?: string
  updatedBy?: string
}

export type BookingStatus = 'booked' | 'seated' | 'cancelled' | 'noShow'

/** gst_pos.table_bookings */
export interface TableBooking {
  id: string
  propertyId: string
  outletId: string
  tableId?: string
  guestName: string
  phone?: string
  /** In-house guest, when the booking is for one. */
  reservationId?: string
  date: string
  time: string
  covers: number
  notes?: string
  status: BookingStatus
  createdAt: string
  createdBy: string
}

/** gst_pos.menus */
export interface PosMenu {
  id: string
  propertyId: string
  outletId: string
  name: string
  active: boolean
}

/** gst_pos.menu_categories */
export interface MenuCategory {
  id: string
  menuId: string
  name: string
  sortOrder: number
}

/** gst_pos.menu_items, as the backend will hold them. The prototype keeps them as POS products. */
export interface MenuItem {
  id: string
  propertyId: string
  menuId: string
  categoryId: string
  name: string
  price: number
  unit: string
  available: boolean
  trackStock: boolean
}

/** gst_pos.modifier_groups */
export interface ModifierGroup {
  id: string
  propertyId: string
  name: string
  /** Required means at least `minSelect` choices before the item can be added. */
  required: boolean
  minSelect: number
  maxSelect: number
  /** Menu items (POS product ids) this group is offered on. */
  productIds: string[]
  modifiers: Modifier[]
}

/** gst_pos.modifiers */
export interface Modifier {
  id: string
  groupId: string
  name: string
  /** Added to the item's price per unit. */
  price: number
}

/** gst_pos.combos */
export interface Combo {
  id: string
  propertyId: string
  outletId: string
  name: string
  emoji: string
  price: number
  items: ComboItem[]
  active: boolean
}

/** gst_pos.combo_items */
export interface ComboItem {
  id: string
  comboId: string
  productId: string
  qty: number
}

/** gst_pos.recipes, one per menu item. The prototype keeps lines in the POS recipes store. */
export interface RecipeRecord {
  id: string
  menuItemId: string
  portions: number
}

/** gst_pos.recipe_lines */
export interface RecipeLine {
  id: string
  recipeId: string
  stockItemId: string
  qty: number
  unit: string
  yieldPercent: number
  wastePercent: number
}

/** gst_pos.orders, as stored by the backend. The prototype keeps open orders as held orders. */
export interface PosOrderRecord {
  id: string
  propertyId: string
  outletId: string
  tableId?: string
  orderType: string
  covers?: number
  status: 'open' | 'sent' | 'paid' | 'cancelled'
  openedAt: string
  openedBy: string
}

/** gst_pos.order_lines */
export interface OrderLineRecord {
  id: string
  orderId: string
  menuItemId: string
  qty: number
  unitPrice: number
  course: string
  seat?: number
  status: string
}

export type SplitMode = 'none' | 'item' | 'seat' | 'equal'
export type CheckStatus = 'open' | 'paid' | 'void'

/** gst_pos.checks: one bill to pay. An order split three ways has three. */
export interface Check {
  id: string
  propertyId: string
  outletId: string
  orderId: string
  label: string
  splitMode: SplitMode
  /** Order line ids on this check (by item or seat). Empty for an equal share. */
  lineIds: string[]
  subtotal: number
  discount: number
  serviceCharge: number
  tip: number
  total: number
  status: CheckStatus
  createdAt: string
  paidAt?: string
}

export type CheckPaymentMethod = 'Cash' | 'Mobile money' | 'Card' | 'Room charge'

/** gst_pos.check_payments */
export interface CheckPayment {
  id: string
  checkId: string
  method: CheckPaymentMethod
  amount: number
  reference?: string
  roomPostingId?: string
  at: string
  by: string
}

/** gst_pos.room_postings: a bill charged to a guest's folio. */
export interface RoomPosting {
  id: string
  propertyId: string
  outletId: string
  orderId: string
  checkId?: string
  reservationId: string
  /** Where the charge landed after routing, when that differs. */
  postedToReservationId: string
  guest: string
  room: string
  category: string
  amount: number
  postedAt: string
  postedBy: string
}

/** gst_pos.discounts_applied */
export interface DiscountApplied {
  id: string
  propertyId: string
  orderId: string
  orderLineId?: string
  percent: number
  amount: number
  reason: string
  approvedBy?: string
  appliedBy: string
  at: string
}

/** gst_pos.kds_stations */
export interface KdsStation {
  id: string
  propertyId: string
  name: string
  /** Menu categories this station prepares. */
  categories: string[]
  /** Minutes a line may take before it turns amber; red at twice this. */
  targetMinutes: number
}

/** gst_pos.kds_tickets, as stored by the backend. The prototype builds tickets from open orders. */
export interface KdsTicket {
  id: string
  propertyId: string
  stationId: string
  orderId: string
  course: string
  status: 'held' | 'fired' | 'ready' | 'bumped'
  firedAt?: string
  bumpedAt?: string
}

/**
 * Per-stay rules for charging to a room, kept by the front desk. Without one the guarantee decides
 * the limit and every F&B category is allowed.
 */
export interface FolioControl {
  reservationId: string
  propertyId: string
  postingAllowed: boolean
  /** Why posting is stopped, shown to the cashier. */
  reason?: string
  /** Most the folio balance may reach with this charge. */
  creditLimit?: number
  /** Folio categories that may be charged. Absent means all. */
  allowCategories?: string[]
}

export type WasteReason = 'Spoiled' | 'Overproduction' | 'Dropped' | 'Returned by guest' | 'Expired'

export interface WastageEntry {
  id: string
  propertyId: string
  outletId: string
  stockItemId: string
  itemName: string
  qty: number
  unit: string
  reason: WasteReason
  cost: number
  note?: string
  at: string
  by: string
}

/** Stock moved from the main store to an outlet's kitchen or bar. */
export interface StockTransfer {
  id: string
  propertyId: string
  outletId: string
  toLocation: 'Kitchen' | 'Bar'
  lines: { stockItemId: string; itemName: string; qty: number; unit: string; unitCost: number }[]
  value: number
  note?: string
  at: string
  by: string
}

/** Opening and closing count of an item at the outlets over the costing week. */
export interface UsageCount {
  propertyId: string
  stockItemId: string
  opening: number
  closing: number
  countedAt: string
  countedBy: string
}

/** One day of an outlet's food cost, for the trend. */
export interface CostDay {
  propertyId: string
  outletId: string
  date: string
  revenue: number
  cost: number
}

/** Portions sold per menu item over the costing week. */
export interface SalesMix {
  propertyId: string
  productId: string
  qty: number
}

export interface PosSnapshot {
  outlets: PosOutlet[]
  areas: FloorArea[]
  tables: PosTable[]
  bookings: TableBooking[]
  menus: PosMenu[]
  modifierGroups: ModifierGroup[]
  combos: Combo[]
  stations: KdsStation[]
  checks: Check[]
  checkPayments: CheckPayment[]
  postings: RoomPosting[]
  discounts: DiscountApplied[]
  folioControls: FolioControl[]
  wastage: WastageEntry[]
  transfers: StockTransfer[]
  counts: UsageCount[]
  costDays: CostDay[]
  salesMix: SalesMix[]
}

export type OutletInput = Omit<PosOutlet, 'id' | 'propertyId' | 'sortOrder'>
export type BookingInput = Omit<TableBooking, 'id' | 'propertyId' | 'status' | 'createdAt' | 'createdBy'>
export type TableInput = Pick<PosTable, 'outletId' | 'areaId' | 'name' | 'seats' | 'shape'>
export type ModifierGroupInput = Omit<ModifierGroup, 'id' | 'propertyId' | 'modifiers'> & { modifiers: { name: string; price: number }[] }
export type ComboInput = Omit<Combo, 'id' | 'propertyId' | 'items'> & { items: { productId: string; qty: number }[] }
export type CheckInput = Omit<Check, 'id' | 'propertyId' | 'status' | 'createdAt' | 'paidAt'>
export type PaymentInput = Omit<CheckPayment, 'id' | 'at' | 'by'>
export type PostingInput = Omit<RoomPosting, 'id' | 'propertyId' | 'postedAt' | 'postedBy'>
export type DiscountInput = Omit<DiscountApplied, 'id' | 'propertyId' | 'appliedBy' | 'at'>
export type WastageInput = Omit<WastageEntry, 'id' | 'propertyId' | 'at' | 'by'>
export type TransferInput = Omit<StockTransfer, 'id' | 'propertyId' | 'at' | 'by' | 'value'>

export type { Actor }
