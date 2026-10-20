import { useState } from 'react'
import { useHousekeeping } from './hkContext'
import { inMinutes } from './hkModel'
import type { HkRoom } from './hkModel'

const quick = [
  ['15 min', 15],
  ['30 min', 30],
  ['1 hour', 60],
] as const

const field = 'min-w-0 flex-1 rounded-lg border border-ink/15 bg-canvas px-3 py-2 text-sm outline-none focus:border-brand'

function RequestCard({ room }: { room: HkRoom }) {
  const { threadOf, setReadyBy, sendMessage, advanceRoom } = useHousekeeping()
  const [text, setText] = useState('')
  const thread = threadOf(room.room)

  function send() {
    sendMessage(room.room, 'Housekeeping', text)
    setText('')
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Room {room.room}</h2>
          <p className="text-sm text-ink/60">
            {room.type} · {room.status}
            {room.attendant !== 'Unassigned' ? ` · ${room.attendant}` : ' · not assigned yet'}
          </p>
        </div>
        {room.readyBy ? (
          <span className="rounded-full bg-good/10 px-3 py-1 text-xs font-semibold text-good">Ready by {room.readyBy}</span>
        ) : (
          <span className="rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">Waiting for your reply</span>
        )}
      </div>

      <ul className="space-y-2">
        {thread.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg p-3 text-sm ${m.from === 'Front desk' ? 'bg-accent/15' : 'bg-canvas'}`}
          >
            <span className="font-semibold">{m.from}</span> <span className="text-xs text-ink/50">{m.time}</span>
            <p>{m.text}</p>
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Tell the front desk when it will be ready</p>
        <div className="flex flex-wrap gap-2">
          {quick.map(([label, minutes]) => (
            <button
              key={label}
              type="button"
              onClick={() => setReadyBy(room.room, inMinutes(minutes))}
              className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-semibold hover:border-brand"
            >
              Ready in {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => advanceRoom(room)}
            className="ml-auto rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
          >
            {room.status === 'Dirty' ? 'Start cleaning' : 'Mark as cleaned'}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Write a reply to the front desk"
          className={field}
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </section>
  )
}

// The front desk asks, housekeeping answers. Each rush request is one card.
export default function RequestsPage() {
  const { rooms } = useHousekeeping()
  const open = rooms
    .filter((r) => r.rushed)
    .sort((a, b) => Number(!!a.readyBy) - Number(!!b.readyBy) || Number(a.room) - Number(b.room))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Requests</h1>
        <p className="text-sm text-ink/60">Rooms the front desk needs first.</p>
      </div>

      {open.length === 0 ? (
        <p className="rounded-xl border border-ink/10 bg-surface p-6 text-sm text-ink/60">
          No requests from the front desk right now.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {open.map((r) => (
            <RequestCard key={r.room} room={r} />
          ))}
        </div>
      )}
    </div>
  )
}