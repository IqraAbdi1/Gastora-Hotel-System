import { createContext, useContext } from 'react'
import type { GuestMessage, MessageKind, MessageVars } from '../../lib/messages'

export interface QueueInput {
  kind: MessageKind
  reservationId?: string
  /** Overrides the stay's own details, for a message that is not about a booking. */
  to?: string
  guestName?: string
  vars?: MessageVars
  /** Written by a person instead of taken from the hotel's wording. */
  body?: string
  auto?: boolean
  /** Send it as it is written, rather than leaving it in the outbox. */
  sendNow?: boolean
  /** Who is sending it, when it goes straight out. */
  by?: string
}

export interface MessagesValue {
  messages: GuestMessage[]
  /** Everything written and waiting for somebody to press send. */
  outbox: GuestMessage[]
  /** Write one now. Returns null when the guest cannot or may not be sent it. */
  queue: (input: QueueInput) => GuestMessage | null
  send: (id: string, by: string) => void
  sendAll: (by: string) => number
  cancel: (id: string) => void
  /** Everything ever written about one stay, newest first. */
  forStay: (reservationId: string) => GuestMessage[]
}

export const MessagesContext = createContext<MessagesValue | null>(null)

export function useMessages(): MessagesValue {
  const v = useContext(MessagesContext)
  if (!v) throw new Error('useMessages must be used inside MessagesProvider')
  return v
}
