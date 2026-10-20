import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, Chip, DataTable, EmptyState, Modal, PageHeader, StatCard, Tabs } from '../../components/ui'
import type { Column, Tone } from '../../components/ui'
import { dayMonth, ugx } from '../../lib/format'
import { automationService } from '../../services'
import type { GuestSegment, NbaKind, NextBestAction, SegmentCode, SegmentMember } from '../../services/automation/automationTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { DecisionButtons, Drivers, ErrorLine } from './automationUi'
import { useActor, useAutomationData, useAutomationSnapshot, useRefresh, useRun } from './useAutomation'

type Tab = 'actions' | 'segments'

const SEG_TONE: Record<SegmentCode, Tone> = { business: 'info', leisure: 'good', family: 'accent', vip: 'warn', lapsed: 'neutral', 'high-value': 'brand' }
const KIND_LABEL: Record<NbaKind, string> = { upsell: 'Upsell', recognition: 'Recognition', service: 'Service recovery', payment: 'Payment', retention: 'Win back' }
const KIND_TONE: Record<NbaKind, Tone> = { upsell: 'good', recognition: 'accent', service: 'bad', payment: 'warn', retention: 'info' }

export default function GuestInsightsPage() {
  const { tenant } = useFeatures()
  const pid = tenant.id
  const snapshot = useAutomationSnapshot()
  const refreshError = useRefresh(automationService.refreshGuests, snapshot)
  const { data: segments } = useAutomationData(() => automationService.listSegments(pid), [], [pid])
  const { data: members } = useAutomationData(() => automationService.listSegmentMembers(pid), [], [pid])
  const { data: nbas } = useAutomationData(() => automationService.listNextBestActions(pid), [], [pid])
  const [tab, setTab] = useState<Tab>('actions')
  const [segment, setSegment] = useState<GuestSegment | null>(null)

  const open = nbas.filter((n) => n.status === 'open')
  const accepted = nbas.filter((n) => n.status === 'accepted')
  const guestsSegmented = new Set(members.map((m) => m.guestId)).size
  const vip = segments.find((s) => s.code === 'vip')?.memberCount ?? 0
  const openValue = open.reduce((n, a) => n + (a.kind === 'upsell' ? (a.value ?? 0) : 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Automation" title="Guest insights" description="Segments from each guest's own stays, and what to offer or do next." />
      <ErrorLine error={refreshError} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Guests in a segment" icon="guests" value={guestsSegmented} hint={`of ${snapshot.guests.length} profiles`} onClick={() => setTab('segments')} active={tab === 'segments'} />
        <StatCard label="VIP" icon="sparkles" value={vip} hint="Marked or best value" />
        <StatCard label="Suggestions waiting" icon="tasks" value={open.length} hint={`${ugx(openValue)} in upsells`} onClick={() => setTab('actions')} active={tab === 'actions'} />
        <StatCard label="Accepted" icon="check" value={accepted.length} hint="Turned into desk tasks" tone={accepted.length ? 'good' : 'default'} />
      </div>

      <Tabs<Tab>
        label="Guest insights"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'actions', label: 'Next best actions', count: open.length },
          { key: 'segments', label: 'Segments', count: segments.length },
        ]}
      />

      {tab === 'actions' && <ActionList nbas={nbas} members={members} />}

      {tab === 'segments' && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {segments.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSegment(s)}
              className="rounded-xl border border-ink/10 bg-surface p-4 text-left transition hover:border-brand/40 hover:bg-brand/[0.02]"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone={SEG_TONE[s.code]}>{s.name}</Badge>
                <span className="text-2xl font-bold tabular-nums text-ink">{s.memberCount}</span>
              </div>
              <p className="mt-2 text-xs text-ink/60">{s.rule}</p>
              <p className="mt-2 truncate text-xs text-ink/50">
                {members
                  .filter((m) => m.segmentId === s.id)
                  .slice(0, 3)
                  .map((m) => m.guestName)
                  .join(', ') || 'Nobody yet'}
              </p>
            </button>
          ))}
        </div>
      )}

      {segment && <SegmentMembers segment={segment} members={members.filter((m) => m.segmentId === segment.id)} onClose={() => setSegment(null)} />}
    </div>
  )
}

function SegmentMembers({ segment, members, onClose }: { segment: GuestSegment; members: SegmentMember[]; onClose: () => void }) {
  const { canOpen } = useAuth()
  const linkable = canOpen('/desk/guests')
  const columns: Column<SegmentMember>[] = [
    {
      key: 'name',
      header: 'Guest',
      cell: (m) =>
        linkable ? (
          <Link to={`/desk/guests/${m.guestId}`} className="font-semibold text-brand">
            {m.guestName}
          </Link>
        ) : (
          <span className="font-semibold text-ink">{m.guestName}</span>
        ),
    },
    { key: 'why', header: 'Why', cell: (m) => <span className="whitespace-normal text-xs text-ink/70">{m.reason}</span> },
  ]
  return (
    <Modal side title={segment.name} description={segment.rule} onClose={onClose}>
      <DataTable columns={columns} rows={members} rowKey={(m) => m.id} empty={{ title: 'Nobody in this segment' }} />
    </Modal>
  )
}

function ActionList({ nbas, members }: { nbas: NextBestAction[]; members: SegmentMember[] }) {
  const actor = useActor()
  const { run, busy, error } = useRun()
  const [show, setShow] = useState<'in-house' | 'arriving' | 'past' | 'decided'>('in-house')

  const groups = useMemo(() => {
    const list = nbas.filter((n) => (show === 'decided' ? n.status !== 'open' : n.status === 'open' && n.stayStatus === show))
    const byGuest = new Map<string, NextBestAction[]>()
    for (const n of list) {
      const k = n.reservationId ?? n.guestId ?? n.guestName
      byGuest.set(k, [...(byGuest.get(k) ?? []), n])
    }
    return [...byGuest.values()]
  }, [nbas, show])
  const count = (s: NextBestAction['stayStatus']) => nbas.filter((n) => n.status === 'open' && n.stayStatus === s).length
  const segs = (guestId?: string) => members.filter((m) => m.guestId === guestId)

  return (
    <Card title="Next best actions" icon="tasks">
      <div className="mb-3 flex flex-wrap gap-2">
        <Chip active={show === 'in-house'} onClick={() => setShow('in-house')} count={count('in-house')}>
          In house
        </Chip>
        <Chip active={show === 'arriving'} onClick={() => setShow('arriving')} count={count('arriving')}>
          Arriving
        </Chip>
        <Chip active={show === 'past'} onClick={() => setShow('past')} count={count('past')}>
          Past guests
        </Chip>
        <Chip active={show === 'decided'} onClick={() => setShow('decided')} count={nbas.filter((n) => n.status !== 'open').length}>
          Decided
        </Chip>
      </div>
      <ErrorLine error={error} />
      {groups.length === 0 ? (
        <EmptyState title="Nothing to suggest here" />
      ) : (
        <ul className="space-y-3">
          {groups.map((list) => {
            const first = list[0]
            return (
              <li key={first.key} className="rounded-xl border border-ink/10 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{first.guestName}</p>
                  <span className="text-xs text-ink/55">
                    {first.room ? `Room ${first.room}` : first.reservationId ?? 'No booking'}
                    {first.stayStatus === 'arriving' && first.arrival ? ` · arrives ${dayMonth(first.arrival)}` : ''}
                  </span>
                  {segs(first.guestId).map((m) => (
                    <Badge key={m.id} tone={SEG_TONE[m.segmentCode]}>
                      {m.segmentCode === 'high-value' ? 'High value' : m.segmentCode[0].toUpperCase() + m.segmentCode.slice(1)}
                    </Badge>
                  ))}
                </div>
                <ul className="mt-2 divide-y divide-ink/8">
                  {list.map((n) => (
                    <li key={n.id} className="py-2.5 first:pt-1 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                            <Badge tone={KIND_TONE[n.kind]}>{KIND_LABEL[n.kind]}</Badge>
                            {n.title}
                            <span className="text-xs font-normal text-ink/50">score {n.score}</span>
                          </p>
                          <p className="mt-0.5 text-sm text-ink/65">{n.detail}</p>
                        </div>
                        <DecisionButtons
                          item={n}
                          busy={busy}
                          acceptLabel="Accept, create task"
                          onAccept={() => actor && run(() => automationService.decideNextBestAction(n.id, true, '', actor))}
                          onDismiss={(reason) => actor && run(() => automationService.decideNextBestAction(n.id, false, reason, actor))}
                        />
                      </div>
                      <Drivers drivers={n.drivers} />
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
