import { useMemo, useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Segmented, StatCard } from '../../components/ui'
import type { Column } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { dayMonthYear } from '../../lib/format'
import {
  KIND_LABEL,
  KIND_NOTE,
  KIND_TONE,
  findingsOf,
  newSweepId,
  problems,
  sweepProgress,
  sweepSummary,
  sweepWords,
} from '../../lib/discrepancy'
import type { Expected, Finding, Found, Sweep } from '../../lib/discrepancy'
import { useAuth } from '../auth/authContext'
import { useHousekeeping } from './hkContext'
import { useRoomOverlays } from './useRoomOverlays'
import { useSweeps } from './useSweeps'

type View = 'walk' | 'differences'

export default function RoomCheckPage() {
  const hk = useHousekeeping()
  const { user } = useAuth()
  const { sweeps, open, start, save } = useSweeps()
  const { overlays, openRoom } = useRoomOverlays()
  const [view, setView] = useState<View>('walk')
  const [note, setNote] = useState<Record<string, string>>({})

  // What the system believes about each room, read at the moment it is compared.
  const expectedFor = useMemo(
    () =>
      (room: string): Expected => {
        const stay = hk.stayOf(room)
        const record = hk.rooms.find((r) => r.room === room)
        return {
          occupied: !!stay,
          ready: record?.status === 'Clean' || record?.status === 'Inspected',
          stayId: stay?.id,
          guest: stay?.guest,
        }
      },
    [hk],
  )

  const findings = open ? findingsOf(open, expectedFor) : []
  const summary = sweepSummary(findings)
  const toSettle = problems(findings)
  const progress = open ? sweepProgress(open) : { done: 0, total: 0 }

  function startWalk() {
    const sweep: Sweep = {
      id: newSweepId(),
      day: TODAY,
      startedIso: new Date().toISOString(),
      by: user?.staffName || user?.name || 'Staff',
      // Every room the hotel has, including the ones it believes are empty: a sleeper is only ever
      // found in a room nobody thought to look at.
      rooms: hk.rooms.map((r) => ({ room: r.room, found: 'not checked' as Found })),
    }
    start(sweep)
    setView('walk')
  }

  function mark(room: string, found: Found, dirty?: boolean) {
    if (!open) return
    save({
      ...open,
      rooms: open.rooms.map((r) =>
        // What the system believed is written down with the finding, not looked up again later.
        r.room === room ? { ...r, found, dirty, note: note[room] || r.note, expected: expectedFor(room) } : r,
      ),
    })
  }

  function finish() {
    if (!open) return
    save({ ...open, finishedIso: new Date().toISOString() })
    setView('differences')
  }

  /** The room is flagged for the desk and housekeeping to settle. The booking is never touched here. */
  function flag(finding: Finding) {
    const why =
      finding.kind === 'sleeper'
        ? `Room check: somebody is in the room, nothing is booked in it.${finding.note ? ` ${finding.note}` : ''}`
        : finding.kind === 'skip'
          ? `Room check: found empty, but ${finding.guest ?? 'a guest'} is still checked in.`
          : `Room check: found dirty while the system had it ready to sell.`
    hk.setException(finding.room, 'discrepancy', why)
  }

  const walkColumns: Column<{ room: string; found: Found; dirty?: boolean }>[] = [
    {
      key: 'room',
      header: 'Room',
      cell: (r) => {
        const expected = expectedFor(r.room)
        return (
          <>
            <button type="button" onClick={() => openRoom(r.room)} className="font-semibold text-ink hover:text-brand">
              Room {r.room}
            </button>
            <p className="text-xs text-ink/55">
              {expected.occupied ? `System: ${expected.guest ?? 'occupied'}` : 'System: empty'}
            </p>
          </>
        )
      },
    },
    {
      key: 'found',
      header: 'What did you find?',
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={r.found === 'occupied' ? 'primary' : 'secondary'} onClick={() => mark(r.room, 'occupied')}>
            Somebody in it
          </Button>
          <Button size="sm" variant={r.found === 'vacant' && !r.dirty ? 'primary' : 'secondary'} onClick={() => mark(r.room, 'vacant', false)}>
            Empty and clean
          </Button>
          <Button size="sm" variant={r.found === 'vacant' && r.dirty ? 'primary' : 'secondary'} onClick={() => mark(r.room, 'vacant', true)}>
            Empty and dirty
          </Button>
        </div>
      ),
    },
    {
      key: 'note',
      header: 'Note',
      hideBelow: 'lg',
      cell: (r) => (
        <Input
          value={note[r.room] ?? ''}
          onChange={(e) => setNote((current) => ({ ...current, [r.room]: e.target.value }))}
          onBlur={() => r.found !== 'not checked' && mark(r.room, r.found, r.dirty)}
          placeholder="Anything odd"
          className="py-1.5 text-xs"
          aria-label={`Note for room ${r.room}`}
        />
      ),
    },
  ]

  const diffColumns: Column<Finding>[] = [
    {
      key: 'room',
      header: 'Room',
      cell: (f) => (
        <button type="button" onClick={() => openRoom(f.room)} className="font-semibold text-ink hover:text-brand">
          Room {f.room}
        </button>
      ),
    },
    { key: 'kind', header: 'What', cell: (f) => <Badge tone={KIND_TONE[f.kind]}>{KIND_LABEL[f.kind]}</Badge> },
    {
      key: 'detail',
      header: 'Difference',
      cell: (f) => (
        <>
          <p className="text-sm text-ink/80">{KIND_NOTE[f.kind]}</p>
          {f.guest && <p className="text-xs text-ink/55">Booked in: {f.guest}</p>}
          {f.note && <p className="text-xs text-ink/55">Note: {f.note}</p>}
        </>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (f) =>
        hk.rooms.find((r) => r.room === f.room)?.status === 'Discrepancy' ? (
          <Badge tone="accent">Raised</Badge>
        ) : (
          <Button size="sm" onClick={() => flag(f)}>
            Raise it
          </Button>
        ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Housekeeping"
        title="Room check"
        description="Walk the floor and compare rooms with the system."
        actions={
          open ? (
            <Button onClick={finish}>Finish the walk</Button>
          ) : (
            <Button onClick={startWalk}>Start a room check</Button>
          )
        }
      />

      {open ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Checked" icon="check" value={`${progress.done}/${progress.total}`} hint="Rooms walked" />
            <StatCard label="Sleepers" icon="alert" value={String(summary.sleepers)} hint="Nobody is being charged" tone={summary.sleepers > 0 ? 'bad' : 'default'} />
            <StatCard label="Skips" icon="bed" value={String(summary.skips)} hint="Still checked in, found empty" tone={summary.skips > 0 ? 'warn' : 'default'} />
            <StatCard label="Wrong status" icon="clean" value={String(summary.status)} hint="Dirty, but sold as ready" tone={summary.status > 0 ? 'warn' : 'default'} />
          </div>

          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { key: 'walk', label: 'The walk' },
              { key: 'differences', label: `Differences (${toSettle.length})` },
            ]}
          />

          {view === 'walk' ? (
            <Card
              title="Every room"
              icon="list"
              count={open.rooms.length}
              description="Including rooms shown as empty."
              padded={false}
            >
              <DataTable columns={walkColumns} rows={open.rooms} rowKey={(r) => r.room} />
            </Card>
          ) : (
            <Card
              title="Differences"
              icon="alert"
              count={toSettle.length}
              description="Raising one flags the room. Bookings are not changed."
              padded={false}
            >
              {toSettle.length === 0 ? (
                <EmptyState
                  title="The floor and the system agree"
                  hint={summary.missed > 0 ? `${summary.missed} rooms have not been checked yet.` : 'Every room checked matches.'}
                />
              ) : (
                <DataTable columns={diffColumns} rows={toSettle} rowKey={(f) => f.room} />
              )}
            </Card>
          )}
        </>
      ) : (
        <Card>
          <EmptyState
            title="No room check running"
            hint="Start one and walk the floor."
            action={<Button onClick={startWalk}>Start a room check</Button>}
          />
        </Card>
      )}

      <Card title="Earlier checks" icon="calendar" count={sweeps.filter((s) => s.finishedIso).length} padded={false}>
        {sweeps.filter((s) => s.finishedIso).length === 0 ? (
          <EmptyState title="None finished yet" />
        ) : (
          <ul className="divide-y divide-ink/10">
            {sweeps
              .filter((s) => s.finishedIso)
              .map((s) => {
                const past = sweepSummary(findingsOf(s, expectedFor))
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{dayMonthYear(s.day)}</p>
                      <p className="text-xs text-ink/60">
                        {past.checked} of {past.rooms} rooms · by {s.by}
                      </p>
                    </div>
                    <Badge tone={past.sleepers + past.skips > 0 ? 'warn' : 'good'}>{sweepWords(past)}</Badge>
                  </li>
                )
              })}
          </ul>
        )}
      </Card>

      {overlays}
    </div>
  )
}
