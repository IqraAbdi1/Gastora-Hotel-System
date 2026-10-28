import type { Actor, Unsubscribe } from '../types'
import type {
  BookingInput,
  BookingStatus,
  Check,
  CheckInput,
  CheckPayment,
  ComboInput,
  DiscountInput,
  ModifierGroupInput,
  OutletInput,
  PaymentInput,
  PosOutlet,
  PosSnapshot,
  PosTable,
  PostingInput,
  RoomPosting,
  StockTransfer,
  TableBooking,
  TableInput,
  TableManualStatus,
  TransferInput,
  WastageEntry,
  WastageInput,
} from './posTypes'

// What the POS, floor plan, kitchen display and food-cost screens need. Every call is for one
// property; the backend also checks the actor's role and keeps the audit trail.
export interface PosService {
  /** Everything for one property in one read. */
  snapshot(propertyId: string): Promise<PosSnapshot>

  saveOutlet(propertyId: string, input: OutletInput, actor: Actor, id?: string): Promise<PosOutlet>

  addTable(propertyId: string, input: TableInput, actor: Actor): Promise<PosTable>
  setTableStatus(propertyId: string, tableId: string, status: TableManualStatus, actor: Actor, covers?: number): Promise<PosTable>
  /** The guests move: the new table takes the old one's status and covers; the old one needs cleaning. */
  moveTable(propertyId: string, fromId: string, toId: string, actor: Actor): Promise<PosTable>
  mergeTables(propertyId: string, mainId: string, otherId: string, actor: Actor): Promise<PosTable>
  unmergeTable(propertyId: string, tableId: string, actor: Actor): Promise<PosTable>

  createBooking(propertyId: string, input: BookingInput, actor: Actor): Promise<TableBooking>
  setBookingStatus(propertyId: string, id: string, status: BookingStatus, actor: Actor): Promise<TableBooking>

  saveModifierGroup(propertyId: string, input: ModifierGroupInput, actor: Actor, id?: string): Promise<void>
  removeModifierGroup(propertyId: string, id: string, actor: Actor): Promise<void>
  saveCombo(propertyId: string, input: ComboInput, actor: Actor, id?: string): Promise<void>
  removeCombo(propertyId: string, id: string, actor: Actor): Promise<void>

  /** Replaces the unpaid checks of an order with a new split. Paid checks are kept. */
  splitChecks(propertyId: string, orderId: string, inputs: CheckInput[], actor: Actor): Promise<Check[]>
  payCheck(propertyId: string, checkId: string, payment: PaymentInput, actor: Actor): Promise<CheckPayment>
  /** Drops the unpaid checks of an order, for a split that was abandoned. */
  voidOpenChecks(propertyId: string, orderId: string, actor: Actor): Promise<void>

  recordPosting(propertyId: string, input: PostingInput, actor: Actor): Promise<RoomPosting>
  recordDiscounts(propertyId: string, inputs: DiscountInput[], actor: Actor): Promise<void>

  logWastage(propertyId: string, input: WastageInput, actor: Actor): Promise<WastageEntry>
  createTransfer(propertyId: string, input: TransferInput, actor: Actor): Promise<StockTransfer>
  recordCount(propertyId: string, stockItemId: string, closing: number, actor: Actor): Promise<void>

  subscribe(listener: () => void): Unsubscribe
}
