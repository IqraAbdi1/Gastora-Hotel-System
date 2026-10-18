import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { TODAY } from '../../data/sample'
import { folioOf, stamp } from '../../lib/folio'
import { dayMonth, nightsBetween, ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { billLink, portalLink, preRegLink } from '../../lib/preRegistration'
import { depositFor, nightlyRate } from '../../lib/rates'
import {
  DEFAULT_MESSAGING,
  KIND_LABEL,
  dueForStay,
  fillTemplate,
  writtenAlready,
  mayReceive,
  newMessageId,
  templateFor,
} from '../../lib/messages'
import type { DueInput, GuestMessage, MessageKind, MessageVars } from '../../lib/messages'
import type { Reservation } from '../../types'
import { useFeatures } from '../platform/featuresContext'
import { MessagesContext } from './messagesContext'
import type { MessagesValue, QueueInput } from './messagesContext'

// The outbox. Messages are written by the rules in lib/messages and wait here until somebody sends them,
// or go by themselves if the hotel has asked for that.
//
// Nothing leaves the building in this prototype. A message marked sent is the hotel's record that it
// went; where a real WhatsApp or SMS provider would be called is marked below, and it is one function.
export default function MessagesProvider({ children }: { children: ReactNode }) {
  const { reservations, rooms, guests } = useHotel()
  const { options, tenant, stayTimes, features } = useFeatures()
  const [messages, setMessages] = useState<GuestMessage[]>([])

  const settings = options.messaging ?? DEFAULT_MESSAGING
  const rates = options.rates

  const roomReady = useCallback(
    (number: string | null) => !!number && rooms.find((r) => r.number === number)?.status === 'clean',
    [rooms],
  )

  const detailsOf = useCallback(
    (r: Reservation) => {
      const f = folioOf(r)
      const nights = nightsBetween(r.arrival, r.departure)
      const nightly = nightlyRate(r.roomType, 0, rates)
      const guest = guests.find((g) => g.id === r.guestId)
      const phone = r.details?.phone ?? guest?.phone ?? ''
      return {
        phone,
        marketingConsent: r.details?.marketingConsent ?? guest?.marketingConsent,
        vars: {
          guest: r.guest,
          hotel: tenant.name,
          room: r.room ?? 'your room',
          arrival: dayMonth(r.arrival),
          departure: dayMonth(r.departure),
          nights: String(nights),
          balance: ugx(Math.max(0, f.total - f.paid)),
          deposit: ugx(depositFor(nightly, nights, rates)),
          time: r.status === 'in-house' ? stayTimes.checkOutTime : r.status === 'booked' && r.paid === 0 ? rates.releaseTime : stayTimes.checkInTime,
          link: preRegLink(window.location.origin, r.id, r.arrival),
          // The same word, {link}, means the form before arrival and the bill afterwards. A hotel
          // writing its own wording should not have to know which.
          billLink: billLink(window.location.origin, r.id, r.arrival),
          stay: portalLink(window.location.origin, r.id, r.arrival),
        } as MessageVars,
      }
    },
    [guests, rates, stayTimes, tenant.name],
  )

  /**
   * The stay's details, pointed at the right place for this message.
   *
   * {link} means the form before arrival and the bill afterwards, because a hotel writing its own
   * wording should not have to know which. This lives in one place because there are two paths that
   * write a message - the clock and a person - and a rule kept in only one of them drifts.
   */
  const varsFor = useCallback(
    (kind: MessageKind, vars: MessageVars): MessageVars =>
      (kind === 'how was it' || kind === 'bill sent') && vars.billLink ? { ...vars, link: vars.billLink } : vars,
    [],
  )

  const queue = useCallback(
    (input: QueueInput): GuestMessage | null => {
      const r = input.reservationId ? reservations.find((x) => x.id === input.reservationId) : undefined
      const d = r ? detailsOf(r) : undefined
      const to = input.to ?? d?.phone ?? ''
      const allowed = mayReceive(input.kind, to, input.to ? true : d?.marketingConsent)
      const template = templateFor(settings.templates, input.kind)
      // After the stay, {link} is the guest's own bill, which is where they say how it went.
      const vars: MessageVars = { hotel: tenant.name, ...varsFor(input.kind, d?.vars ?? {}), ...(input.vars ?? {}) }
      const body = input.body ?? fillTemplate(template?.text ?? '', vars)
      if (body.trim() === '') return null
      let created: GuestMessage | null = null
      setMessages((list) => {
        // Checked inside the update, against the list as it really is, so the same moment noticed twice
        // cannot write the same message twice.
        if (input.once && input.reservationId && writtenAlready(list, input.reservationId, input.kind)) return list
        created = {
          id: newMessageId(list),
          kind: input.kind,
          channel: settings.channel,
          to,
          guestName: input.guestName ?? r?.guest ?? '',
          body,
          at: stamp(),
          // A message nobody can receive is kept, not hidden: the desk should see that it could not go.
          status: allowed.ok ? (input.sendNow || settings.autoSend ? 'sent' : 'queued') : 'failed',
          sentAt: allowed.ok && (input.sendNow || settings.autoSend) ? stamp() : undefined,
          problem: allowed.why,
          reservationId: input.reservationId,
          by: input.sendNow ? input.by : undefined,
          auto: input.auto ?? false,
        }
        return [created, ...list]
      })
      return created
    },
    [detailsOf, reservations, settings, tenant.name, varsFor],
  )

  // What the rules say is due now. Written during render, the same way the day's cleaning is worked out,
  // so a booking made a second ago already has its confirmation waiting.
  const due = useMemo(() => {
    if (!features.guestMessages) return []
    return reservations.flatMap((r) => {
      const f = folioOf(r)
      const input: DueInput = {
        id: r.id,
        status: r.status,
        arrival: r.arrival,
        departure: r.departure,
        room: r.room,
        roomReady: roomReady(r.room),
        balance: Math.max(0, f.total - f.paid),
        unguaranteed: r.guarantee !== 'card' && r.guarantee !== 'company' && r.paid === 0,
      }
      return dueForStay(input, TODAY, settings, messages)
    })
  }, [features.guestMessages, messages, reservations, roomReady, settings])

  if (due.length > 0) {
    setMessages((list) => {
      const made: GuestMessage[] = []
      for (const d of due) {
        // Checked again against the list as it really is, so the same message cannot be written twice.
        if (writtenAlready([...list, ...made], d.reservationId, d.kind)) continue
        const r = reservations.find((x) => x.id === d.reservationId)
        if (!r) continue
        const details = detailsOf(r)
        const template = templateFor(settings.templates, d.kind)
        if (!template || !template.on) continue
        const allowed = mayReceive(d.kind, details.phone, details.marketingConsent)
        made.push({
          id: newMessageId([...list, ...made]),
          kind: d.kind,
          channel: settings.channel,
          to: details.phone,
          guestName: r.guest,
          body: fillTemplate(template.text, varsFor(d.kind, details.vars)),
          at: stamp(),
          status: allowed.ok ? (settings.autoSend ? 'sent' : 'queued') : 'failed',
          sentAt: allowed.ok && settings.autoSend ? stamp() : undefined,
          problem: allowed.why,
          reservationId: d.reservationId,
          auto: true,
        })
      }
      return made.length > 0 ? [...made, ...list] : list
    })
  }

  // Where a real provider is called. Everything above is the hotel's own record; this is the only line
  // that would reach WhatsApp or an SMS gateway, and in this prototype it does nothing.
  const send = useCallback((id: string, by: string) => {
    setMessages((list) => list.map((m) => (m.id === id && m.status === 'queued' ? { ...m, status: 'sent', sentAt: stamp(), by } : m)))
  }, [])

  const sendAll = useCallback(
    (by: string) => {
      const ready = messages.filter((m) => m.status === 'queued')
      setMessages((list) => list.map((m) => (m.status === 'queued' ? { ...m, status: 'sent', sentAt: stamp(), by } : m)))
      return ready.length
    },
    [messages],
  )

  const cancel = useCallback((id: string) => {
    setMessages((list) => list.map((m) => (m.id === id && m.status === 'queued' ? { ...m, status: 'cancelled' } : m)))
  }, [])

  const forStay = useCallback((reservationId: string) => messages.filter((m) => m.reservationId === reservationId), [messages])

  const outbox = useMemo(() => messages.filter((m) => m.status === 'queued'), [messages])

  const value = useMemo<MessagesValue>(
    () => ({ messages, outbox, queue, send, sendAll, cancel, forStay }),
    [messages, outbox, queue, send, sendAll, cancel, forStay],
  )
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export { KIND_LABEL }
