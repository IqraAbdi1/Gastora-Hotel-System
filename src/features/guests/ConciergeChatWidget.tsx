
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

type ChatMessage = {
  id: number
  role: 'assistant' | 'guest'
  text: string
}

const suggestions = [
  'What rooms are available?',
  'What facilities do you offer?',
  'How do I manage my booking?',
]

function mockReply(message: string): string {
  const value = message.toLowerCase()

  if (
    value.includes('room') ||
    value.includes('available') ||
    value.includes('book')
  ) {
    return 'I can help you get started. Choose your dates in our booking search to explore available rooms and review the details before confirming.'
  }

  if (
    value.includes('facility') ||
    value.includes('facilities') ||
    value.includes('pool') ||
    value.includes('gym') ||
    value.includes('breakfast') ||
    value.includes('dining')
  ) {
    return 'Gastora highlights include dining, breakfast, leisure and fitness spaces. Availability and service details can be confirmed by the hotel team.'
  }

  if (
    value.includes('stay') ||
    value.includes('reservation') ||
    value.includes('booking') ||
    value.includes('bill')
  ) {
    return 'If you already have a reservation, use “My Stay” on the website to open your guest portal with your stay access token.'
  }

  if (
    value.includes('human') ||
    value.includes('staff') ||
    value.includes('person') ||
    value.includes('agent') ||
    value.includes('hotel team')
  ) {
    return 'I’ve prepared a request for the hotel team. Live messaging will be available once Gastora’s staff-support service is connected. For now, you can leave this chat open or continue exploring the site.'
  }

  return 'Thanks for your message. I’m using a demo assistant for now, so I may not know every hotel detail yet. Try asking about rooms, facilities or your booking—or choose “Talk to the hotel team”.'
}

export default function ConciergeChatWidget() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [handoff, setHandoff] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Welcome to Gastora. I’m here to help you plan a comfortable stay. What can I help you with?',
    },
  ])

  const [pendingReply, setPendingReply] = useState('')
  const [typing, setTyping] = useState(false)

  const nextId = useRef(2)
  const endRef = useRef<HTMLDivElement | null>(null)

  // Schedule the simulated assistant response.
  // State changes are handled by the message actions, not synchronously here.
  useEffect(() => {
    if (!pendingReply) return

    const reply = pendingReply

    const timeout = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: 'assistant',
          text: reply,
        },
      ])

      setPendingReply('')
      setTyping(false)
    }, 550)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [pendingReply])

  // Keep the newest message visible.
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages, typing, open])

  function sendMessage(text: string) {
    const trimmed = text.trim()

    if (!trimmed || typing) return

    const reply = mockReply(trimmed)

    setMessages((current) => [
      ...current,
      {
        id: nextId.current++,
        role: 'guest',
        text: trimmed,
      },
    ])

    setDraft('')
    setHandoff(false)
    setTyping(true)
    setPendingReply(reply)
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    sendMessage(draft)
  }

  function requestHumanSupport() {
    if (typing) return

    setHandoff(true)

    setMessages((current) => [
      ...current,
      {
        id: nextId.current++,
        role: 'guest',
        text: 'Talk to the hotel team',
      },
    ])

    setTyping(true)
    setPendingReply(mockReply('talk to a human'))
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {open && (
        <section
          aria-label="Gastora guest assistant"
          aria-busy={typing}
          className="flex h-[min(620px,calc(100dvh-115px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(16,39,31,0.25)]"
        >
          <header className="relative overflow-hidden bg-[#193b30] px-5 pb-5 pt-5 text-white">
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-white/10"
            />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d9bd87] text-lg font-bold text-[#193b30]">
                  G
                </div>

                <div>
                  <p className="font-semibold tracking-wide">
                    Gastora Concierge
                  </p>

                  <p className="mt-1 flex items-center gap-2 text-xs text-white/70">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Guest assistance · Demo mode
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="relative mt-4 text-sm leading-6 text-white/80">
              A little help with your stay, whenever you need it.
            </p>
          </header>

          <div className="flex items-center gap-2 border-b border-stone-100 bg-[#faf9f6] px-4 py-3">
            <span className="text-xs font-medium text-stone-500">
              Quick questions
            </span>

            <span className="h-1 w-1 rounded-full bg-stone-300" />

            <span className="text-xs text-stone-500">
              Usually replies instantly
            </span>
          </div>

          <div
            className="flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4"
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'guest'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#193b30] text-xs font-semibold text-[#e4c997]">
                    G
                  </div>
                )}

                <div
                  className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'guest'
                      ? 'rounded-br-md bg-[#193b30] text-white'
                      : 'rounded-bl-md bg-[#f4f2ec] text-[#34443b]'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {typing && (
              <div
                className="flex items-center gap-2 text-xs text-stone-500"
                role="status"
                aria-label="Gastora is replying"
              >
                <span className="flex gap-1 rounded-full bg-stone-100 px-3 py-2">
                  <span className="animate-bounce">•</span>
                  <span className="animate-bounce [animation-delay:120ms]">
                    •
                  </span>
                  <span className="animate-bounce [animation-delay:240ms]">
                    •
                  </span>
                </span>

                Gastora is replying
              </div>
            )}

            {handoff && !typing && (
              <p className="rounded-xl border border-[#e9e1ce] bg-[#faf7ef] px-3 py-2 text-xs leading-5 text-stone-600">
                Staff handoff is a preview. Live agent messaging will be
                connected with the backend.
              </p>
            )}

            <div ref={endRef} />
          </div>

          {messages.length < 3 && (
            <div className="flex flex-wrap gap-2 border-t border-stone-100 px-4 py-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={typing}
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-stone-200 px-3 py-2 text-left text-xs text-[#34443b] transition hover:border-[#193b30] hover:bg-[#f7f7f2] disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-stone-100 bg-white p-3">
            <button
              type="button"
              onClick={requestHumanSupport}
              disabled={typing}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#dcd6c8] px-3 py-2.5 text-xs font-semibold text-[#193b30] transition hover:bg-[#faf9f6] disabled:opacity-50"
            >
              <span aria-hidden="true">♧</span>
              Talk to the hotel team
            </button>

            <form
              onSubmit={submitMessage}
              className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-[#faf9f6] p-1.5 focus-within:border-[#193b30] focus-within:ring-2 focus-within:ring-[#193b30]/10"
            >
              <label
                className="sr-only"
                htmlFor="gastora-chat-message"
              >
                Your message
              </label>

              <input
                id="gastora-chat-message"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message..."
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-stone-400"
                maxLength={1000}
                autoComplete="off"
              />

              <button
                type="submit"
                disabled={!draft.trim() || typing}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#193b30] text-lg text-white transition hover:bg-[#285242] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ↑
              </button>
            </form>

            <p className="mt-2 text-center text-[10px] text-stone-400">
              Demo assistant · Answers are simulated
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close Gastora chat' : 'Chat with Gastora'}
        aria-controls="gastora-chat-panel"
        className="group flex items-center gap-3 rounded-full bg-[#193b30] py-2.5 pl-4 pr-3 text-white shadow-[0_12px_35px_rgba(25,59,48,0.32)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#285242] focus:outline-none focus:ring-4 focus:ring-[#d9bd87]/60"
      >
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold">
            {open ? 'Chat is open' : 'Need a hand?'}
          </span>

          <span className="block text-[11px] text-white/65">
            Gastora Concierge
          </span>
        </span>

        <span
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d9bd87] text-xl text-[#193b30]"
          aria-hidden="true"
        >
          {open ? '×' : '✦'}
        </span>
      </button>
    </div>
  )
}
