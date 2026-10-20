import { TODAY } from '../../data/sample'
import { ugx } from '../../lib/format'
import type { EventsService } from './eventsService'
import { STAGE_PROBABILITY, SETUP_LABEL, availableOn, capacityOf, clashesFor, quoteTotals } from './eventsRules'
import { sampleData } from './eventsSample'
import type {
  Actor,
  Beo,
  BookingInput,
  Contract,
  DepositSchedule,
  EventBooking,
  EventsData,
  Lead,
  LeadInput,
  LeadStage,
  Quote,
  QuoteLine,
  QuoteLineInput,
  QuoteVersion,
} from './eventsTypes'

// In-memory events for the prototype. Lasts until the page is reloaded. It applies the same checks
// the backend must apply (clashes, capacity, stock of equipment, money rules) so screens can be tested.
export function createMockEventsService(): EventsService {
  const db: EventsData = sampleData()
  let counter = 5000
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  const nextId = (prefix: string) => `${prefix}-${++counter}`
  const now = () => new Date().toISOString()
  const deny = <T>(why: string): Promise<T> => Promise.reject(new Error(why))
  const done = <T>(value: T): Promise<T> => {
    emit()
    return Promise.resolve(value)
  }
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

  function find<K extends keyof EventsData>(table: K, id: string): EventsData[K][number] | undefined {
    return (db[table] as { id: string }[]).find((r) => r.id === id) as EventsData[K][number] | undefined
  }
  function replace<K extends keyof EventsData>(table: K, row: EventsData[K][number]) {
    const list = db[table] as { id: string }[]
    const i = list.findIndex((r) => r.id === (row as { id: string }).id)
    if (i >= 0) list[i] = row as { id: string }
  }
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
  const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s)
  const money = (n: number) => Number.isFinite(n) && n >= 0

  function checkLead(input: LeadInput): string | null {
    if (!input.title.trim()) return 'Give the lead a title.'
    if (!input.clientName.trim()) return 'Who is the client?'
    if (!input.contactName.trim() || !input.contactPhone.trim()) return 'Add a contact name and phone.'
    if (!isDate(input.eventDate) || !isDate(input.endDate)) return 'Pick the event dates.'
    if (input.endDate < input.eventDate) return 'The end date is before the start date.'
    if (!(input.expectedGuests > 0)) return 'Expected guests must be more than 0.'
    if (!money(input.estimatedValue)) return 'The value cannot be negative.'
    if (!(input.probability >= 0 && input.probability <= 100)) return 'Probability is between 0 and 100.'
    return null
  }
  function checkBooking(input: BookingInput): string | null {
    if (!input.name.trim()) return 'Give the event a name.'
    if (!input.clientName.trim()) return 'Who is the client?'
    if (!isDate(input.startDate) || !isDate(input.endDate)) return 'Pick the event dates.'
    if (input.endDate < input.startDate) return 'The end date is before the start date.'
    if (!(input.expectedGuests > 0)) return 'Expected guests must be more than 0.'
    return null
  }

  function makeBooking(propertyId: string, input: BookingInput, actor: Actor): EventBooking {
    const b: EventBooking = {
      id: nextId('EV'),
      propertyId,
      leadId: input.leadId,
      name: input.name.trim(),
      eventType: input.eventType,
      companyId: input.companyId || undefined,
      clientName: input.clientName.trim(),
      contactName: input.contactName.trim(),
      contactPhone: input.contactPhone.trim(),
      status: input.status ?? 'tentative',
      startDate: input.startDate,
      endDate: input.endDate,
      expectedGuests: input.expectedGuests,
      ownerName: input.ownerName || actor.name,
      notes: input.notes?.trim() || undefined,
      createdAt: now(),
      createdBy: actor.name,
    }
    db.bookings.unshift(b)
    db.beos.push({ id: nextId('BEO'), propertyId, eventBookingId: b.id, version: 1, status: 'draft', agenda: [] })
    return b
  }

  function bookingFromLead(l: Lead, status: 'tentative' | 'definite', actor: Actor): EventBooking {
    return makeBooking(
      l.propertyId,
      {
        leadId: l.id,
        name: l.title,
        eventType: l.eventType,
        companyId: l.companyId,
        clientName: l.clientName,
        contactName: l.contactName,
        contactPhone: l.contactPhone,
        startDate: l.eventDate,
        endDate: l.endDate,
        expectedGuests: l.expectedGuests,
        ownerName: l.ownerName,
        status,
      },
      actor,
    )
  }

  function clashText(b: EventBooking): string | null {
    for (const s of db.sessions.filter((x) => x.eventBookingId === b.id)) {
      const others = clashesFor(s, db.sessions, db.bookings).filter((o) => o.eventBookingId !== b.id)
      if (others.length) {
        const other = find('bookings', others[0].eventBookingId)
        const sp = find('spaces', s.spaceId)
        return `${sp?.name ?? 'The space'} on ${s.date} ${s.startTime}-${s.endTime} clashes with ${other?.name ?? 'another event'}. Move one of them first.`
      }
    }
    return null
  }

  function setStage(l: Lead, stage: LeadStage, actor: Actor) {
    if (l.stage === stage) return l
    const next: Lead = {
      ...l,
      stage,
      probability: STAGE_PROBABILITY[stage],
      lostReason: stage === 'lost' ? l.lostReason : undefined,
      stageHistory: [...l.stageHistory, { stage, at: now(), by: actor.name }],
      updatedAt: now(),
    }
    replace('leads', next)
    return next
  }

  function quoteNumber() {
    const n = db.quotes.reduce((m, q) => Math.max(m, Number(q.number.replace(/\D/g, '')) || 0), 1000) + 1
    return `Q-${n}`
  }
  function contractNumber() {
    const n = db.contracts.reduce((m, c) => Math.max(m, Number(c.number.replace(/\D/g, '')) || 0), 1000) + 1
    return `C-${n}`
  }

  function checkLines(lines: QuoteLineInput[]): string | null {
    if (lines.length === 0) return 'Add at least one line.'
    for (const l of lines) {
      if (!l.description.trim()) return 'Every line needs a description.'
      if (!(l.quantity > 0)) return `Quantity on "${l.description}" must be more than 0.`
      if (!money(l.unitPrice) || !money(l.unitCost)) return `Prices on "${l.description}" cannot be negative.`
    }
    return null
  }
  function addVersion(q: Quote, version: number, reason: string, discountPct: number, lines: QuoteLineInput[], actor: Actor): QuoteVersion {
    const id = nextId('QV')
    const made: QuoteLine[] = lines.map((l) => ({ ...l, description: l.description.trim(), id: nextId('QL'), propertyId: q.propertyId, quoteVersionId: id }))
    const t = quoteTotals(made, discountPct)
    const v: QuoteVersion = { id, propertyId: q.propertyId, quoteId: q.id, version, reason: reason.trim(), discountPct, subtotal: t.subtotal, discount: t.discount, total: t.total, createdAt: now(), createdBy: actor.name }
    db.quoteVersions.push(v)
    db.quoteLines.push(...made)
    return v
  }

  return {
    load(propertyId) {
      const out = {} as EventsData
      for (const key of Object.keys(db) as (keyof EventsData)[]) {
        ;(out as unknown as Record<string, unknown[]>)[key] = clone((db[key] as { propertyId: string }[]).filter((r) => r.propertyId === propertyId))
      }
      return Promise.resolve(out)
    },

    // ---- Pipeline ----
    createLead(propertyId, input, actor) {
      const bad = checkLead(input)
      if (bad) return deny(bad)
      const l: Lead = {
        ...input,
        id: nextId('LD'),
        propertyId,
        title: input.title.trim(),
        companyId: input.companyId || undefined,
        stage: 'enquiry',
        stageHistory: [{ stage: 'enquiry', at: now(), by: actor.name }],
        createdAt: now(),
        createdBy: actor.name,
        updatedAt: now(),
      }
      db.leads.unshift(l)
      return done(l)
    },
    updateLead(id, input, actor) {
      const l = find('leads', id)
      if (!l) return deny('Lead not found.')
      const bad = checkLead(input)
      if (bad) return deny(bad)
      const next: Lead = { ...l, ...input, title: input.title.trim(), companyId: input.companyId || undefined, updatedAt: now() }
      replace('leads', next)
      void actor
      return done(next)
    },
    moveLead(id, stage, actor, lostReason) {
      const l = find('leads', id)
      if (!l) return deny('Lead not found.')
      if (stage === 'lost' && !lostReason?.trim()) return deny('Say why the lead was lost.')
      let lead = l
      if (stage === 'tentative' || stage === 'definite') {
        if (!lead.eventBookingId) {
          const b = bookingFromLead(lead, 'tentative', actor)
          lead = { ...lead, eventBookingId: b.id }
          replace('leads', lead)
        }
        const b = find('bookings', lead.eventBookingId as string)
        if (b && stage === 'definite') {
          const clash = clashText(b)
          if (clash) return deny(clash)
        }
        if (b) replace('bookings', { ...b, status: stage })
      }
      if (stage === 'lost' && lead.eventBookingId) {
        const b = find('bookings', lead.eventBookingId)
        if (b && b.status !== 'completed') replace('bookings', { ...b, status: 'cancelled' })
      }
      if ((stage === 'enquiry' || stage === 'proposal') && lead.eventBookingId) {
        const b = find('bookings', lead.eventBookingId)
        if (b?.status === 'definite') return deny('The event is definite. Cancel the booking before moving the lead back.')
      }
      const next = setStage(lead, stage, actor)
      if (stage === 'lost') replace('leads', { ...next, lostReason: lostReason?.trim() })
      return done(find('leads', id) as Lead)
    },

    // ---- Bookings and diary ----
    createBooking(propertyId, input, actor) {
      const bad = checkBooking(input)
      if (bad) return deny(bad)
      return done(makeBooking(propertyId, input, actor))
    },
    updateBooking(id, patch, actor) {
      const b = find('bookings', id)
      if (!b) return deny('Event not found.')
      const next: EventBooking = { ...b, ...patch, companyId: patch.companyId === '' ? undefined : (patch.companyId ?? b.companyId) }
      const bad = checkBooking(next)
      if (bad) return deny(bad)
      if (patch.guaranteedGuests !== undefined && !(patch.guaranteedGuests >= 0)) return deny('Guaranteed guests cannot be negative.')
      replace('bookings', next)
      void actor
      return done(next)
    },
    setBookingStatus(id, status, actor) {
      const b = find('bookings', id)
      if (!b) return deny('Event not found.')
      if (status === 'definite') {
        const clash = clashText(b)
        if (clash) return deny(clash)
      }
      if (status === 'completed' && b.endDate > TODAY) return deny('An event can only be completed once it has happened.')
      const next = { ...b, status }
      replace('bookings', next)
      if (b.leadId) {
        const l = find('leads', b.leadId)
        if (l) {
          if (status === 'definite' || status === 'tentative') setStage(l, status, actor)
          if (status === 'cancelled') replace('leads', { ...setStage(l, 'lost', actor), lostReason: 'Event cancelled' })
        }
      }
      return done(next)
    },
    linkGroupBlock(id, groupBlockId, actor) {
      const b = find('bookings', id)
      if (!b) return deny('Event not found.')
      const next = { ...b, groupBlockId: groupBlockId ?? undefined }
      replace('bookings', next)
      for (const m of db.masterAccounts.filter((x) => x.eventBookingId === id)) replace('masterAccounts', { ...m, groupBlockId: groupBlockId ?? undefined })
      void actor
      return done(next)
    },
    saveSession(propertyId, input, actor) {
      const b = find('bookings', input.eventBookingId)
      if (!b) return deny('Pick the event.')
      if (b.status === 'cancelled' || b.status === 'completed') return deny('This event is closed.')
      const sp = find('spaces', input.spaceId)
      if (!sp || !sp.active) return deny('Pick a function space.')
      if (!input.title.trim()) return deny('Name the session, for example "Plenary" or "Dinner".')
      if (!isDate(input.date)) return deny('Pick the date.')
      if (!isTime(input.startTime) || !isTime(input.endTime) || input.endTime <= input.startTime) return deny('The end time must be after the start time.')
      const cap = capacityOf(db.setups, sp.id, input.setup)
      if (cap === undefined) return deny(`${sp.name} cannot be set up ${SETUP_LABEL[input.setup].toLowerCase()} style.`)
      if (!(input.pax > 0)) return deny('How many people?')
      if (input.pax > cap) return deny(`${sp.name} holds ${cap} ${SETUP_LABEL[input.setup].toLowerCase()} style, not ${input.pax}.`)
      const clashes = clashesFor(input, db.sessions, db.bookings).filter((s) => s.eventBookingId !== b.id || s.id !== input.id)
      const hard = clashes.find((s) => b.status === 'definite' || find('bookings', s.eventBookingId)?.status === 'definite')
      if (hard) {
        const other = find('bookings', hard.eventBookingId)
        return deny(`${sp.name} is taken ${hard.startTime}-${hard.endTime} by ${other?.name ?? 'another event'}.`)
      }
      if (input.id) {
        const old = find('sessions', input.id)
        if (!old) return deny('Session not found.')
        const next = { ...old, ...input, title: input.title.trim() }
        replace('sessions', next)
        void actor
        return done(next)
      }
      const s = { ...input, title: input.title.trim(), id: nextId('SS'), propertyId }
      db.sessions.push(s)
      return done(s)
    },
    deleteSession(id) {
      const i = db.sessions.findIndex((s) => s.id === id)
      if (i < 0) return deny('Session not found.')
      db.sessions.splice(i, 1)
      return done(undefined)
    },

    // ---- BEO and resources ----
    saveBeo(id, patch, actor) {
      const b = find('beos', id)
      if (!b) return deny('BEO not found.')
      for (const a of patch.agenda) if (!isTime(a.time) || !a.item.trim()) return deny('Every agenda line needs a time and an item.')
      const next: Beo = {
        ...b,
        agenda: [...patch.agenda].map((a) => ({ time: a.time, item: a.item.trim() })).sort((x, y) => x.time.localeCompare(y.time)),
        kitchenNotes: patch.kitchenNotes?.trim() || undefined,
        setupNotes: patch.setupNotes?.trim() || undefined,
        // A signed BEO that changes goes back to draft; the client signs the new one.
        status: 'draft',
        signedAt: undefined,
        signedBy: undefined,
      }
      replace('beos', next)
      void actor
      return done(next)
    },
    issueBeo(id, actor) {
      const b = find('beos', id)
      if (!b) return deny('BEO not found.')
      if (b.status !== 'draft') return deny('This BEO is already issued.')
      const items = db.beoItems.filter((i) => i.beoId === id)
      if (b.agenda.length === 0 && items.length === 0) return deny('Add the agenda or the menus before issuing.')
      const next: Beo = { ...b, status: 'issued', version: b.issuedAt ? b.version + 1 : b.version, issuedAt: now(), issuedBy: actor.name }
      replace('beos', next)
      return done(next)
    },
    signBeo(id, signedBy, actor) {
      const b = find('beos', id)
      if (!b) return deny('BEO not found.')
      if (b.status !== 'issued') return deny('Issue the BEO before the client signs it.')
      if (!signedBy.trim()) return deny('Who signed for the client?')
      const next: Beo = { ...b, status: 'signed', signedAt: now(), signedBy: signedBy.trim() }
      replace('beos', next)
      void actor
      return done(next)
    },
    addBeoItem(beoId, input) {
      const b = find('beos', beoId)
      if (!b) return deny('BEO not found.')
      if (!input.description.trim()) return deny('Describe the item.')
      if (!isDate(input.date)) return deny('Pick the date it is served.')
      if (!(input.quantity > 0)) return deny('Quantity must be more than 0.')
      if (!money(input.unitPrice) || !money(input.unitCost)) return deny('Prices cannot be negative.')
      const ev = find('bookings', b.eventBookingId)
      if (ev && (input.date < ev.startDate || input.date > ev.endDate)) return deny('That date is outside the event.')
      const i = { ...input, description: input.description.trim(), id: nextId('BI'), propertyId: b.propertyId, beoId }
      db.beoItems.push(i)
      if (b.status !== 'draft') replace('beos', { ...b, status: 'draft', signedAt: undefined, signedBy: undefined })
      return done(i)
    },
    removeBeoItem(id) {
      const i = db.beoItems.findIndex((x) => x.id === id)
      if (i < 0) return deny('Item not found.')
      const b = find('beos', db.beoItems[i].beoId)
      db.beoItems.splice(i, 1)
      if (b && b.status !== 'draft') replace('beos', { ...b, status: 'draft', signedAt: undefined, signedBy: undefined })
      return done(undefined)
    },
    bookResource(eventBookingId, equipmentId, date, quantity) {
      const ev = find('bookings', eventBookingId)
      if (!ev) return deny('Event not found.')
      const e = find('equipment', equipmentId)
      if (!e) return deny('Pick the equipment or staff.')
      if (!isDate(date) || date < ev.startDate || date > ev.endDate) return deny('Pick a day of the event.')
      if (!(quantity > 0) || !Number.isInteger(quantity)) return deny('Quantity must be a whole number above 0.')
      const live = new Set(db.bookings.filter((b) => b.status !== 'cancelled').map((b) => b.id))
      const free = availableOn(e, date, db.resourceBookings, live)
      if (quantity > free) return deny(`Only ${Math.max(0, free)} of ${e.quantityOwned} ${e.name.toLowerCase()} free on ${date}.`)
      const r = { id: nextId('RB'), propertyId: ev.propertyId, eventBookingId, equipmentId, date, quantity, unitPrice: e.dailyRate, unitCost: e.dailyCost }
      db.resourceBookings.push(r)
      return done(r)
    },
    removeResource(id) {
      const i = db.resourceBookings.findIndex((x) => x.id === id)
      if (i < 0) return deny('Not found.')
      db.resourceBookings.splice(i, 1)
      return done(undefined)
    },

    // ---- Quotes, contracts, deposits ----
    createQuote(propertyId, input, actor) {
      if (!input.title.trim()) return deny('Give the quote a title.')
      if (!input.leadId && !input.eventBookingId) return deny('Link the quote to a lead or an event.')
      if (!isDate(input.validUntil)) return deny('Pick the date the quote is valid until.')
      if (!(input.discountPct >= 0 && input.discountPct <= 30)) return deny('Discount is between 0% and 30%.')
      const bad = checkLines(input.lines)
      if (bad) return deny(bad)
      const q: Quote = {
        id: nextId('QT'),
        propertyId,
        number: quoteNumber(),
        leadId: input.leadId || undefined,
        eventBookingId: input.eventBookingId || undefined,
        title: input.title.trim(),
        status: 'draft',
        currentVersion: 1,
        validUntil: input.validUntil,
        createdAt: now(),
        createdBy: actor.name,
      }
      db.quotes.unshift(q)
      addVersion(q, 1, 'First proposal', input.discountPct, input.lines, actor)
      if (q.leadId) {
        const l = find('leads', q.leadId)
        if (l && l.stage === 'enquiry') setStage(l, 'proposal', actor)
      }
      return done(q)
    },
    amendQuote(id, input, actor) {
      const q = find('quotes', id)
      if (!q) return deny('Quote not found.')
      if (q.status === 'declined') return deny('This quote was declined. Start a new one.')
      if (!input.reason.trim()) return deny('Say what changed.')
      if (!(input.discountPct >= 0 && input.discountPct <= 30)) return deny('Discount is between 0% and 30%.')
      const bad = checkLines(input.lines)
      if (bad) return deny(bad)
      const signed = db.contracts.find((c) => c.quoteId === id && c.status === 'signed')
      const v = addVersion(q, q.currentVersion + 1, input.reason, input.discountPct, input.lines, actor)
      // An amendment to an accepted quote with a signed contract carries the new value into the contract.
      const next: Quote = { ...q, currentVersion: v.version, status: signed ? 'accepted' : 'draft', sentAt: signed ? q.sentAt : undefined, acceptedAt: signed ? q.acceptedAt : undefined, acceptedBy: signed ? q.acceptedBy : undefined }
      replace('quotes', next)
      if (signed) replace('contracts', { ...signed, quoteVersion: v.version, value: v.total })
      for (const c of db.contracts.filter((x) => x.quoteId === id && (x.status === 'draft' || x.status === 'sent'))) replace('contracts', { ...c, status: 'cancelled' })
      return done(next)
    },
    sendQuote(id, actor) {
      const q = find('quotes', id)
      if (!q) return deny('Quote not found.')
      if (q.status !== 'draft') return deny('Only a draft can be sent.')
      const next: Quote = { ...q, status: 'sent', sentAt: now(), sentBy: actor.name }
      replace('quotes', next)
      return done(next)
    },
    acceptQuote(id, actor) {
      const q = find('quotes', id)
      if (!q) return deny('Quote not found.')
      if (q.status !== 'sent') return deny('Send the quote before marking it accepted.')
      if (q.validUntil < TODAY) return deny('This quote has expired. Amend it with a new date first.')
      let eventBookingId = q.eventBookingId
      const l = q.leadId ? find('leads', q.leadId) : undefined
      if (!eventBookingId && l) {
        eventBookingId = l.eventBookingId ?? bookingFromLead(l, 'tentative', actor).id
        replace('leads', { ...(find('leads', l.id) as Lead), eventBookingId })
      }
      if (!eventBookingId) return deny('Link the quote to an event first.')
      // A booking made from this quote starts its BEO with the quoted packages.
      if (!q.eventBookingId) {
        const beo = db.beos.find((b) => b.eventBookingId === eventBookingId)
        const ev0 = find('bookings', eventBookingId)
        const v0 = db.quoteVersions.find((x) => x.quoteId === id && x.version === q.currentVersion)
        if (beo && ev0 && v0)
          for (const ql of db.quoteLines.filter((x) => x.quoteVersionId === v0.id && x.kind === 'package')) {
            const p = ql.refId ? find('packages', ql.refId) : undefined
            db.beoItems.push({ id: nextId('BI'), propertyId: q.propertyId, beoId: beo.id, kind: p?.kind === 'menu' ? 'menu' : 'package', packageId: p?.id, description: ql.description, date: ev0.startDate, quantity: ql.quantity, unitPrice: ql.unitPrice, unitCost: ql.unitCost, perHead: true })
          }
      }
      const lead = l ? (find('leads', l.id) as Lead) : undefined
      if (lead && (lead.stage === 'enquiry' || lead.stage === 'proposal')) setStage(lead, 'tentative', actor)
      const next: Quote = { ...q, eventBookingId, status: 'accepted', acceptedAt: now(), acceptedBy: actor.name }
      replace('quotes', next)
      const v = db.quoteVersions.find((x) => x.quoteId === id && x.version === q.currentVersion) as QuoteVersion
      const ev = find('bookings', eventBookingId) as EventBooking
      const c: Contract = {
        id: nextId('CT'),
        propertyId: q.propertyId,
        number: contractNumber(),
        eventBookingId,
        quoteId: q.id,
        quoteVersion: v.version,
        value: v.total,
        status: 'draft',
        cancellationTerms: '50% of the contract value is kept if cancelled within 30 days of the event; 100% within 7 days.',
        createdAt: now(),
        createdBy: actor.name,
      }
      db.contracts.unshift(c)
      // Default schedule: 30% now, 40% a month before, the rest a week before.
      const first = Math.round(v.total * 0.3)
      const second = Math.round(v.total * 0.4)
      const before = (n: number) => {
        const d = new Date(`${ev.startDate}T00:00:00`)
        d.setDate(d.getDate() - n)
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return iso < TODAY ? TODAY : iso
      }
      const rows: [string, string, number][] = [
        ['Deposit on signing', TODAY, first],
        ['Second deposit', before(30), second],
        ['Balance', before(7), v.total - first - second],
      ]
      for (const [label, dueDate, amount] of rows) db.depositSchedules.push({ id: nextId('DS'), propertyId: q.propertyId, contractId: c.id, label, dueDate, amount })
      return done(next)
    },
    declineQuote(id, actor) {
      const q = find('quotes', id)
      if (!q) return deny('Quote not found.')
      if (q.status !== 'sent' && q.status !== 'draft') return deny('Only an open quote can be declined.')
      const next: Quote = { ...q, status: 'declined' }
      replace('quotes', next)
      void actor
      return done(next)
    },
    sendContract(id) {
      const c = find('contracts', id)
      if (!c) return deny('Contract not found.')
      if (c.status !== 'draft') return deny('Only a draft contract can be sent.')
      const next: Contract = { ...c, status: 'sent', sentAt: now() }
      replace('contracts', next)
      return done(next)
    },
    signContract(id, signedBy, actor) {
      const c = find('contracts', id)
      if (!c) return deny('Contract not found.')
      if (c.status !== 'sent') return deny('Send the contract before recording the signature.')
      if (!signedBy.trim()) return deny('Who signed for the client?')
      const b = find('bookings', c.eventBookingId)
      if (b) {
        const clash = clashText(b)
        if (clash) return deny(clash)
        replace('bookings', { ...b, status: 'definite' })
        if (b.leadId) {
          const l = find('leads', b.leadId)
          if (l) setStage(l, 'definite', actor)
        }
      }
      const next: Contract = { ...c, status: 'signed', signedAt: now(), signedBy: signedBy.trim() }
      replace('contracts', next)
      return done(next)
    },
    cancelContract(id) {
      const c = find('contracts', id)
      if (!c) return deny('Contract not found.')
      if (c.status === 'cancelled') return deny('Already cancelled.')
      const next: Contract = { ...c, status: 'cancelled' }
      replace('contracts', next)
      return done(next)
    },
    saveDepositSchedule(contractId, rows) {
      const c = find('contracts', contractId)
      if (!c) return deny('Contract not found.')
      if (rows.length === 0) return deny('Add at least one deposit.')
      for (const r of rows) {
        if (!r.label.trim()) return deny('Every deposit needs a label.')
        if (!isDate(r.dueDate)) return deny(`Pick a due date for "${r.label}".`)
        if (!(r.amount > 0)) return deny(`"${r.label}" must be more than 0.`)
      }
      const sum = rows.reduce((s, r) => s + r.amount, 0)
      if (sum > c.value) return deny(`The deposits add up to ${ugx(sum)}, more than the contract (${ugx(c.value)}).`)
      const old = db.depositSchedules.filter((d) => d.contractId === contractId)
      const paidRows = new Set(db.payments.map((p) => p.depositScheduleId).filter(Boolean))
      if (old.some((o) => paidRows.has(o.id) && !rows.some((r) => r.id === o.id))) return deny('A deposit with payments on it cannot be removed.')
      db.depositSchedules = db.depositSchedules.filter((d) => d.contractId !== contractId)
      const made: DepositSchedule[] = rows.map((r) => ({
        id: r.id ?? nextId('DS'),
        propertyId: c.propertyId,
        contractId,
        label: r.label.trim(),
        dueDate: r.dueDate,
        amount: r.amount,
      }))
      db.depositSchedules.push(...made)
      return done(made)
    },
    recordPayment(eventBookingId, input, actor) {
      const b = find('bookings', eventBookingId)
      if (!b) return deny('Event not found.')
      if (!(input.amount > 0)) return deny('The amount must be more than 0.')
      if (!input.method) return deny('How was it paid?')
      if (input.method !== 'Cash' && !input.reference.trim()) return deny('Add the transaction reference.')
      const p = {
        id: nextId('EP'),
        propertyId: b.propertyId,
        eventBookingId,
        depositScheduleId: input.depositScheduleId || undefined,
        amount: input.amount,
        method: input.method,
        reference: input.reference.trim(),
        receivedAt: now(),
        receivedBy: actor.name,
      }
      db.payments.push(p)
      return done(p)
    },

    // ---- Master billing ----
    openMasterAccount(eventBookingId, actor) {
      const b = find('bookings', eventBookingId)
      if (!b) return deny('Event not found.')
      if (db.masterAccounts.some((m) => m.eventBookingId === eventBookingId)) return deny('This event already has a master account.')
      if (b.status === 'cancelled') return deny('The event is cancelled.')
      const m = {
        id: nextId('MA'),
        propertyId: b.propertyId,
        eventBookingId,
        name: `${b.clientName} - ${b.name}`,
        companyId: b.companyId,
        groupBlockId: b.groupBlockId,
        status: 'open' as const,
        openedAt: now(),
        openedBy: actor.name,
      }
      db.masterAccounts.push(m)
      return done(m)
    },
    postCharge(masterAccountId, input, actor) {
      const m = find('masterAccounts', masterAccountId)
      if (!m) return deny('Master account not found.')
      if (m.status !== 'open') return deny('This master account is closed.')
      if (!input.description.trim()) return deny('Describe the charge.')
      if (!(input.amount > 0)) return deny('The amount must be more than 0.')
      if (!isDate(input.date)) return deny('Pick the date.')
      if (input.sourceId && db.postings.some((p) => !p.voidedAt && p.sourceId === input.sourceId && p.masterAccountId === masterAccountId))
        return deny('That item is already posted.')
      const p = {
        ...input,
        description: input.description.trim(),
        id: nextId('PO'),
        propertyId: m.propertyId,
        masterAccountId,
        eventBookingId: m.eventBookingId,
        postedAt: now(),
        postedBy: actor.name,
      }
      db.postings.push(p)
      return done(p)
    },
    voidPosting(id, reason, actor) {
      const p = find('postings', id)
      if (!p) return deny('Posting not found.')
      if (p.voidedAt) return deny('Already voided.')
      if (!reason.trim()) return deny('Say why it is voided.')
      const m = find('masterAccounts', p.masterAccountId)
      if (m?.status !== 'open') return deny('The master account is closed.')
      const next = { ...p, voidedAt: now(), voidedBy: actor.name, voidReason: reason.trim() }
      replace('postings', next)
      return done(next)
    },
    closeMasterAccount(id, actor) {
      const m = find('masterAccounts', id)
      if (!m) return deny('Master account not found.')
      if (m.status === 'closed') return deny('Already closed.')
      const next = { ...m, status: 'closed' as const, closedAt: now(), closedBy: actor.name }
      replace('masterAccounts', next)
      return done(next)
    },
    addCost(eventBookingId, input, actor) {
      const b = find('bookings', eventBookingId)
      if (!b) return deny('Event not found.')
      if (!input.description.trim()) return deny('Describe the cost.')
      if (!(input.amount > 0)) return deny('The amount must be more than 0.')
      const c = { ...input, description: input.description.trim(), id: nextId('EC'), propertyId: b.propertyId, eventBookingId, recordedAt: now(), recordedBy: actor.name }
      db.costs.push(c)
      return done(c)
    },
    removeCost(id) {
      const i = db.costs.findIndex((c) => c.id === id)
      if (i < 0) return deny('Cost not found.')
      db.costs.splice(i, 1)
      return done(undefined)
    },

    // ---- Set-up ----
    saveSpace(propertyId, input) {
      if (!input.name.trim()) return deny('Name the space.')
      if (!money(input.hireRateHalfDay) || !money(input.hireRateFullDay)) return deny('Hire rates cannot be negative.')
      if (input.hireRateFullDay < input.hireRateHalfDay) return deny('The full-day rate is lower than the half-day rate.')
      const setups = input.setups.filter((s) => s.capacity > 0)
      if (setups.length === 0) return deny('Give at least one layout a capacity.')
      if (db.spaces.some((s) => s.propertyId === propertyId && s.id !== input.id && s.name.toLowerCase() === input.name.trim().toLowerCase()))
        return deny('A space with this name already exists.')
      const id = input.id ?? nextId('SP')
      const old = input.id ? find('spaces', input.id) : undefined
      const sp = { id, propertyId, name: input.name.trim(), kind: input.kind, areaSqm: input.areaSqm, hireRateHalfDay: input.hireRateHalfDay, hireRateFullDay: input.hireRateFullDay, active: old?.active ?? true }
      if (old) replace('spaces', sp)
      else db.spaces.push(sp)
      db.setups = db.setups.filter((s) => s.spaceId !== id)
      db.setups.push(...setups.map((s) => ({ id: `${id}-${s.setup}`, propertyId, spaceId: id, setup: s.setup, capacity: s.capacity })))
      return done(sp)
    },
    setSpaceActive(id, active) {
      const sp = find('spaces', id)
      if (!sp) return deny('Space not found.')
      if (!active && db.sessions.some((s) => s.spaceId === id && s.date >= TODAY && find('bookings', s.eventBookingId)?.status !== 'cancelled'))
        return deny('This space has bookings coming up. Move them first.')
      const next = { ...sp, active }
      replace('spaces', next)
      return done(next)
    },
    savePackage(propertyId, input) {
      if (!input.name.trim()) return deny('Name the package.')
      if (!(input.pricePerHead > 0)) return deny('Price per head must be more than 0.')
      if (!money(input.costPerHead)) return deny('Cost cannot be negative.')
      const id = input.id ?? nextId('PK')
      const old = input.id ? find('packages', input.id) : undefined
      const p = { id, propertyId, name: input.name.trim(), kind: input.kind, pricePerHead: input.pricePerHead, costPerHead: input.costPerHead, active: old?.active ?? true }
      if (old) replace('packages', p)
      else db.packages.push(p)
      db.packageItems = db.packageItems.filter((i) => i.packageId !== id)
      db.packageItems.push(
        ...input.items
          .map((s) => s.trim())
          .filter(Boolean)
          .map((description, i) => ({ id: `${id}-${i + 1}`, propertyId, packageId: id, category: 'food' as const, description })),
      )
      return done(p)
    },
    saveEquipment(propertyId, input) {
      if (!input.name.trim()) return deny('Name the item.')
      if (!(input.quantityOwned > 0) || !Number.isInteger(input.quantityOwned)) return deny('How many does the hotel have?')
      if (!money(input.dailyRate) || !money(input.dailyCost)) return deny('Rates cannot be negative.')
      const id = input.id ?? nextId('EQ')
      const old = input.id ? find('equipment', input.id) : undefined
      if (old) {
        const perDay = new Map<string, number>()
        for (const r of db.resourceBookings.filter((x) => x.equipmentId === id && x.date >= TODAY)) perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.quantity)
        const peak = Math.max(0, ...perDay.values())
        if (input.quantityOwned < peak) return deny(`${peak} are already booked on one day. Keep at least that many.`)
      }
      const e = { id, propertyId, name: input.name.trim(), category: input.category, quantityOwned: input.quantityOwned, dailyRate: input.dailyRate, dailyCost: input.dailyCost }
      if (old) replace('equipment', e)
      else db.equipment.push(e)
      return done(e)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
