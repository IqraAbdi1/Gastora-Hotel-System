import { useMemo } from 'react'
import { Badge, Button, Card, EmptyState, PageHeader, StatCard } from '../../components/ui'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import { defectStatusTone, statusTone } from '../housekeeping/hkModel'
import { useRoomOverlays } from '../housekeeping/useRoomOverlays'
import { downWords, hoursOf } from '../../lib/downtime'
import { useNow } from '../../lib/useNow'
import DowntimeCard from './DowntimeCard'

export default function RoomsOutOfOrderPage() {
  const hk = useHousekeeping()
  const { features } = useFeatures()
  const { overlays, openRoom } = useRoomOverlays()
  const now = useNow(60000)
  const openSpell = (room: string) => hk.spells.find((s) => s.room === room && !s.toIso)

  const blocked = useMemo(
    () => hk.rooms.filter((r) => r.status === 'Out of Order' || r.status === 'Out of Service'),
    [hk.rooms],
  )
  const outOfOrder = blocked.filter((r) => r.status === 'Out of Order').length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Maintenance"
        title="Rooms out of order"
        description="Rooms taken out of sale, and the repair each one is waiting for."
      />

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard
          label="Out of order"
          icon="alert"
          value={String(outOfOrder)}
          hint="Off sale until repaired"
          tone={outOfOrder > 0 ? 'bad' : 'default'}
        />
        <StatCard
          label="Out of service"
          icon="bed"
          value={String(blocked.length - outOfOrder)}
          hint="A short block"
          tone={blocked.length - outOfOrder > 0 ? 'warn' : 'default'}
        />
      </div>

      <Card
        title="Rooms off sale"
        icon="bed"
        count={blocked.length}
        description="Out of order until fixed. Out of service is a short block."
        padded={false}
      >
        {blocked.length === 0 ? (
          <EmptyState title="No rooms are out of order" hint="Every room is available to sell." />
        ) : (
          <ul className="divide-y divide-ink/10">
            {blocked.map((room) => {
              const repairs = hk.allDefects.filter(
                (x) => x.room === room.room && x.defect.blocksRoom && x.defect.status !== 'Resolved',
              )
              return (
                <li key={room.room} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => openRoom(room.room, 'defects')}
                      className="font-semibold text-ink hover:text-brand"
                    >
                      Room {room.room}
                    </button>
                    <p className="text-sm text-ink/60">
                      {room.type} · {room.zone}
                    </p>
                    {room.reason && <p className="text-sm text-ink/70">Reason: {room.reason}</p>}
                    {features.roomDowntime &&
                      (() => {
                        const spell = openSpell(room.room)
                        return spell ? (
                          <p className="text-xs font-medium text-warn">Off sale {downWords(hoursOf(spell, now))}</p>
                        ) : null
                      })()}
                    {repairs.map(({ defect }) => (
                      <p key={defect.id} className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-ink/70">
                          {defect.category}: {defect.description}
                        </span>
                        <Badge tone={defectStatusTone[defect.status]}>{defect.status}</Badge>
                      </p>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone[room.status]} dot>
                      {room.status}
                    </Badge>
                    {repairs.length > 0 ? (
                      <span className="max-w-48 text-xs text-ink/60">
                        Released when the repair is {features.repairSignoff ? 'verified' : 'marked done'}.
                      </span>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => hk.resetRoom(room.room)}>
                        Release
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {features.roomDowntime && <DowntimeCard />}

      {overlays}
    </div>
  )
}
