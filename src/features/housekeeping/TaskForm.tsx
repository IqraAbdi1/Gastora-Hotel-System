import { useMemo, useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { useHotel } from '../../lib/hotelContext'
import { useHousekeeping } from './hkContext'
import { CHECKIN_TIME, PUBLIC_AREA, attendants, taskTypes } from './hkModel'
import type { Priority, TaskType } from './hkModel'

/**
 * Work the hotel raises by hand. Dirty rooms, the daily service and the public areas on the schedule
 * all appear by themselves; this is for everything else, including an extra clean of an area.
 */
export default function TaskForm({ presetRoom = '', onClose }: { presetRoom?: string; onClose: () => void }) {
  const { rooms } = useHotel()
  const hk = useHousekeeping()
  const [room, setRoom] = useState(presetRoom)
  const [type, setType] = useState<TaskType>('Stay Over')
  const [areaId, setAreaId] = useState(hk.areas[0]?.id ?? '')
  const [priority, setPriority] = useState<Priority>('Normal')
  const [attendant, setAttendant] = useState('Unassigned')
  const [dueTime, setDueTime] = useState(CHECKIN_TIME)
  const [notes, setNotes] = useState('')

  const isArea = type === PUBLIC_AREA
  // Type the room number instead of scrolling a list of every room.
  const byNumber = useMemo(() => new Map(rooms.map((r) => [r.number, r])), [rooms])
  const match = byNumber.get(room.trim())
  const area = hk.areas.find((a) => a.id === areaId)
  const ready = isArea ? !!area : !!match

  function save() {
    if (isArea) {
      if (!area) return
      hk.createTask({ room: area.name, area: area.id, zone: area.where, type, priority, attendant, dueTime, notes })
    } else {
      if (!match) return
      hk.createTask({ room: match.number, type, priority, attendant, dueTime, notes })
    }
    onClose()
  }

  return (
    <Modal
      title="New task"
      description="For work not created automatically."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!ready}>
            Create task
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Task type">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as TaskType)}>
              {taskTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>

        {isArea ? (
          <Field label="Which area" hint={area ? area.where : 'No public areas are set up yet'}>
            {(id) => (
              <Select id={id} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {hk.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field
            label="Room number"
            hint={match ? `${match.type} room` : room ? 'No room with that number' : 'Type the room number'}
          >
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. 102"
                autoFocus
              />
            )}
          </Field>
        )}

        <Field label="Priority">
          {(id) => (
            <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option>Urgent</option>
              <option>High</option>
              <option>Normal</option>
            </Select>
          )}
        </Field>

        <Field label="Assign to">
          {(id) => (
            <Select id={id} value={attendant} onChange={(e) => setAttendant(e.target.value)}>
              {attendants.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Due time">
          {(id) => <Input id={id} type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />}
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes">
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instructions for the attendant"
              />
            )}
          </Field>
        </div>
      </div>
    </Modal>
  )
}
