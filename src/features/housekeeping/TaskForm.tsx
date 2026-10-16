import { useMemo, useState } from 'react'
import { useHotel } from '../../lib/hotelContext'
import { useHousekeeping } from './hkContext'
import { CHECKIN_TIME, attendants, taskTypes } from './hkModel'
import { PUBLIC_AREA } from './hkModel'
import type { Priority, TaskType } from './hkModel'
import { Modal, btnGhost, btnPrimary, field } from './hkUi'

export default function TaskForm({ presetRoom = '', onClose }: { presetRoom?: string; onClose: () => void }) {
  const { rooms } = useHotel()
  const hk = useHousekeeping()
  const [room, setRoom] = useState(presetRoom)
  const [type, setType] = useState<TaskType>('Stay Over')
  const [priority, setPriority] = useState<Priority>('Normal')
  const [attendant, setAttendant] = useState('Unassigned')
  const [dueTime, setDueTime] = useState(CHECKIN_TIME)
  const [notes, setNotes] = useState('')

  // Type the room number instead of scrolling a list of every room.
  const byNumber = useMemo(() => new Map(rooms.map((r) => [r.number, r])), [rooms])
  const match = byNumber.get(room.trim())

  function save() {
    if (!match) return
    hk.createTask({ room: match.number, type, priority, attendant, dueTime, notes })
    onClose()
  }

  return (
    <Modal onClose={onClose} label="Create housekeeping task">
      <div className="w-full max-w-xl rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink/10 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Housekeeping</p>
            <h2 className="text-xl font-bold">New task</h2>
            <p className="text-sm text-ink/60">Dirty rooms get a task automatically. Use this for anything else.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-xl text-ink/50 hover:bg-canvas">×</button>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label htmlFor="task-room" className="mb-1 block text-sm font-medium">Room number</label>
            <input id="task-room" inputMode="numeric" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. 102" className={field} autoFocus />
            <p className={`mt-1 text-xs ${match ? 'text-good' : 'text-ink/50'}`}>
              {match ? `${match.type} room` : room ? 'No room with that number' : 'Type the room number'}
            </p>
          </div>
          <div>
            <label htmlFor="task-type" className="mb-1 block text-sm font-medium">Task type</label>
            <select id="task-type" value={type} onChange={(e) => setType(e.target.value as TaskType)} className={field}>
              {taskTypes
                .filter((t) => t !== PUBLIC_AREA)
                .map((t) => (
                  <option key={t}>{t}</option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-priority" className="mb-1 block text-sm font-medium">Priority</label>
            <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={field}>
              <option>Urgent</option>
              <option>High</option>
              <option>Normal</option>
            </select>
          </div>
          <div>
            <label htmlFor="task-attendant" className="mb-1 block text-sm font-medium">Assign to</label>
            <select id="task-attendant" value={attendant} onChange={(e) => setAttendant(e.target.value)} className={field}>
              {attendants.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-due" className="mb-1 block text-sm font-medium">Due time</label>
            <input id="task-due" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="task-notes" className="mb-1 block text-sm font-medium">Notes</label>
            <textarea id="task-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instructions for the attendant..." className={`${field} resize-none`} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink/10 px-6 py-4">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="button" onClick={save} disabled={!match} className={btnPrimary}>Create task</button>
        </div>
      </div>
    </Modal>
  )
}