import { useEffect, useRef, useState } from 'react'
import { stamp } from '../../lib/folio'
import { automationService } from '../../services'
import type { Reservation } from '../../types'
import { useFeatures } from '../platform/featuresContext'
import { newRequestId, useGuestRequests } from '../portal/useGuestRequests'
import { useAutomationData } from './useAutomation'

const QUICK = ['Wi-Fi password', 'Breakfast hours', 'Check-out time', 'Airport transfer', 'Spa']

/**
 * The concierge on the guest's own stay page. It answers from the hotel's knowledge base, turns a
 * request into a guest request for the desk, and hands anything else to a person.
 */
export default function ConciergeWidget({ stay }: { stay: Reservation }) {
  const { tenant, features, stayTimes } = useFeatures()
  const { requests, add } = useGuestRequests()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLLIElement>(null)
  const pid = tenant.id

  const { data: conversation } = useAutomationData(() => automationService.conversationFor(pid, stay.id), null, [pid, stay.id])
  const convId = conversation?.id
  const { data: messages } = useAutomationData(() => (convId ? automationService.listMessages(convId) : Promise.resolve([])), [], [convId])

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'end' })
  }, [open, messages.length])

  if (!features.aiConcierge || stay.status === 'checked-out' || stay.status === 'cancelled') return null

  async function send(q: string) {
    const question = q.trim()
    if (!question || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await automationService.ask(
        pid,
        { reservationId: stay.id, guestId: stay.guestId, guestName: stay.guest, room: stay.room ?? undefined, text: question },
        { hotelName: tenant.name, checkInTime: stayTimes.checkInTime, checkOutTime: stayTimes.checkOutTime, lateFreeUntil: stayTimes.lateFreeUntil },
      )
      if (result.request) {
        const id = newRequestId(requests)
        add({
          id,
          at: stamp(),
          reservationId: stay.id,
          guestId: stay.guestId,
          guestName: stay.guest,
          room: stay.room ?? undefined,
          kind: 'ask',
          title: result.request.title,
          detail: `${result.request.title}: ${result.request.detail}`,
          state: 'new',
        })
        await automationService.linkRequest(result.reply.id, id)
      }
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand/90"
        >
          Ask us anything
        </button>
      )}
      {open && (
        <section
          aria-label="Ask the hotel"
          className="fixed inset-x-3 bottom-3 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96"
        >
          <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">{tenant.name}</p>
              <p className="text-xs text-white/75">Answers straight away. Staff reply here too.</p>
            </div>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-lg leading-none hover:bg-white/15">
              ×
            </button>
          </header>
          <ul className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <li className="rounded-xl bg-canvas px-3 py-2 text-sm text-ink/75">Hello {stay.guest.split(' ')[0]}. Ask about Wi-Fi, breakfast, check-out, transfers or the spa, or tell us what you need.</li>
            )}
            {messages.map((m) => (
              <li key={m.id} className={`flex ${m.sender === 'guest' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.sender === 'guest' ? 'bg-brand text-white' : 'bg-canvas text-ink'}`}>
                  {m.sender === 'staff' && <p className="text-[11px] font-semibold text-ink/55">{m.staffName}</p>}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {m.sender === 'assistant' && m.intent === 'request' && <p className="mt-1 text-[11px] font-semibold text-good">Sent to the desk</p>}
                  {m.sender === 'assistant' && m.intent === 'escalate' && <p className="mt-1 text-[11px] font-semibold text-warn">A person will reply</p>}
                </div>
              </li>
            ))}
            <li ref={end} />
          </ul>
          <div className="border-t border-ink/10 px-3 py-2">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(q)}
                  className="shrink-0 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/75 hover:border-brand/40 hover:text-ink"
                >
                  {q}
                </button>
              ))}
            </div>
            {error && <p className="mb-1 text-xs font-medium text-bad">{error}</p>}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void send(text)
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                placeholder="Type a question or a request"
                aria-label="Your message"
                className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button type="submit" disabled={busy || !text.trim()} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Send
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  )
}
