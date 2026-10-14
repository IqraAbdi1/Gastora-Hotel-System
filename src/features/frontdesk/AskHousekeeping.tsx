import { useState } from 'react'
import { useHousekeeping } from '../housekeeping/hkContext'
import { estimateReady } from '../housekeeping/hkModel'

const field = 'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

// Shown at check-in when no clean room of the type is free: the front desk can ask housekeeping to hurry one.
export default function AskHousekeeping({ roomType }: { roomType: string }) {
  const { rooms, rushRoom } = useHousekeeping()
  const [note, setNote] = useState('')

  const waiting = rooms
    .filter((x) => x.type === roomType && (x.status === 'Dirty' || x.status === 'Being Cleaned'))
    .sort((a, b) => Number(a.room) - Number(b.room))
  const shown = waiting.slice(0, 3)

  if (waiting.length === 0) {
    return (
      <p className="rounded-lg border border-ink/10 bg-canvas p-3 text-sm text-ink/70">
        No {roomType} room is waiting to be cleaned. The others may be occupied or out of service. Housekeeping shows these
        under Issues.
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-ink/10 bg-canvas p-3">
      <div>
        <p className="text-sm font-semibold">Ask housekeeping</p>
        <p className="text-xs text-ink/60">
          The room you choose goes to the top of their list. It appears in the room list above as soon as it is clean.
        </p>
      </div>

      <label className="block text-xs font-medium text-ink/70">
        Note for housekeeping (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="For example: guest is waiting in the lobby"
          className={`${field} mt-1`}
        />
      </label>

      <div className="space-y-2">
        {shown.map((x) => (
          <div key={x.room} className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3">
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
                <span className="block font-normal text-ink/60">
                  {x.readyBy ? `Ready by ${x.readyBy}` : 'Waiting for housekeeping'}
                </span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  rushRoom(x.room, note)
                  setNote('')
                }}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white"
              >
                Rush this room
              </button>
            )}
          </div>
        ))}
        {waiting.length > shown.length && (
          <p className="text-xs text-ink/60">And {waiting.length - shown.length} more {roomType} room(s) waiting.</p>
        )}
      </div>
    </div>
  )
}