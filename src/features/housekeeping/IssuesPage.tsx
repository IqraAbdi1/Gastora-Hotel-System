import { useMemo, useState } from 'react'
import { useHousekeeping } from './hkContext'
import { defectStatusStyles, exceptionStatuses } from './hkModel'
import { Empty, PAGE, PageHeader, Pager, StatusChip, btnGhost, card, field } from './hkUi'
import { useRoomOverlays } from './useRoomOverlays'

const OPEN = 'Not resolved'

export default function IssuesPage() {
  const hk = useHousekeeping()
  const { overlays, openRoom } = useRoomOverlays()
  const [status, setStatus] = useState(OPEN)
  const [page, setPage] = useState(0)

  const flagged = useMemo(
    () => hk.rooms.filter((r) => exceptionStatuses.includes(r.status as never)),
    [hk.rooms],
  )

  const defects = useMemo(
    () =>
      hk.allDefects
        .filter((d) => (status === OPEN ? d.defect.status !== 'Resolved' : status === 'All' || d.defect.status === status))
        .sort((a, b) => a.room.localeCompare(b.room) || b.defect.id - a.defect.id),
    [hk.allDefects, status],
  )
  const shown = defects.slice(page * PAGE, page * PAGE + PAGE)

  return (
    <div className="space-y-5">
      <PageHeader title="Issues" hint="Rooms out of sale and defects that housekeeping has reported." />

      <section className={card}>
        <div className="border-b border-ink/10 p-4">
          <h2 className="font-semibold">Rooms with an issue ({flagged.length})</h2>
          <p className="text-xs text-ink/60">
            Resetting sends a vacant room back to Dirty so it is cleaned before it is sold. A room kept out of sale by a repair is released when maintenance closes it.
          </p>
        </div>
        <ul className="divide-y divide-ink/10">
          {flagged.map((room) => (
            <li key={room.room} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <button type="button" onClick={() => openRoom(room.room)} className="font-bold hover:text-brand">
                  Room {room.room}
                </button>
                <p className="text-sm text-ink/60">{room.type} · {room.zone}</p>
                {room.reason && <p className="text-sm text-ink/70">Reason: {room.reason}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusChip status={room.status} />
                {hk.blockedByRepair(room.room) ? (
                  <span className="text-xs text-ink/60">Waiting for repair</span>
                ) : (
                  <button type="button" onClick={() => hk.resetRoom(room.room)} className={btnGhost}>Reset</button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {flagged.length === 0 && <Empty title="No rooms are out of sale" />}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 p-4">
          <div>
            <h2 className="font-semibold">Defects</h2>
            <p className="text-xs text-ink/60">Report a problem from a room&apos;s detail panel. Maintenance closes the repair.</p>
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(0)
            }}
            className={`${field} w-auto! py-2`}
          >
            <option>{OPEN}</option>
            <option>Open</option>
            <option>Maintenance Requested</option>
            <option>In Progress</option>
            <option>Done</option>
            <option>Resolved</option>
            <option>All</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Defect</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reported</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {shown.map(({ room, defect }) => (
                <tr key={`${room}-${defect.id}`} className="hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => openRoom(room, 'defects')} className="font-semibold hover:text-brand">
                      {room}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{defect.category}</p>
                    <p className="max-w-xs truncate text-xs text-ink/60">{defect.description}</p>
                  </td>
                  <td className="px-4 py-3">{defect.severity}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${defectStatusStyles[defect.status]}`}>{defect.status}</span>
                    {defect.technician && <p className="mt-1 text-xs text-ink/60">With {defect.technician}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{defect.reportedAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {defect.status === 'Open' && (
                        <button type="button" onClick={() => hk.requestMaintenance(room, defect.id)} className={btnGhost}>
                          Request maintenance
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {defects.length === 0 && <Empty title="No defects here" />}
        <Pager page={page} total={defects.length} onPage={setPage} noun="defects" />
      </section>

      {overlays}
    </div>
  )
}