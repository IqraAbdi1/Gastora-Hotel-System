import type { Unsubscribe } from '../types'
import type {
  ApprovedInput,
  ApprovedSupplier,
  ContractInput,
  ConversionInput,
  GrnReject,
  NewInvoiceInput,
  NewRfqInput,
  NewTransferInput,
  PoContext,
  ProcurementActor,
  ProcurementSnapshot,
  QuoteInput,
  RejectInput,
  ReorderRule,
  ReorderRuleInput,
  Rfq,
  StoreInput,
  StoreRecord,
  SupplierContract,
  SupplierInvoice,
  Transfer,
  UnitConversion,
} from './procurementTypes'

// What the screens need for quotations, invoice matching, supplier contracts, store transfers and
// cost control. Every change takes the actor; the backend checks the role and keeps the trail.
// Stock on hand, purchase orders and goods received stay with the supply chain; the screens pass
// what they need from it (PoContext, what a store can send) and make the stock moves there.
export interface ProcurementService {
  snapshot(propertyId: string): Promise<ProcurementSnapshot>

  // Quotations
  createRfq(input: NewRfqInput, actor: ProcurementActor): Promise<Rfq>
  inviteSupplier(rfqId: string, supplierName: string, actor: ProcurementActor): Promise<Rfq>
  recordQuote(rfqId: string, input: QuoteInput, actor: ProcurementActor): Promise<Rfq>
  award(rfqId: string, supplierName: string, note: string, actor: ProcurementActor): Promise<Rfq>
  /** The purchase order was raised in the supply chain from the award. */
  markOrdered(rfqId: string, poId: string | undefined, actor: ProcurementActor): Promise<Rfq>
  cancelRfq(rfqId: string, reason: string, actor: ProcurementActor): Promise<Rfq>

  // Supplier invoices and three-way match
  createInvoice(input: NewInvoiceInput, actor: ProcurementActor): Promise<SupplierInvoice>
  /** Match again, after more goods arrived or a reject was logged. */
  rematch(invoiceId: string, po: PoContext, actor: ProcurementActor): Promise<SupplierInvoice>
  approveInvoice(invoiceId: string, note: string, actor: ProcurementActor): Promise<SupplierInvoice>
  disputeInvoice(invoiceId: string, reason: string, actor: ProcurementActor): Promise<SupplierInvoice>
  sendToAp(invoiceId: string, actor: ProcurementActor): Promise<SupplierInvoice>
  setTolerance(propertyId: string, priceTolerancePct: number, qtyTolerancePct: number, actor: ProcurementActor): Promise<void>
  logReject(input: RejectInput, actor: ProcurementActor): Promise<GrnReject>

  // Supplier master
  saveContract(input: ContractInput, actor: ProcurementActor): Promise<SupplierContract>
  endContract(id: string, reason: string, actor: ProcurementActor): Promise<SupplierContract>
  addApproved(input: ApprovedInput, actor: ProcurementActor): Promise<ApprovedSupplier>
  removeApproved(id: string, actor: ProcurementActor): Promise<void>

  // Stores, units and transfers
  saveStore(input: StoreInput, actor: ProcurementActor): Promise<StoreRecord>
  addConversion(input: ConversionInput, actor: ProcurementActor): Promise<UnitConversion>
  removeConversion(id: string, actor: ProcurementActor): Promise<void>
  saveReorderRule(input: ReorderRuleInput, actor: ProcurementActor): Promise<ReorderRule>
  /** available: what the sending store can give of each item, when it is an item's home store. */
  createTransfer(input: NewTransferInput, available: Record<string, number>, actor: ProcurementActor): Promise<Transfer>
  /** issueRef: the store issue note, when stock left a home store through the supply chain. */
  sendTransfer(id: string, issueRef: string | undefined, actor: ProcurementActor): Promise<Transfer>
  receiveTransfer(id: string, received: number[], note: string, actor: ProcurementActor): Promise<Transfer>
  cancelTransfer(id: string, reason: string, actor: ProcurementActor): Promise<Transfer>

  subscribe(listener: () => void): Unsubscribe
}
