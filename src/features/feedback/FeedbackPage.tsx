import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Chip, Field, Input, Modal, PageHeader, Select, StatCard, Textarea } from '../../components/ui'
import { ABOUT, averageRating, byRoom, hoursSince, KIND_LABEL, KIND_TONE, lateOnes, LATE_AFTER, newFeedbackId, openOnes, STATE_TONE } from '../../lib/feedback'
import type { About, Feedback, FeedbackKind } from '../../lib/feedback'
import { stamp } from '../../lib/folio'
import { ugx } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import { useAuth } from '../auth/authContext'
import { useFeedback } from './useFeedback'

type View = 'open' | 'all' | 'late'

/**
 * What guests said, and what was done about it.
 *
 * Complaints sit at the top until somebody closes them, because service recovery is almost entirely
 * about speed: a guest whose problem was fixed badly but quickly forgives more than one whose problem
 * was fixed well a week later.
 */
export default function FeedbackPage() {
  const { feedback, add, update } = useFeedback()
  const { reservations } = useHotel()
  const { user } = useAuth()
  const [view, setView] = useState<View>('open')
  const [logging, setLogging] = useState(false)
  const [resolving, setResolving] = useState<Feedback | null>(null)

  const now = new Date()
  const late = lateOnes(feedback, now)
  const open = openOnes(feedback)
  const rooms = useMemo(() => byRoom(feedback).filter((r) => r.complaints > 1), [feedback])
  const rating = averageRating(feedback)

  const shown = view === 'open' ? open : view === 'late' ? late : feedback

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Guest feedback"
        description="Complaints, compliments and what was done."
        actions={<Button onClick={() => setLogging(true)}>Write one down</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Still open" icon="alert" value={String(open.length)} hint="Waiting to be put right" tone={open.length > 0 ? 'warn' : 'good'} />
        <StatCard label="Late" icon="alert" value={String(late.length)} hint={`Open more than ${LATE_AFTER} hours`} tone={late.length > 0 ? 'bad' : 'good'} />
        <StatCard label="Altogether" icon="list" value={String(feedback.length)} hint="Everything guests said" />
        <StatCard label="Out of five" icon="occupancy" value={rating === undefined ? '—' : String(rating)} hint="Where guests rated the stay" />
      </div>

      {rooms.length > 0 && (
        <Card title="Rooms worth looking at" icon="bed" padded description="More than one complaint about the same room.">
          <ul className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <li key={r.room} className="rounded-lg bg-warn/10 px-3 py-1.5 text-sm font-semibold text-warn">
                Room {r.room} · {r.complaints} complaints
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {([
          { key: 'open', label: `Still open (${open.length})`, dot: 'bg-bad' },
          { key: 'late', label: `Late (${late.length})`, dot: 'bg-warn' },
          { key: 'all', label: `Everything (${feedback.length})` },
        ] as { key: View; label: string; dot?: string }[]).map((c) => (
          <Chip key={c.key} active={view === c.key} dot={c.dot} onClick={() => setView(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>

      <Card title="What was said" icon="list" count={shown.length} padded={false}>
        {shown.length === 0 ? (
          <p className="p-4 text-sm text-ink/55">
            {view === 'open' ? 'Nothing is waiting to be put right.' : 'Nothing has been written down yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {shown.map((f) => {
              const hours = hoursSince(f.at, now)
              const isLate = f.kind === 'complaint' && f.state === 'open' && hours >= LATE_AFTER
              return (
                <li key={f.id} className={`p-4 ${isLate ? 'bg-bad/[0.04]' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge tone={KIND_TONE[f.kind]} dot>
                          {KIND_LABEL[f.kind]}
                        </Badge>
                        <span className="font-semibold text-ink">{f.about}</span>
                        {f.rating !== undefined && <span className="text-xs text-ink/55">{f.rating} out of 5</span>}
                        <Badge tone={STATE_TONE[f.state]}>{f.state}</Badge>
                        {isLate && <Badge tone="bad">{hours} hours open</Badge>}
                      </p>
                      <p className="mt-1 text-sm text-ink/80">{f.text}</p>
                      <p className="mt-1 text-xs text-ink/55">
                        {f.guestId ? (
                          <Link to={`/desk/guests/${f.guestId}`} className="font-semibold text-brand">
                            {f.guestName}
                          </Link>
                        ) : (
                          f.guestName
                        )}
                        {f.room ? ` · room ${f.room}` : ''}
                        {f.reservationId ? ` · ${f.reservationId}` : ''} · {f.fromGuest ? 'from the guest' : f.by} ·{' '}
                        {f.at}
                      </p>
                      {f.resolution && (
                        <div className="mt-2 rounded-lg bg-good/[0.08] p-2.5 text-sm">
                          <p className="text-ink/80">{f.resolution.text}</p>
                          <p className="mt-0.5 text-xs text-ink/55">
                            {f.resolution.by} · {f.resolution.at}
                            {f.resolution.gesture
                              ? ` · ${f.resolution.gesture}${f.resolution.gestureAmount ? ` (${ugx(f.resolution.gestureAmount)})` : ''}`
                              : ''}
                          </p>
                        </div>
                      )}
                    </div>
                    {f.state === 'open' && (
                      <Button size="sm" variant="secondary" onClick={() => setResolving(f)}>
                        Put it right
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {logging && (
        <LogDialog
          onClose={() => setLogging(false)}
          onSave={(f) => {
            add({ ...f, id: newFeedbackId(feedback), at: stamp(), by: user?.name ?? 'Front desk', fromGuest: false, state: f.kind === 'complaint' ? 'open' : 'closed' })
            setLogging(false)
          }}
          reservations={reservations}
        />
      )}

      {resolving && (
        <ResolveDialog
          item={resolving}
          onClose={() => setResolving(null)}
          onSave={(res) => {
            update(resolving.id, { state: 'put right', resolution: { ...res, at: stamp(), by: user?.name ?? 'Front desk' } })
            setResolving(null)
          }}
        />
      )}
    </div>
  )
}

function LogDialog({
  onClose,
  onSave,
  reservations,
}: {
  onClose: () => void
  onSave: (f: Omit<Feedback, 'id' | 'at' | 'by' | 'fromGuest' | 'state'>) => void
  reservations: ReturnType<typeof useHotel>['reservations']
}) {
  const [kind, setKind] = useState<FeedbackKind>('complaint')
  const [about, setAbout] = useState<About>('The room')
  const [text, setText] = useState('')
  const [stayId, setStayId] = useState('')

  // Whoever is in the house first, then the most recent departures. A complaint is almost always about
  // last night, and a list that opens with a stay from March is a list nobody reads to the bottom.
  const here = [...reservations]
    .filter((r) => r.status === 'in-house' || r.status === 'checked-out')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in-house' ? -1 : 1
      return b.departure.localeCompare(a.departure)
    })
    .slice(0, 25)
  const stay = here.find((r) => r.id === stayId)

  return (
    <Modal
      title="Write down what a guest said"
      description="A complaint stays open until somebody puts it right."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={text.trim().length < 3 || !stay}
            onClick={() =>
              stay &&
              onSave({
                kind,
                about,
                text: text.trim(),
                guestId: stay.guestId,
                guestName: stay.guest,
                reservationId: stay.id,
                room: stay.room ?? undefined,
              })
            }
          >
            Write it down
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Which guest" required>
          {(id) => (
            <Select id={id} value={stayId} onChange={(e) => setStayId(e.target.value)}>
              <option value="">Choose the stay</option>
              {here.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.guest} · {r.room ? `room ${r.room}` : r.roomType} · {r.id}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What kind">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
                {(['complaint', 'compliment', 'suggestion'] as FeedbackKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="About what">
            {(id) => (
              <Select id={id} value={about} onChange={(e) => setAbout(e.target.value as About)}>
                {ABOUT.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="What they said" required hint="Their words, not a summary.">
          {(id) => <Textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

function ResolveDialog({
  item,
  onClose,
  onSave,
}: {
  item: Feedback
  onClose: () => void
  onSave: (res: { text: string; gesture?: string; gestureAmount?: number }) => void
}) {
  const [text, setText] = useState('')
  const [gesture, setGesture] = useState('')
  const [amount, setAmount] = useState('')

  return (
    <Modal
      title="What was done about it"
      description={item.text}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Not yet
          </Button>
          <Button
            disabled={text.trim().length < 3}
            onClick={() =>
              onSave({
                text: text.trim(),
                gesture: gesture.trim() || undefined,
                gestureAmount: amount ? Number(amount.replace(/\D/g, '')) || undefined : undefined,
              })
            }
          >
            Mark it put right
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="What was done" required>
          {(id) => <Textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Moved them to 302 and sent up tea." />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Anything given" hint="Optional">
            {(id) => <Input id={id} value={gesture} onChange={(e) => setGesture(e.target.value)} placeholder="A night taken off" />}
          </Field>
          <Field label="What it was worth" hint="Optional">
            {(id) => <Input id={id} inputMode="numeric" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
        </div>
        <p className="text-xs text-ink/55">
          Recorded only. Take money off a bill on the folio.
        </p>
      </div>
    </Modal>
  )
}
