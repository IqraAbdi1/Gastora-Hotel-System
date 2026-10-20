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
    <section className="space-y-4 rounded-xl border border-ink/10 bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Room {room.room}</h3>
          <p className="text-sm text-ink/60">
            {room.type} · {room.status}
            {room.attendant !== 'Unassigned' ? ` · ${room.attendant}` : ' · not assigned yet'}
          </p>
        </div>
        {room.readyBy ? (
          <span className="rounded-full bg-good/10 px-3 py-1 text-xs font-semibold text-good">Ready by {room.readyBy}</span>
        ) : (
          <span className="rounded-full bg-bad/10 px-3 py-1 text-xs font-semibold text-bad">Needs your reply</span>
        )}
      </div>

      <ul className="space-y-2">
        {thread.messages.map((m) => (
          <li key={m.id} className={`rounded-lg p-3 text-sm ${m.from === 'Front desk' ? 'bg-accent/15' : 'bg-surface'}`}>
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
              className="rounded-lg border border-ink/15 bg-surface px-3 py-1.5 text-sm font-semibold hover:border-brand"
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
          placeholder="Reply to the front desk"
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

// The front desk requests button and the drawer it opens. It sits in the top bar of every
// housekeeping page. The button turns red when the front desk is waiting for an answer.
export function HousekeepingRequests() {
  const { rooms, counts } = useHousekeeping()
  const [open, setOpen] = useState(false)

  const requests = rooms
    .filter((r) => r.rushed)
    .sort((a, b) => Number(!!a.readyBy) - Number(!!b.readyBy) || Number(a.room) - Number(b.room))
  const waiting = counts.requests

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          waiting > 0
            ? 'flex items-center gap-2 rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-white'
            : 'rounded-lg border border-ink/15 bg-surface px-4 py-2 text-sm font-semibold text-ink/70 hover:border-brand'
        }
      >
        {waiting > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
        {waiting > 0
          ? `${waiting} front desk request${waiting === 1 ? '' : 's'}`
          : requests.length > 0
            ? `Front desk requests (${requests.length} answered)`
            : 'Front desk requests'}
      </button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-ink/10 bg-surface shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4">
            <div>
              <h2 className="text-lg font-semibold">Front desk requests</h2>
              <p className="text-sm text-ink/60">Rooms the front desk needs first.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-brand">
              Close
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {requests.length === 0 ? (
              <p className="text-sm text-ink/60">
                Nothing right now. When a guest is waiting for a room, the front desk can rush one from the check-in screen
                and it shows up here.
              </p>
            ) : (
              requests.map((r) => <RequestCard key={r.room} room={r} />)
            )}
          </div>
        </div>
      )}
    </>
  )
}

// The older slim bar: a label and the requests button. The app shell now puts the button in its own top bar.
export default function HousekeepingBar() {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink/10 bg-surface px-4 py-2 md:px-6">
      <p className="text-sm font-semibold text-ink/60">Housekeeping</p>
      <HousekeepingRequests />
    </div>
  )
}
