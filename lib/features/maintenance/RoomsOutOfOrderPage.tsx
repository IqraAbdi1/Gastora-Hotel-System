import { useMemo } from 'react'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import { defectStatusStyles } from '../housekeeping/hkModel'
import { Empty, PageHeader, StatusChip, btnGhost, card } from '../housekeeping/hkUi'
import { useRoomOverlays } from '../housekeeping/useRoomOverlays'

export default function RoomsOutOfOrderPage() {
  const hk = useHousekeeping()
  const { features } = useFeatures()
  const { overlays, openRoom } = useRoomOverlays()

  const blocked = useMemo(
    () => hk.rooms.filter((r) => r.status === 'Out of Order' || r.status === 'Out of Service'),
    [hk.rooms],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rooms out of order"
        hint="Rooms taken out of sale, and the repair each one is waiting for. Out of Order is removed from sale until fixed. Out of Service is a short block."
      />

      <section className={card}>
        <ul className="divide-y divide-ink/10">
          {blocked.map((room) => {
            const repairs = hk.allDefects.filter(
              (x) => x.room === room.room && x.defect.blocksRoom && x.defect.status !== 'Resolved',
            )
            return (
              <li key={room.room} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <button type="button" onClick={() => openRoom(room.room, 'defects')} className="font-bold hover:text-brand">
                    Room {room.room}
                  </button>
                  <p className="text-sm text-ink/60">{room.type} · {room.zone}</p>
                  {room.reason && <p className="text-sm text-ink/70">Reason: {room.reason}</p>}
                  {repairs.map(({ defect }) => (
                    <p key={defect.id} className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-ink/70">{defect.category}: {defect.description}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${defectStatusStyles[defect.status]}`}>
                        {defect.status}
                      </span>
                    </p>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={room.status} />
                  {repairs.length > 0 ? (
                    <span className="max-w-48 text-xs text-ink/60">
                      Released when the repair is {features.repairSignoff ? 'verified' : 'marked done'}.
                    </span>
                  ) : (
                    <button type="button" onClick={() => hk.resetRoom(room.room)} className={btnGhost}>Release</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {blocked.length === 0 && <Empty title="No rooms are out of order" />}
      </section>

      {overlays}
    </div>
  )
}