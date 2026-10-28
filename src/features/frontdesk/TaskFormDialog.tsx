import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { useHotel } from '../../lib/hotelContext'
import { assignableStaff } from '../../lib/tasks'
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../../services/tasks/taskTypes'
import type { TaskCategory, TaskPriority } from '../../services/tasks/taskTypes'
import { useFrontDesk } from './frontDeskContext'

// The next full hour, as "HH:00". A sensible default due time.
function nextHour() {
  const h = Math.min(23, new Date().getHours() + 1)
  return `${String(h).padStart(2, '0')}:00`
}

export default function TaskFormDialog({ onClose }: { onClose: () => void }) {
  const { reservations } = useHotel()
  const { createTask, now } = useFrontDesk()
  const staff = useMemo(() => assignableStaff(), [])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TaskCategory>('reservation-follow-up')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [date, setDate] = useState(TODAY)
  const [time, setTime] = useState(nextHour)
  const [assigneeId, setAssigneeId] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  // Only stays that are still live can be linked.
  const linkable = useMemo(
    () => reservations.filter((r) => r.status === 'booked' || r.status === 'in-house'),
    [reservations],
  )
  const due = Date.parse(`${date}T${time || '00:00'}`)
  const inPast = !Number.isNaN(due) && due < now

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!title.trim()) found.title = 'Give the task a short title.'
    if (!date || !time || Number.isNaN(due)) found.due = 'Choose a due date and time.'
    const ref = reservationId.trim().toUpperCase()
    if (ref && !linkable.some((r) => r.id === ref)) found.reservation = 'No booked or in-house reservation has this number.'
    setErrors(found)
    if (Object.keys(found).length) return

    const assignee = staff.find((s) => s.id === assigneeId)
    setSaving(true)
    setFailed(null)
    try {
      await createTask({
        title,
        description,
        category,
        priority,
        dueAt: new Date(due).toISOString(),
        assignee,
        reservationId: ref || undefined,
      })
      onClose()
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'The task could not be saved.')
      setSaving(false)
    }
  }

  return (
    <Modal
      title="New task"
      description="Kept in this tab only. Lost on reload."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" disabled={saving}>
            {saving ? 'Saving…' : 'Add task'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" required error={errors.title}>
          {(id) => (
            <Input
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Confirm company booking for Friday"
              maxLength={120}
              autoFocus
            />
          )}
        </Field>

        <Field label="Details" hint="Who to call, what to prepare, anything the next shift should know.">
          {(id) => <Textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date" required error={errors.due}>
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Due time" required hint={inPast ? 'This time has passed. The task will show as overdue.' : undefined}>
            {(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assign to">
            {(id) => (
              <Select id={id} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Not assigned</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reservation" hint="Optional, such as R-1042." error={errors.reservation}>
            {(id) => (
              <>
                <Input
                  id={id}
                  list="task-reservations"
                  value={reservationId}
                  onChange={(e) => setReservationId(e.target.value)}
                  placeholder="R-…"
                />
                <datalist id="task-reservations">
                  {linkable.slice(0, 200).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.guest}
                    </option>
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>

        {failed && <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{failed}</p>}
      </form>
    </Modal>
  )
}
