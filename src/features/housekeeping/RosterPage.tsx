import { useMemo, useState } from 'react'
import FilterBar from '../../components/FilterBar'
import { Badge, Card, Chip, PageHeader, Segmented, Select, StatCard } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { useAuth } from '../auth/authContext'
import { useHousekeeping } from './hkContext'
import { attendants, isActive, placeLabel } from './hkModel'
import type { HkTask } from './hkModel'

type View = 'roster' | 'record'

/** Who is on which room today, and what was actually done. */
// Words that mark a history line as work done on a room or an area.
const WORK_WORDS = [
  'clean',
  'inspect',
  'ready',
  'service',
  'declined',
  'work recorded',
  'public area',
  'stay over',
  'turndown',
]

export default function RosterPage() {
  const { tasks, rooms, allHistory, assignTask } = useHousekeeping()
  const { can } = useAuth()
  const [view, setView] = useState<View>('roster')
  const [q, setQ] = useState('')
  const [who, setWho] = useState('all')
  const [focus, setFocus] = useState('all')

  const canAssign = can('manageStock') || can('changeSettings') || can('endorseRequest')
  const live = tasks.filter(isActive)

  // One row per attendant, with the rooms on their list today.
  const roster = useMemo(() => {
    const names = attendants.filter((a) => a !== 'Unassigned')
    const byName = new Map<string, HkTask[]>(names.map((n) => [n, []]))
    const spare: HkTask[] = []
    for (const t of live) {
      if (t.attendant && byName.has(t.attendant)) byName.get(t.attendant)!.push(t)
      else spare.push(t)
    }
    return { byName, spare }
  }, [live])

  // Finished work still belongs to the name that did it, even though it is no longer on the list.
  const finishedBy = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) {
      if (t.status !== 'Completed' || !t.attendant) continue
      map.set(t.attendant, (map.get(t.attendant) ?? 0) + 1)
    }
    return map
  }, [tasks])

  const working = [...roster.byName.entries()].filter(([, list]) => list.length > 0)
  const free = [...roster.byName.entries()].filter(([, list]) => list.length === 0).map(([name]) => name)
  const shown = working.filter(([name]) => focus === 'all' || focus === name)

  // Only the lines about work on a place: cleaning, the daily service, a public area, an inspection,
  // or a service the guest refused. That is what a guest question is ever about.
  const cleaning = useMemo(
    () =>
      allHistory.filter((h) => {
        const text = `${h.entry.action} ${h.entry.note}`.toLowerCase()
        return WORK_WORDS.some((w) => text.includes(w))
      }),
    [allHistory],
  )

  const record = useMemo(() => {
    const text = q.trim().toLowerCase()
    return cleaning.filter(
      (h) =>
        (who === 'all' || h.entry.user === who) &&
        (!text || `${h.room} ${h.entry.user} ${h.entry.action} ${h.entry.note}`.toLowerCase().includes(text)),
    )
  }, [cleaning, q, who])

  const unassigned = live.filter((t) => !t.attendant || t.attendant === 'Unassigned').length
  const done = tasks.filter((t) => t.status === 'Completed').length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Housekeeping"
        title="Roster and cleaning record"
        description="Who is on which room today, and who cleaned what. Useful when a guest asks about their room."
        meta={<Badge tone="neutral">{TODAY}</Badge>}
        actions={
          <Segmented<View>
            label="View"
            value={view}
            onChange={setView}
            options={[
              { key: 'roster', label: "Today's roster" },
              { key: 'record', label: 'Cleaning record' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Rooms on the list" icon="tasks" value={live.length} hint="Still to do today" />
        <StatCard label="Nobody assigned" icon="alert" value={unassigned} hint="Give these to someone" tone={unassigned > 0 ? 'warn' : 'good'} />
        <StatCard label="Finished today" icon="check" value={done} hint="Cleaned and closed" tone="good" />
        <StatCard label="Cleaning entries" icon="list" value={cleaning.length} hint="In the record" />
      </div>

      {view === 'roster' ? (
        <>
          <Card
            title="Who is on today"
            icon="guests"
            padded
            description="Every name at a glance. Tap one to see only their work."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[...roster.byName.entries()].map(([name, list]) => {
                const busy = list.filter((t) => t.status === 'In Progress').length
                const on = focus === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setFocus(on ? 'all' : name)}
                    aria-pressed={on}
                    className={`rounded-xl px-3 py-2.5 text-left ring-1 transition ${
                      on
                        ? 'bg-brand text-white ring-brand'
                        : list.length
                          ? 'bg-surface text-ink ring-ink/15 hover:ring-brand/40'
                          : 'bg-canvas/60 text-ink/55 ring-ink/10 hover:ring-brand/30'
                    }`}
                  >
                    <span className="block truncate text-base font-semibold">{name}</span>
                    <span className={`block text-xs ${on ? 'text-white/80' : 'text-ink/60'}`}>
                      {list.length === 0 ? 'Free' : `${list.length} to do`}
                      {busy > 0 ? ' \u00b7 cleaning now' : ''}
                      {finishedBy.get(name) ? ` \u00b7 ${finishedBy.get(name)} done` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
            {free.length > 0 && (
              <p className="mt-3 text-sm text-ink/55">
                Free to take something: <span className="font-medium text-ink/70">{free.join(', ')}</span>.
              </p>
            )}
            {focus !== 'all' && (
              <button
                type="button"
                onClick={() => setFocus('all')}
                className="mt-3 text-sm font-semibold text-brand hover:underline"
              >
                Show everyone
              </button>
            )}
          </Card>

          {shown.map(([name, list]) => (
            <Card
              key={name}
              title={name}
              icon="guests"
              count={list.length}
              padded
              description={`${list.map((t) => placeLabel(t.room)).join(', ')}`}
            >
              {(
                <ul className="space-y-2">
                  {list
                    .slice()
                    .sort((a, b) => a.dueTime.localeCompare(b.dueTime))
                    .map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/10 bg-surface p-2.5">
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">
                            {placeLabel(t.room)} <span className="font-normal text-ink/55">· {t.zone}</span>
                          </p>
                          <p className="text-xs text-ink/60">
                            {t.type} · due {t.dueTime}
                            {t.notes ? ` · ${t.notes}` : ''}
                          </p>
                        </div>
                        <Badge tone={t.status === 'Completed' ? 'good' : t.status === 'In Progress' ? 'brand' : t.status === 'Unassigned' ? 'warn' : 'neutral'}>{t.status}</Badge>
                      </li>
                    ))}
                </ul>
              )}
            </Card>
          ))}

          {working.length === 0 && (
            <Card title="Nobody has anything yet" icon="alert" padded>
              <p className="text-sm text-ink/55">
                Hand out the work below and the names above will fill in.
              </p>
            </Card>
          )}

          <Card title="Nobody assigned yet" icon="alert" count={roster.spare.length} padded>
            {roster.spare.length === 0 ? (
              <p className="text-sm text-ink/55">Every room on the list has a name against it.</p>
            ) : (
              <ul className="space-y-2">
                {roster.spare.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn/[0.07] p-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {placeLabel(t.room)} <span className="font-normal text-ink/55">· {t.zone}</span>
                      </p>
                      <p className="text-xs text-ink/60">
                        {t.type} · due {t.dueTime}
                      </p>
                    </div>
                    {canAssign ? (
                      <Select
                        aria-label={`Give room ${t.room} to`}
                        className="w-40"
                        value=""
                        onChange={(e) => e.target.value && assignTask(t.id, e.target.value)}
                      >
                        <option value="">Give it to…</option>
                        {attendants
                          .filter((a) => a !== 'Unassigned')
                          .map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                      </Select>
                    ) : (
                      <Badge tone="warn">Unassigned</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-60 flex-1">
              <FilterBar query={q} onQuery={setQ} placeholder="Search room, person or what was done" />
            </div>
            <Select aria-label="Who" className="w-44" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="all">Everyone</option>
              {[...new Set(cleaning.map((h) => h.entry.user))].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', ...new Set(cleaning.map((h) => h.room))].slice(0, 12).map((r) => (
              <Chip key={r} active={q === (r === 'all' ? '' : r)} onClick={() => setQ(r === 'all' ? '' : r)}>
                {r === 'all' ? 'Everywhere' : placeLabel(r)}
              </Chip>
            ))}
          </div>

          <Card
            title="Who cleaned what"
            icon="clean"
            count={record.length}
            padded
            description="Kept so that if a guest reports something missing, the hotel knows who was in the room."
          >
            {record.length === 0 ? (
              <p className="text-sm text-ink/55">
                Nothing recorded yet. An entry is written whenever a room is cleaned, inspected or marked ready.
              </p>
            ) : (
              <ul className="space-y-2">
                {record.slice(0, 40).map((h) => (
                  <li key={h.entry.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-ink/10 bg-surface p-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {placeLabel(h.room)} <span className="font-normal text-ink/60">· {h.entry.action}</span>
                      </p>
                      <p className="text-xs text-ink/60">{h.entry.note}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-ink">{h.entry.user}</p>
                      <p className="text-xs text-ink/55">{h.entry.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {record.length > 40 && <p className="mt-2 text-xs text-ink/55">Showing the newest 40 of {record.length}. Search to narrow it.</p>}
          </Card>

          <p className="text-xs text-ink/50">
            {rooms.length} rooms. The record is written by the system as work happens; it is not typed in by hand, so it
            cannot be tidied up afterwards.
          </p>
        </>
      )}
    </div>
  )
}
