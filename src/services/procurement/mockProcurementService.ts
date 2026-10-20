import type { RoleId } from '../../lib/roles'
import type { ProcurementService } from './procurementService'
import { contractStatus, matchLines } from './procurementRules'
import { seedFor } from './procurementSeed'
import type { HistoryEntry, PoContext, ProcurementActor, ProcurementSnapshot, Rfq, SupplierInvoice, Transfer } from './procurementTypes'

// In-memory procurement data for the prototype, one copy per property. It applies the same checks
// the backend must apply, and rejects with a message the screen shows. Not saved: a reload starts over.

const BUYERS: RoleId[] = ['owner', 'admin', 'gm', 'procurement']
const AWARDERS: RoleId[] = ['owner', 'gm', 'procurement']
const INVOICE_ENTRY: RoleId[] = ['owner', 'admin', 'gm', 'finance', 'procurement']
const INVOICE_APPROVERS: RoleId[] = ['owner', 'gm', 'finance']
const AP_SENDERS: RoleId[] = ['owner', 'finance']
const STORE_STAFF: RoleId[] = ['owner', 'admin', 'gm', 'storekeeper']
const STORE_SETUP: RoleId[] = ['owner', 'admin']
const REJECT_LOGGERS: RoleId[] = ['owner', 'gm', 'storekeeper', 'procurement']

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime())
const now = () => new Date().toISOString()
const copy = <T>(x: T): T => structuredClone(x)

export function createMockProcurementService(): ProcurementService {
  const data = new Map<string, ProcurementSnapshot>()
  const listeners = new Set<() => void>()
  let seq = 1000
  const next = (prefix: string) => `${prefix}-${++seq}`
  const emit = () => listeners.forEach((l) => l())

  const of = (propertyId: string) => {
    let d = data.get(propertyId)
    if (!d) {
      d = seedFor(propertyId)
      data.set(propertyId, d)
    }
    return d
  }
  const deny = <T>(why: string): Promise<T> => Promise.reject(new Error(why))
  const allowed = (actor: ProcurementActor, roles: RoleId[]) => roles.includes(actor.role)
  const done = <T>(value: T): Promise<T> => {
    emit()
    return Promise.resolve(copy(value))
  }
  const log = (by: ProcurementActor, text: string): HistoryEntry => ({ at: now(), by: by.name, text })

  function findIn<T extends { id: string }>(pick: (d: ProcurementSnapshot) => T[], id: string): { d: ProcurementSnapshot; row: T } | null {
    for (const d of data.values()) {
      const row = pick(d).find((x) => x.id === id)
      if (row) return { d, row }
    }
    return null
  }

  function applyMatch(d: ProcurementSnapshot, inv: SupplierInvoice, po: PoContext) {
    const at = now()
    const m = matchLines(inv.id, inv.lines, po, d.settings.priceTolerancePct, d.settings.qtyTolerancePct, at)
    d.matches = [...d.matches.filter((x) => x.invoiceId !== inv.id), ...m]
    return m.every((x) => x.result === 'ok')
  }

  function balance(d: ProcurementSnapshot, storeId: string, itemName: string) {
    return d.balances.find((b) => b.storeId === storeId && same(b.itemName, itemName))?.qty ?? 0
  }
  function addBalance(d: ProcurementSnapshot, storeId: string, itemName: string, qty: number) {
    const hit = d.balances.find((b) => b.storeId === storeId && same(b.itemName, itemName))
    if (hit) hit.qty = Math.round((hit.qty + qty) * 1000) / 1000
    else d.balances.push({ propertyId: d.settings.propertyId, storeId, itemName, qty })
  }

  return {
    snapshot: (propertyId) => Promise.resolve(copy(of(propertyId))),

    // ---- quotations ----

    createRfq(input, actor) {
      if (!allowed(actor, BUYERS)) return deny('Only procurement or a manager can ask for quotations.')
      const d = of(input.propertyId)
      if (!input.requisitionId) return deny('Pick an approved requisition.')
      if (d.rfqs.some((r) => r.requisitionId === input.requisitionId && r.status !== 'cancelled'))
        return deny(`${input.requisitionId} already has a quotation request.`)
      if (!input.title.trim()) return deny('Give the request a title.')
      if (!isDate(input.dueOn)) return deny('Pick the date quotes are due.')
      if (input.dueOn < now().slice(0, 10)) return deny('The due date has already passed.')
      if (input.lines.length === 0 || input.lines.some((l) => !(l.qty > 0))) return deny('Every line needs a quantity.')
      const invited = [...new Set(input.invited.map((s) => s.trim()).filter(Boolean))]
      if (invited.length < 2) return deny('Invite at least two suppliers so there is something to compare.')
      const rfq: Rfq = {
        id: next('RFQ'),
        propertyId: input.propertyId,
        requisitionId: input.requisitionId,
        title: input.title.trim(),
        status: 'open',
        dueOn: input.dueOn,
        lines: input.lines.map((l) => ({ ...l })),
        invited,
        createdBy: actor.name,
        createdAt: now(),
        history: [log(actor, `Sent to ${invited.length} suppliers`)],
      }
      d.rfqs = [rfq, ...d.rfqs]
      return done(rfq)
    },

    inviteSupplier(rfqId, supplierName, actor) {
      if (!allowed(actor, BUYERS)) return deny('Only procurement or a manager can invite suppliers.')
      const hit = findIn((d) => d.rfqs, rfqId)
      if (!hit) return deny('Quotation request not found.')
      const r = hit.row
      if (r.status !== 'open') return deny('This request is closed.')
      if (!supplierName.trim()) return deny('Pick a supplier.')
      if (r.invited.some((s) => same(s, supplierName))) return deny(`${supplierName} is already invited.`)
      r.invited = [...r.invited, supplierName.trim()]
      r.history = [...r.history, log(actor, `Invited ${supplierName.trim()}`)]
      return done(r)
    },

    recordQuote(rfqId, input, actor) {
      if (!allowed(actor, BUYERS)) return deny('Only procurement or a manager can record quotes.')
      const hit = findIn((d) => d.rfqs, rfqId)
      if (!hit) return deny('Quotation request not found.')
      const { d, row: r } = hit
      if (r.status !== 'open') return deny('This request is closed.')
      if (!r.invited.some((s) => same(s, input.supplierName))) return deny('Only an invited supplier can quote.')
      if (input.prices.length !== r.lines.length) return deny('Enter a price for every line.')
      if (input.prices.some((p) => !Number.isFinite(p) || p < 0)) return deny('A price cannot be negative.')
      if (input.prices.every((p) => p === 0)) return deny('Enter at least one price.')
      if (!(input.leadTimeDays >= 0)) return deny('Enter the lead time in days.')
      if (!input.paymentTerms.trim()) return deny('Enter the payment terms.')
      if (!isDate(input.validUntil)) return deny('Enter how long the quote is valid.')
      const prev = d.quotes.find((q) => q.rfqId === rfqId && same(q.supplierName, input.supplierName))
      const quote = {
        id: prev?.id ?? next('Q'),
        rfqId,
        supplierName: input.supplierName.trim(),
        prices: input.prices.map((p) => Math.round(p * 100) / 100),
        leadTimeDays: Math.round(input.leadTimeDays),
        paymentTerms: input.paymentTerms.trim(),
        validUntil: input.validUntil,
        notes: input.notes?.trim() || undefined,
        receivedAt: now(),
        recordedBy: actor.name,
      }
      d.quotes = [...d.quotes.filter((q) => q.id !== quote.id), quote]
      r.history = [...r.history, log(actor, `${prev ? 'Updated' : 'Recorded'} quote from ${quote.supplierName}`)]
      return done(r)
    },

    award(rfqId, supplierName, note, actor) {
      if (!allowed(actor, AWARDERS)) return deny('Only procurement, the general manager or the owner can award.')
      const hit = findIn((d) => d.rfqs, rfqId)
      if (!hit) return deny('Quotation request not found.')
      const { d, row: r } = hit
      if (r.status !== 'open') return deny('This request is already decided.')
      const quotes = d.quotes.filter((q) => q.rfqId === rfqId)
      const q = quotes.find((x) => same(x.supplierName, supplierName))
      if (!q) return deny('This supplier has not quoted.')
      if (q.prices.some((p) => p <= 0)) return deny(`${q.supplierName} did not quote every line.`)
      // Rule: passing over the cheapest complete quote needs a reason.
      const total = (p: number[]) => p.reduce((s, x, i) => s + x * r.lines[i].qty, 0)
      const cheapest = Math.min(...quotes.filter((x) => x.prices.every((p) => p > 0)).map((x) => total(x.prices)))
      if (total(q.prices) > cheapest && !note.trim()) return deny('This is not the cheapest quote. Say why it wins.')
      r.status = 'awarded'
      r.awardedSupplier = q.supplierName
      r.awardedBy = actor.name
      r.awardedAt = now()
      r.awardNote = note.trim() || undefined
      r.history = [...r.history, log(actor, `Awarded to ${q.supplierName}${note.trim() ? `: ${note.trim()}` : ''}`)]
      r.lines.forEach((l, i) =>
        d.prices.push({
          id: next('PH'),
          propertyId: r.propertyId,
          itemName: l.itemName,
          supplierName: q.supplierName,
          unitPrice: q.prices[i],
          qty: l.qty,
          at: now(),
          source: 'Quote',
          reference: r.id,
        }),
      )
      return done(r)
    },

    markOrdered(rfqId, poId, actor) {
      const hit = findIn((d) => d.rfqs, rfqId)
      if (!hit) return deny('Quotation request not found.')
      const r = hit.row
      if (r.status !== 'awarded') return deny('Award the request before raising the order.')
      r.status = 'ordered'
      r.poId = poId
      r.history = [...r.history, log(actor, `${poId ?? 'Purchase order'} raised with ${r.awardedSupplier}`)]
      return done(r)
    },

    cancelRfq(rfqId, reason, actor) {
      if (!allowed(actor, BUYERS)) return deny('Only procurement or a manager can cancel.')
      const hit = findIn((d) => d.rfqs, rfqId)
      if (!hit) return deny('Quotation request not found.')
      const r = hit.row
      if (r.status === 'ordered' || r.status === 'cancelled') return deny('This request can no longer be cancelled.')
      if (!reason.trim()) return deny('Say why it is cancelled.')
      r.status = 'cancelled'
      r.history = [...r.history, log(actor, `Cancelled: ${reason.trim()}`)]
      return done(r)
    },

    // ---- invoices ----

    createInvoice(input, actor) {
      if (!allowed(actor, INVOICE_ENTRY)) return deny('You cannot enter supplier invoices.')
      const d = of(input.propertyId)
      if (!input.po.poId) return deny('Pick the purchase order.')
      if (!input.invoiceNo.trim()) return deny("Enter the supplier's invoice number.")
      if (d.invoices.some((i) => same(i.supplierName, input.po.supplierName) && same(i.invoiceNo, input.invoiceNo)))
        return deny('This invoice number is already entered for this supplier.')
      if (!isDate(input.invoiceDate)) return deny('Enter the invoice date.')
      if (input.invoiceDate > now().slice(0, 10)) return deny('The invoice date cannot be in the future.')
      if (!isDate(input.dueDate) || input.dueDate < input.invoiceDate) return deny('The due date must be on or after the invoice date.')
      const lines = input.lines.filter((l) => l.qty > 0)
      if (lines.length === 0) return deny('Enter at least one line with a quantity.')
      if (lines.some((l) => !(l.unitPrice > 0))) return deny('Every line needs a price.')
      const inv: SupplierInvoice = {
        id: next('SINV'),
        propertyId: input.propertyId,
        supplierName: input.po.supplierName,
        invoiceNo: input.invoiceNo.trim(),
        poId: input.po.poId,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        lines: lines.map((l) => ({ ...l })),
        total: Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)),
        status: 'matched',
        createdBy: actor.name,
        createdAt: now(),
        history: [],
      }
      const clean = applyMatch(d, inv, input.po)
      inv.status = clean ? 'matched' : 'variance'
      inv.history = [log(actor, `Entered against ${inv.poId}: ${clean ? 'matched' : 'variance found'}`)]
      d.invoices = [inv, ...d.invoices]
      return done(inv)
    },

    rematch(invoiceId, po, actor) {
      if (!allowed(actor, INVOICE_ENTRY)) return deny('You cannot match invoices.')
      const hit = findIn((d) => d.invoices, invoiceId)
      if (!hit) return deny('Invoice not found.')
      const { d, row: inv } = hit
      if (inv.status === 'approved' || inv.status === 'sentToAp') return deny('This invoice is already approved.')
      const clean = applyMatch(d, inv, po)
      inv.status = clean ? 'matched' : 'variance'
      inv.disputeReason = undefined
      inv.history = [...inv.history, log(actor, `Matched again: ${clean ? 'matched' : 'variance remains'}`)]
      return done(inv)
    },

    approveInvoice(invoiceId, note, actor) {
      if (!allowed(actor, INVOICE_APPROVERS)) return deny('Only Finance, the general manager or the owner can approve for payment.')
      const hit = findIn((d) => d.invoices, invoiceId)
      if (!hit) return deny('Invoice not found.')
      const { d, row: inv } = hit
      if (inv.status !== 'matched' && inv.status !== 'variance') return deny('This invoice cannot be approved now.')
      if (inv.createdBy === actor.name) return deny('You entered this invoice, so someone else must approve it.')
      if (inv.status === 'variance' && !note.trim()) return deny('The invoice does not match. Say why it is approved anyway.')
      inv.status = 'approved'
      inv.approvedBy = actor.name
      inv.approvedAt = now()
      inv.approvalNote = note.trim() || undefined
      inv.history = [...inv.history, log(actor, `Approved for payment${note.trim() ? `: ${note.trim()}` : ''}`)]
      inv.lines.forEach((l) =>
        d.prices.push({
          id: next('PH'),
          propertyId: inv.propertyId,
          itemName: l.itemName,
          supplierName: inv.supplierName,
          unitPrice: l.unitPrice,
          qty: l.qty,
          at: now(),
          source: 'Invoice',
          reference: inv.invoiceNo,
        }),
      )
      return done(inv)
    },

    disputeInvoice(invoiceId, reason, actor) {
      if (!allowed(actor, INVOICE_ENTRY)) return deny('You cannot dispute invoices.')
      const hit = findIn((d) => d.invoices, invoiceId)
      if (!hit) return deny('Invoice not found.')
      const inv = hit.row
      if (inv.status === 'approved' || inv.status === 'sentToAp') return deny('This invoice is already approved.')
      if (!reason.trim()) return deny('Say what is wrong, so the supplier can correct it.')
      inv.status = 'disputed'
      inv.disputeReason = reason.trim()
      inv.history = [...inv.history, log(actor, `Disputed with supplier: ${reason.trim()}`)]
      return done(inv)
    },

    sendToAp(invoiceId, actor) {
      if (!allowed(actor, AP_SENDERS)) return deny('Only Finance or the owner can send invoices to Trademate.')
      const hit = findIn((d) => d.invoices, invoiceId)
      if (!hit) return deny('Invoice not found.')
      const inv = hit.row
      if (inv.status !== 'approved') return deny('Approve the invoice for payment first.')
      inv.status = 'sentToAp'
      inv.sentBy = actor.name
      inv.sentAt = now()
      inv.apRef = `TM-AP-${55100 + (++seq % 900)}`
      inv.history = [...inv.history, log(actor, `Sent to Trademate AP as ${inv.apRef}`)]
      return done(inv)
    },

    setTolerance(propertyId, price, qty, actor) {
      if (!allowed(actor, ['owner', 'finance', 'gm'])) return deny('Only Finance, the general manager or the owner can change tolerances.')
      if (!(price >= 0 && price <= 20) || !(qty >= 0 && qty <= 20)) return deny('Tolerances must be between 0 and 20%.')
      const d = of(propertyId)
      d.settings = { ...d.settings, priceTolerancePct: price, qtyTolerancePct: qty }
      return done(undefined)
    },

    logReject(input, actor) {
      if (!allowed(actor, REJECT_LOGGERS)) return deny('Only the storekeeper, procurement or a manager can log rejects.')
      const d = of(input.propertyId)
      if (!input.grnId) return deny('Pick the delivery.')
      if (!input.itemName) return deny('Pick the item.')
      if (!(input.qty > 0)) return deny('Enter how many were rejected.')
      const already = d.rejects.filter((r) => r.grnId === input.grnId && same(r.itemName, input.itemName)).reduce((s, r) => s + r.qty, 0)
      if (input.qty + already > input.delivered) return deny(`Only ${input.delivered - already} of ${input.itemName} left on that delivery to reject.`)
      if (!input.reason.trim()) return deny('Say why it was rejected.')
      const rej = {
        id: next('REJ'),
        propertyId: input.propertyId,
        grnId: input.grnId,
        poId: input.poId,
        supplierName: input.supplierName,
        itemName: input.itemName,
        qty: input.qty,
        reason: input.reason.trim(),
        at: now(),
        by: actor.name,
      }
      d.rejects = [rej, ...d.rejects]
      return done(rej)
    },

    // ---- supplier master ----

    saveContract(input, actor) {
      if (!allowed(actor, BUYERS)) return deny('Only procurement or a manager can change contracts.')
      const d = of(input.propertyId)
      if (!input.supplierName.trim()) return deny('Pick the supplier.')
      if (!input.title.trim()) return deny('Give the contract a title.')
      if (!isDate(input.startsOn) || !isDate(input.endsOn)) return deny('Enter the start and end dates.')
      if (input.endsOn <= input.startsOn) return deny('The end date must be after the start date.')
      if (!input.paymentTerms.trim()) return deny('Enter the payment terms.')
      if (!(input.leadTimeDays >= 0)) return deny('Enter the lead time in days.')
      const prices = input.prices.filter((p) => p.itemName.trim())
      if (prices.some((p) => !(p.unitPrice > 0))) return deny('Every item on the price list needs a price.')
      const names = prices.map((p) => p.itemName.trim().toLowerCase())
      if (new Set(names).size !== names.length) return deny('An item is on the price list twice.')
      const overlap = d.contracts.find(
        (c) => c.id !== input.id && same(c.supplierName, input.supplierName) && !c.endedAt && c.startsOn <= input.endsOn && input.startsOn <= c.endsOn,
      )
      if (overlap) return deny(`${input.supplierName} already has a contract for those dates (${overlap.title}).`)
      const prev = input.id ? d.contracts.find((c) => c.id === input.id) : undefined
      if (input.id && !prev) return deny('Contract not found.')
      if (prev && contractStatus(prev) === 'ended') return deny('An ended contract cannot be changed.')
      const c = {
        ...(prev ?? { id: next('CON'), createdBy: actor.name, createdAt: now() }),
        propertyId: input.propertyId,
        supplierName: input.supplierName.trim(),
        title: input.title.trim(),
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        paymentTerms: input.paymentTerms.trim(),
        leadTimeDays: Math.round(input.leadTimeDays),
        prices: prices.map((p) => ({ ...p, itemName: p.itemName.trim() })),
      }
      d.contracts = prev ? d.contracts.map((x) => (x.id === c.id ? c : x)) : [c, ...d.contracts]
      prices.forEach((p) =>
        d.prices.push({ id: next('PH'), propertyId: input.propertyId, itemName: p.itemName, supplierName: c.supplierName, unitPrice: p.unitPrice, qty: 0, at: now(), source: 'Contract', reference: c.title }),
      )
      return done(c)
    },

    endContract(id, reason, actor) {
      if (!allowed(actor, AWARDERS)) return deny('Only procurement, the general manager or the owner can end a contract.')
      const hit = findIn((d) => d.contracts, id)
      if (!hit) return deny('Contract not found.')
      const c = hit.row
      if (c.endedAt) return deny('This contract has already ended.')
      if (!reason.trim()) return deny('Say why the contract is ended.')
      c.endedAt = now()
      c.endedBy = actor.name
      c.endReason = reason.trim()
      return done(c)
    },

    addApproved(input, actor) {
      if (!allowed(actor, ['owner', 'gm'])) return deny('Only the general manager or the owner can approve a supplier.')
      const d = of(input.propertyId)
      if (!input.supplierName.trim()) return deny('Pick the supplier.')
      if (!input.itemName && !input.category) return deny('Pick an item or a category.')
      const dup = d.approved.find(
        (a) => same(a.supplierName, input.supplierName) && (a.itemName ?? '') === (input.itemName ?? '') && (a.category ?? '') === (input.category ?? ''),
      )
      if (dup) return deny('This supplier is already approved for that.')
      if (input.preferred) {
        d.approved = d.approved.map((a) =>
          (input.itemName ? a.itemName === input.itemName : a.category === input.category && !a.itemName) ? { ...a, preferred: false } : a,
        )
      }
      const a = { id: next('ASL'), ...input, supplierName: input.supplierName.trim(), approvedBy: actor.name, approvedAt: now() }
      d.approved = [a, ...d.approved]
      return done(a)
    },

    removeApproved(id, actor) {
      if (!allowed(actor, ['owner', 'gm'])) return deny('Only the general manager or the owner can change the approved list.')
      const hit = findIn((d) => d.approved, id)
      if (!hit) return deny('Not found.')
      hit.d.approved = hit.d.approved.filter((a) => a.id !== id)
      return done(undefined)
    },

    // ---- stores, units, transfers ----

    saveStore(input, actor) {
      if (!allowed(actor, STORE_SETUP)) return deny('Only the hotel admin or owner can change the stores.')
      const d = of(input.propertyId)
      const name = input.name.trim()
      if (!name) return deny('Enter the store name.')
      if (d.stores.some((s) => s.id !== input.id && same(s.name, name))) return deny('A store with this name already exists.')
      if (input.level !== 'central' && !input.parentId) return deny('Pick the store it draws from.')
      if (input.parentId && !d.stores.some((s) => s.id === input.parentId)) return deny('Pick the store it draws from.')
      if (input.id && input.parentId === input.id) return deny('A store cannot draw from itself.')
      if (input.level === 'central' && d.stores.some((s) => s.level === 'central' && s.id !== input.id))
        return deny('There is already a central store.')
      const prev = input.id ? d.stores.find((s) => s.id === input.id) : undefined
      if (input.id && !prev) return deny('Store not found.')
      if (!prev && input.legacyStoreId && d.stores.some((s) => s.legacyStoreId === input.legacyStoreId)) return deny('This store is already in the hierarchy.')
      if (prev?.legacyStoreId && input.active === false) return deny('A store from the stock list stays in use.')
      if (prev && input.active === false && d.balances.some((b) => b.storeId === prev.id && b.qty > 0))
        return deny('Move its stock to another store first.')
      const s = {
        ...(prev ?? { id: next(`${input.propertyId}-ST`), propertyId: input.propertyId }),
        name,
        level: input.level,
        parentId: input.level === 'central' ? undefined : input.parentId,
        department: input.department || undefined,
        active: input.active ?? prev?.active ?? true,
        legacyStoreId: prev?.legacyStoreId ?? input.legacyStoreId,
      }
      d.stores = prev ? d.stores.map((x) => (x.id === s.id ? s : x)) : [...d.stores, s]
      return done(s)
    },

    addConversion(input, actor) {
      if (!allowed(actor, STORE_STAFF)) return deny('Only store staff or a manager can change units.')
      const d = of(input.propertyId)
      if (!input.fromUnit || !input.toUnit) return deny('Pick both units.')
      if (same(input.fromUnit, input.toUnit)) return deny('Pick two different units.')
      if (!(input.factor > 0)) return deny('Enter how many make one.')
      const dup = d.conversions.find(
        (c) => same(c.fromUnit, input.fromUnit) && same(c.toUnit, input.toUnit) && (c.itemName ?? '') === (input.itemName ?? ''),
      )
      if (dup) return deny('This conversion already exists.')
      const c = { id: next('UC'), ...input }
      d.conversions = [...d.conversions, c]
      return done(c)
    },

    removeConversion(id, actor) {
      if (!allowed(actor, STORE_STAFF)) return deny('Only store staff or a manager can change units.')
      const hit = findIn((d) => d.conversions, id)
      if (!hit) return deny('Not found.')
      hit.d.conversions = hit.d.conversions.filter((c) => c.id !== id)
      return done(undefined)
    },

    saveReorderRule(input, actor) {
      if (!allowed(actor, STORE_STAFF)) return deny('Only store staff or a manager can set levels.')
      const d = of(input.propertyId)
      if (!input.storeId || !input.itemName) return deny('Pick the store and the item.')
      if (!(input.reorderAt >= 0) || !(input.par > 0)) return deny('Enter the reorder level and the par level.')
      if (input.par <= input.reorderAt) return deny('The par level must be above the reorder level.')
      const prev = d.reorderRules.find((r) => r.storeId === input.storeId && same(r.itemName, input.itemName))
      const r = { ...(prev ?? { id: next('RR') }), ...input }
      d.reorderRules = prev ? d.reorderRules.map((x) => (x.id === r.id ? r : x)) : [...d.reorderRules, r]
      return done(r)
    },

    createTransfer(input, available, actor) {
      if (!allowed(actor, STORE_STAFF)) return deny('Only store staff or a manager can move stock between stores.')
      const d = of(input.propertyId)
      const from = d.stores.find((s) => s.id === input.fromStoreId)
      const to = d.stores.find((s) => s.id === input.toStoreId)
      if (!from || !to) return deny('Pick both stores.')
      if (from.id === to.id) return deny('Pick two different stores.')
      if (!from.active || !to.active) return deny('One of these stores is not in use.')
      const lines = input.lines.filter((l) => l.itemName && l.qty > 0)
      if (lines.length === 0) return deny('Add at least one item with a quantity.')
      const names = lines.map((l) => l.itemName.toLowerCase())
      if (new Set(names).size !== names.length) return deny('An item is on the transfer twice.')
      for (const l of lines) {
        const have = l.fromHome ? (available[l.itemName] ?? 0) : balance(d, from.id, l.itemName)
        if (have < l.qty) return deny(`Only ${have} × ${l.itemName} in ${from.name}.`)
      }
      const t: Transfer = {
        id: next('TRF'),
        propertyId: input.propertyId,
        fromStoreId: from.id,
        toStoreId: to.id,
        status: 'draft',
        lines: lines.map((l) => ({ ...l })),
        note: input.note.trim(),
        createdBy: actor.name,
        createdAt: now(),
      }
      d.transfers = [t, ...d.transfers]
      return done(t)
    },

    sendTransfer(id, issueRef, actor) {
      if (!allowed(actor, STORE_STAFF)) return deny('Only store staff or a manager can send a transfer.')
      const hit = findIn((d) => d.transfers, id)
      if (!hit) return deny('Transfer not found.')
      const { d, row: t } = hit
      if (t.status !== 'draft') return deny('This transfer has already been sent.')
      for (const l of t.lines) {
        if (l.fromHome) continue
        const have = balance(d, t.fromStoreId, l.itemName)
        if (have < l.qty) return deny(`Only ${have} × ${l.itemName} left to send.`)
      }
      t.lines.forEach((l) => {
        if (!l.fromHome) addBalance(d, t.fromStoreId, l.itemName, -l.qty)
      })
      t.status = 'sent'
      t.sentBy = actor.name
      t.sentAt = now()
      t.issueRef = issueRef
      return done(t)
    },

    receiveTransfer(id, received, note, actor) {
      if (!allowed(actor, STORE_STAFF)) return deny('Only store staff or a manager can receive a transfer.')
      const hit = findIn((d) => d.transfers, id)
      if (!hit) return deny('Transfer not found.')
      const { d, row: t } = hit
      if (t.status !== 'sent') return deny('This transfer is not on its way.')
      if (received.length !== t.lines.length || received.some((q) => !(q >= 0))) return deny('Enter what arrived for every line.')
      const over = t.lines.findIndex((l, i) => received[i] > l.qty)
      if (over >= 0) return deny(`More ${t.lines[over].itemName} arrived than was sent.`)
      const short = t.lines.some((l, i) => received[i] < l.qty)
      if (short && !note.trim()) return deny('Less arrived than was sent. Say what happened.')
      t.lines = t.lines.map((l, i) => ({ ...l, receivedQty: received[i] }))
      t.lines.forEach((l) => {
        if (!l.toHome) addBalance(d, t.toStoreId, l.itemName, l.receivedQty ?? 0)
      })
      // What went missing on the way is wastage of the sending store's department.
      const fromDept = d.stores.find((s) => s.id === t.fromStoreId)?.department ?? 'Store'
      t.lines.forEach((l) => {
        const lost = l.qty - (l.receivedQty ?? 0)
        if (lost > 0)
          d.wastage.push({ id: next('WS'), propertyId: t.propertyId, at: now(), itemName: l.itemName, qty: lost, unitCost: l.unitCost ?? 0, reason: 'Lost in transfer', department: fromDept })
      })
      t.status = 'received'
      t.receivedBy = actor.name
      t.receivedAt = now()
      t.receiveNote = note.trim() || undefined
      return done(t)
    },

    cancelTransfer(id, reason, actor) {
      if (!allowed(actor, STORE_STAFF)) return deny('Only store staff or a manager can cancel a transfer.')
      const hit = findIn((d) => d.transfers, id)
      if (!hit) return deny('Transfer not found.')
      const t = hit.row
      if (t.status !== 'draft') return deny('Only a transfer that has not been sent can be cancelled.')
      if (!reason.trim()) return deny('Say why it is cancelled.')
      t.status = 'cancelled'
      t.cancelReason = reason.trim()
      return done(t)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
