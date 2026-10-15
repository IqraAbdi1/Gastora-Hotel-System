import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Input } from '../../components/ui'
import { useHousekeeping } from '../housekeeping/hkContext'
import { estimateReady } from '../housekeeping/hkModel'
import type { HkRoom } from '../housekeeping/hkModel'

// Talk to housekeeping about one room: what was said so far, and a box to send another message.
function RoomMessages({ room }: { room: string }) {
  const { threadOf, sendMessage } = useHousekeeping()
  const [text, setText] = useState('')
  const thread = threadOf(room)
  const recent = thread.messages.slice(-4)

  function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    sendMessage(room, 'Front desk', text.trim())
    setText('')
  }

  return (
    <div className="mt-2 space-y-2 border-t border-ink/10 pt-2">
      {recent.length > 0 && (
        <ul className="space-y-1.5">
          {recent.map((m) => (
            <li
              key={m.id}
              className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                m.from === 'Front desk' ? 'ml-auto bg-brand/10 text-ink' : 'bg-accent/15 text-ink'
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink/50">
                {m.from} · {m.time}
              </span>
              {m.text}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="flex gap-2">
        <Input
          aria-label={`Message housekeeping about room ${room}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message housekeeping…"
          className="py-1.5 text-xs"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!text.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}

function RoomRow({ x, note, onRushed }: { x: HkRoom; note: string; onRushed: () => void }) {
  const { rushRoom } = useHousekeeping()
  return (
    <div className="rounded-lg bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Room {x.room}</p>
          <p className="text-xs text-ink/60">
            {x.status === 'Being Cleaned' ? 'Being cleaned' : 'Dirty'}
            {x.attendant !== 'Unassigned' ? ` · ${x.attendant}` : ' · not assigned yet'}
          </p>
          {!x.readyBy && <p className="text-xs text-ink/60">Estimate: ready about {estimateReady(x)}</p>}
        </div>
        {x.rushed ? (
          <p className="text-right text-xs font-semibold text-good">
            Rush sent
            <span className="block font-normal text-ink/60">{x.readyBy ? `Ready by ${x.readyBy}` : 'Waiting for housekeeping'}</span>
          </p>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              rushRoom(x.room, note)
              onRushed()
            }}
          >
            Rush this room
          </Button>
        )}
      </div>
      {x.rushed && <RoomMessages room={x.room} />}
    </div>
  )
}

// When no clean room is ready, the front desk can ask housekeeping to hurry one and keep talking
// to them about it. Used at check-in and on the Today page's "Needs attention" list.
// With `room`, only that room is offered (the guest already has it); otherwise any room of the type.
export default function AskHousekeeping({ roomType, room }: { roomType: string; room?: string }) {
  const { rooms } = useHousekeeping()
  const [note, setNote] = useState('')

  const waiting = rooms
    .filter((x) => (room ? x.room === room : x.type === roomType) && (x.status === 'Dirty' || x.status === 'Being Cleaned'))
    .sort((a, b) => Number(b.rushed ?? false) - Number(a.rushed ?? false) || Number(a.room) - Number(b.room))
  const shown = waiting.slice(0, 3)

  if (waiting.length === 0) {
    return (
      <p className="rounded-lg border border-ink/10 bg-canvas p-3 text-sm text-ink/70">
        {room
          ? `Room ${room} is not waiting to be cleaned. It may be occupied or out of service. Choose another room at check-in.`
          : `No ${roomType} room is waiting to be cleaned. The others may be occupied or out of service, so there is nothing to rush.`}
      </p>
    )
  }

  const anyToRush = shown.some((x) => !x.rushed)

  return (
    <div className="space-y-3 rounded-lg border border-ink/10 bg-canvas p-3">
      <div>
        <p className="text-sm font-semibold">Ask housekeeping</p>
        <p className="text-xs text-ink/60">
          A rushed room goes to the top of housekeeping's list. Once it is rushed you can message them about it here.
        </p>
      </div>

      {anyToRush && (
        <label className="block text-xs font-medium text-ink/70">
          Note to send with the rush (optional)
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: guest is waiting in the lobby"
            className="mt-1"
          />
        </label>
      )}

      <div className="space-y-2">
        {shown.map((x) => (
          <RoomRow key={x.room} x={x} note={note} onRushed={() => setNote('')} />
        ))}
        {waiting.length > shown.length && (
          <p className="text-xs text-ink/60">And {waiting.length - shown.length} more {roomType} room(s) waiting.</p>
        )}
      </div>
    </div>
  )
}
