import { useMemo, useState } from 'react'
import { useHousekeeping } from './hkContext'
import { isActive, nextTaskStatus, priorityRank } from './hkModel'
import type { HkTask } from './hkModel'
import { PriorityChip, TaskChip, btnGhost, card } from './hkUi'
import { useRoomOverlays } from './useRoomOverlays'
import { checklistChoices, matchChoices } from '../../lib/cleaning'
import { useFeatures } from '../platform/featuresContext'
import { useAuth } from '../auth/authContext'
import LogItemDialog from '../lostfound/LogItemDialog'

/** A room number or the name of a public area. */
const placeName = (t: HkTask) => (t.area ? t.room : `Room ${t.room}`)

/** The one line that tells her why this job matters more than the next one. */
function whyLine(t: HkTask): string | null {
  if (t.notes.startsWith('Rush from front desk')) return 'Rushed: a guest is waiting at the desk'
  if (t.type === 'Inspection' && t.priority === 'Urgent') return 'Nobody has been in this room for days'
  if (t.priority === 'Urgent') return 'A guest arrives today'
  if (t.priority === 'High') return 'Needed for an arrival today'
  if (t.type === 'Stay Over') return t.linen ? 'Guest still in the room. Sheets due today' : 'Guest still in the room'
  return null
}

/** What she records doing: the usual items as one tap each, anything else typed. */
function FinishSheet({
  task,
  onClose,
  onFinish,
}: {
  task: HkTask
  onClose: () => void
  onFinish: (items: string[]) => void
}) {
  const { options, setOptions } = useFeatures()
  const [chosen, setChosen] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const choices = checklistChoices(task.type, options.extraChecks)
  const matches = query.trim().length >= 2 ? matchChoices(choices, query, chosen).slice(0, 6) : []
  const typedIsNew =
    query.trim().length >= 2 && !choices.some((c) => c.toLowerCase() === query.trim().toLowerCase())

  const toggle = (item: string) =>
    setChosen((current) => (current.includes(item) ? current.filter((c) => c !== item) : [...current, item]))

  function add(item: string) {
    const clean = item.trim()
    if (!clean) return
    if (!chosen.includes(clean)) setChosen((current) => [...current, clean])
    // Anything the hotel invents is offered to everyone from now on.
    if (!choices.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setOptions({ extraChecks: [...options.extraChecks, clean] })
    }
    setQuery('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 sm:max-w-md sm:rounded-2xl">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{placeName(task)}</h2>
            <p className="text-sm text-ink/60">{task.type}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-2 text-2xl leading-none text-ink/50">
            &times;
          </button>
        </div>

        <p className="mt-3 text-sm font-semibold">What did you do?</p>
        <p className="text-xs text-ink/55">Tap what applies. Type anything else.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {choices.map((item) => {
            const on = chosen.includes(item)
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                aria-pressed={on}
                className={`rounded-full px-3 py-2 text-sm font-medium ring-1 ${
                  on ? 'bg-brand text-white ring-brand' : 'bg-white text-ink/70 ring-ink/15'
                }`}
              >
                {on ? '✓ ' : ''}
                {item}
              </button>
            )
          })}
        </div>

        {chosen.filter((c) => !choices.includes(c)).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {chosen
              .filter((c) => !choices.includes(c))
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggle(item)}
                  className="rounded-full bg-brand px-3 py-2 text-sm font-medium text-white ring-1 ring-brand"
                >
                  &#10003; {item}
                </button>
              ))}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="extra-check" className="text-sm font-medium">
            Something else
          </label>
          <input
            id="extra-check"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add(matches[0] ?? query)
              }
            }}
            placeholder="Type two letters"
            className="mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-3 text-base"
          />
          {(matches.length > 0 || typedIsNew) && (
            <div className="mt-1 overflow-hidden rounded-lg border border-ink/15 bg-white">
              {matches.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => add(m)}
                  className="block w-full px-3 py-3 text-left text-sm hover:bg-canvas"
                >
                  {m}
                </button>
              ))}
              {typedIsNew && (
                <button
                  type="button"
                  onClick={() => add(query)}
                  className="block w-full px-3 py-3 text-left text-sm font-semibold text-brand hover:bg-canvas"
                >
                  Add &ldquo;{query.trim()}&rdquo;
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onFinish(chosen)}
          className="mt-5 w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
        >
          Finish {placeName(task).toLowerCase()}
        </button>
        <p className="mt-2 text-center text-xs text-ink/50">
          Recorded against your name and the time you started.
        </p>
      </div>
    </div>
  )
}

/** The guest said no. Recorded, because a refused room and a skipped room are not the same thing. */
function DeclineSheet({ task, onClose, onDecline }: { task: HkTask; onClose: () => void; onDecline: (r: string) => void }) {
  const reasons = ['Do not disturb sign', 'Guest asked me to come back', 'Guest is sleeping', 'No answer, chain on']
  const [reason, setReason] = useState(reasons[0])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4">
      <div className="w-full rounded-t-2xl bg-surface p-5 sm:max-w-md sm:rounded-2xl">
        <h2 className="text-xl font-bold">{placeName(task)} not serviced</h2>
        <p className="mt-1 text-sm text-ink/60">Why could you not do it?</p>
        <div className="mt-3 space-y-2">
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`block w-full rounded-lg px-4 py-3 text-left text-sm font-medium ring-1 ${
                reason === r ? 'bg-brand/10 text-ink ring-brand' : 'bg-white text-ink/70 ring-ink/15'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onDecline(reason)}
          className="mt-5 w-full rounded-xl bg-warn px-4 py-4 text-base font-semibold text-white"
        >
          Record it
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full px-4 py-3 text-sm font-medium text-ink/60">
          Back
        </button>
      </div>
    </div>
  )
}

// Built for a phone in the corridor: one column, big buttons, only this person's own work.
export default function MyTasksPage() {
  const hk = useHousekeeping()
  const { user } = useAuth()
  const { overlays, openRoom, reportIssue } = useRoomOverlays()
  const [finishing, setFinishing] = useState<HkTask | null>(null)
  const [declining, setDeclining] = useState<HkTask | null>(null)
  const [foundIn, setFoundIn] = useState<string | null>(null)

  // Who is signed in is who this page is for. The work comes from the supervisor, not from a list
  // the attendant picks off, so there is one person responsible for who is where.
  const me = user?.staffName ?? ''

  const { mine, now, done } = useMemo(() => {
    const sort = (a: HkTask, b: HkTask) =>
      priorityRank[a.priority] - priorityRank[b.priority] || a.dueTime.localeCompare(b.dueTime)
    const mineAll = hk.tasks.filter((t) => isActive(t) && t.attendant === me).sort(sort)
    return {
      mine: mineAll.filter((t) => t.status !== 'In Progress'),
      now: mineAll.find((t) => t.status === 'In Progress') ?? null,
      done: hk.tasks.filter((t) => t.attendant === me && t.status === 'Completed').length,
    }
  }, [hk.tasks, me])

  if (!me) {
    return (
      <div className="mx-auto max-w-xl">
        <div className={`${card} p-6 text-center`}>
          <p className="font-semibold">This page is for room attendants</p>
          <p className="mt-1 text-sm text-ink/60">
            It shows the work given to whoever is signed in. Your account is not on the housekeeping staff list.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-24">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Housekeeping</p>
        <h1 className="text-2xl font-bold">My tasks</h1>
        <p className="mt-1 text-sm text-ink/60">
          {user?.name} &middot; {mine.length + (now ? 1 : 0)} to do &middot; {done} done
        </p>
      </div>

      {now && (
        <section className="rounded-2xl bg-linear-to-br from-brand to-brand-deep p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Doing now</p>
          <button type="button" onClick={() => !now.area && openRoom(now.room)} className="mt-1 text-3xl font-bold">
            {placeName(now)}
          </button>
          <p className="mt-1 text-sm text-white/80">
            {now.type}
            {now.startedAt ? ` · started ${now.startedAt}` : ''}
          </p>
          {whyLine(now) && <p className="mt-2 text-sm font-medium text-white/90">{whyLine(now)}</p>}
          <button
            type="button"
            onClick={() => setFinishing(now)}
            className="mt-4 w-full rounded-xl bg-white px-4 py-4 text-base font-semibold text-brand-deep"
          >
            Finish {placeName(now).toLowerCase()}
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {!now.area && (
              <button
                type="button"
                onClick={() => setFoundIn(now.room)}
                className="rounded-xl bg-white/15 px-3 py-3 text-sm font-semibold"
              >
                Found something
              </button>
            )}
            <button
              type="button"
              onClick={() => (now.area ? setDeclining(now) : reportIssue(now.room))}
              className={`rounded-xl bg-white/15 px-3 py-3 text-sm font-semibold ${now.area ? 'col-span-2' : ''}`}
            >
              {now.area ? 'Could not do it' : 'Report a problem'}
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        {mine.length === 0 && !now && (
          <div className={`${card} p-6 text-center`}>
            <p className="font-semibold">Nothing on your list</p>
            <p className="mt-1 text-sm text-ink/60">
              Your supervisor gives out the work. Anything handed to you shows up here.
            </p>
          </div>
        )}
        {mine.map((t) => (
          <div key={t.id} className={`${card} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => !t.area && openRoom(t.room)}
                  className="text-left text-xl font-bold hover:text-brand"
                >
                  {placeName(t)}
                </button>
                <p className="text-sm text-ink/60">
                  {t.type} &middot; {t.zone} &middot; due {t.dueTime}
                </p>
                {whyLine(t) && <p className="mt-1 text-sm font-medium text-brand-deep">{whyLine(t)}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <PriorityChip priority={t.priority} />
                <TaskChip status={t.status} />
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {nextTaskStatus(t.status) && (
                <button
                  type="button"
                  onClick={() => hk.advanceTask(t)}
                  className="w-full rounded-xl bg-brand px-4 py-4 text-base font-semibold text-white"
                >
                  Start
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                {t.type === 'Stay Over' ? (
                  <button type="button" onClick={() => setDeclining(t)} className={`${btnGhost} px-3 py-3 text-sm`}>
                    Guest said no
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => (t.area ? setDeclining(t) : setFoundIn(t.room))}
                    className={`${btnGhost} px-3 py-3 text-sm`}
                  >
                    {t.area ? 'Could not do it' : 'Found something'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (t.area ? setDeclining(t) : reportIssue(t.room))}
                  className={`${btnGhost} px-3 py-3 text-sm`}
                >
                  {t.area ? 'Could not do it' : 'Report a problem'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {finishing && (
        <FinishSheet
          task={finishing}
          onClose={() => setFinishing(null)}
          onFinish={(items) => {
            hk.advanceTask(finishing, items)
            setFinishing(null)
          }}
        />
      )}
      {declining && (
        <DeclineSheet
          task={declining}
          onClose={() => setDeclining(null)}
          onDecline={(reason) => {
            hk.declineTask(declining, reason)
            setDeclining(null)
          }}
        />
      )}
      {foundIn && <LogItemDialog room={foundIn} onClose={() => setFoundIn(null)} />}

      {overlays}
    </div>
  )
}
