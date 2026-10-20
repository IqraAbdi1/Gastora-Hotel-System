import { useState } from 'react'
import { Button, EmptyState, Icon, Modal } from '../../components/ui'
import type { Attention } from '../../lib/frontdesk'
import ArrivalRoomHelp from './ArrivalRoomHelp'

const groups = [
  { severity: 'bad' as const, label: 'Urgent', dot: 'bg-bad', text: 'text-bad' },
  { severity: 'warn' as const, label: 'To check', dot: 'bg-warn', text: 'text-warn' },
]

const keyOf = (a: Attention) => `${a.kind}-${a.reservation.id}`

// Everything on today's "Needs attention" list, grouped by how urgent it is.
// Room problems can be sorted out here: rush a room and message housekeeping without leaving the desk.
export default function AttentionPanel({
  items,
  onOpen,
  onClose,
}: {
  items: Attention[]
  onOpen: (reservationId: string) => void
  onClose: () => void
}) {
  // The first room problem starts open, since asking housekeeping is the usual next step.
  const [askOpen, setAskOpen] = useState<string | null>(() => {
    const first = items.find((a) => a.kind === 'no-ready-room')
    return first ? keyOf(first) : null
  })

  return (
    <Modal side title="Needs attention" description="Reservations to sort out today." onClose={onClose}>
      {items.length === 0 ? (
        <div className="flex flex-col items-center">
          <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-good/10 text-good">
            <Icon name="check" className="h-6 w-6" />
          </span>
          <EmptyState title="All clear" hint="Nothing needs attention." />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const list = items.filter((a) => a.severity === g.severity)
            if (list.length === 0) return null
            return (
              <section key={g.severity}>
                <h3 className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${g.text}`}>
                  <span className={`h-2 w-2 rounded-full ${g.dot}`} aria-hidden="true" />
                  {g.label} · {list.length}
                </h3>
                <ul className="space-y-2">
                  {list.map((a) => {
                    const key = keyOf(a)
                    const r = a.reservation
                    const roomProblem = a.kind === 'no-ready-room'
                    const asking = askOpen === key
                    return (
                      <li key={key} className="rounded-lg border border-ink/10 bg-surface px-3 py-2.5">
                        <p className="text-sm font-semibold text-ink">{a.title}</p>
                        <p className="text-xs font-medium text-ink/70">
                          {r.guest} · {r.id} · {r.roomType}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/60">{a.detail}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {roomProblem && (
                            <Button size="sm" variant={asking ? 'ghost' : 'primary'} onClick={() => setAskOpen(asking ? null : key)}>
                              {asking ? 'Hide' : 'Ask housekeeping'}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => onOpen(r.id)}>
                            Open reservation
                          </Button>
                        </div>
                        {roomProblem && asking && (
                          <div className="mt-3">
                            <ArrivalRoomHelp reservation={r} force />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
