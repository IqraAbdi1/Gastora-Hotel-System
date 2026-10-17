import { Fragment, useMemo, useState } from 'react'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import { defectPriority, defectStatusStyles, defectTarget, priorityRank, technicians } from '../housekeeping/hkModel'
import { Empty, PAGE, PageHeader, Pager, PriorityChip, btnGhost, btnPrimary, card, field } from '../housekeeping/hkUi'
import { useRoomOverlays } from '../housekeeping/useRoomOverlays'

const ACTIVE = 'Active'

export default function WorkOrdersPage() {
  const hk = useHousekeeping()
  const { features } = useFeatures()
  const { overlays, openRoom, reportIssue } = useRoomOverlays()
  const [status, setStatus] = useState(ACTIVE)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [roomNo, setRoomNo] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const full = features.maintenanceFull
  const knownRoom = hk.rooms.some((r) => r.room === roomNo.trim())

  // Defects that have reached maintenance. "Open" ones are still with the housekeeping supervisor.
  const orders = useMemo(() => {
    const s = search.trim().toLowerCase()
    return hk.allDefects
      .filter(({ defect }) => defect.status !== 'Open')
      .filter(({ defect }) => (status === ACTIVE ? defect.status !== 'Resolved' : defect.status === status))
      .filter(
        ({ room, defect }) =>
          !s || room.includes(s) || defect.category.toLowerCase().includes(s) || defect.description.toLowerCase().includes(s),
      )
      .sort(
        (a, b) =>
          priorityRank[defectPriority(a.defect)] - priorityRank[defectPriority(b.defect)] || a.room.localeCompare(b.room),
      )
  }, [hk.allDefects, status, search])
  const shown = orders.slice(page * PAGE, page * PAGE + PAGE)
  const waiting = hk.allDefects.filter((d) => d.defect.status === 'Open').length

  function reject(room: string, id: number) {
    if (!note.trim()) return
    hk.verifyDefect(room, id, false, note)
    setRejecting(null)
    setNote('')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work orders"
        hint={
          full
            ? 'Repairs reported by housekeeping and the front desk. Rule: priority comes from how serious it is, and whether the room is out of sale.'
            : 'Things that need fixing. Mark each one done when it is fixed.'
        }
      />

      <div className={`${card} flex flex-wrap items-center gap-2 p-4`}>
        <input
          value={roomNo}
          onChange={(e) => setRoomNo(e.target.value)}
          placeholder="Room number"
          className={`${field} w-40! py-2`}
        />
        <button type="button" disabled={!knownRoom} onClick={() => reportIssue(roomNo.trim())} className={btnPrimary}>
          Report a problem
        </button>
        {roomNo.trim() && !knownRoom && <span className="text-xs text-ink/60">No such room.</span>}
        {full && waiting > 0 && (
          <span className="ml-auto text-xs text-ink/60">
            {waiting} reported problem{waiting === 1 ? '' : 's'} waiting for a housekeeping supervisor to send them here.
          </span>
        )}
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 p-4">
          <h2 className="font-semibold">Repairs</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Search a room or problem"
              className={`${field} w-56! py-2`}
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(0)
              }}
              className={`${field} w-auto! py-2`}
            >
              <option>{ACTIVE}</option>
              <option>Maintenance Requested</option>
              <option>In Progress</option>
              {features.repairSignoff && <option>Done</option>}
              <option>Resolved</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="border-b border-ink/10 bg-canvas text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Problem</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {full && <th className="px-4 py-3 font-semibold">Technician</th>}
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {shown.map(({ room, defect }) => {
                const key = `${room}-${defect.id}`
                const priority = defectPriority(defect)
                return (
                  <Fragment key={key}>
                    <tr className="hover:bg-canvas/60">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => openRoom(room, 'defects')} className="font-semibold hover:text-brand">
                          {room}
                        </button>
                        {defect.blocksRoom && <p className="text-xs font-medium text-orange-700">Room out of sale</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{defect.category}</p>
                        <p className="max-w-xs text-xs text-ink/60">{defect.description}</p>
                        {defect.note && <p className="max-w-xs text-xs text-ink/50">{defect.note}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <PriorityChip priority={priority} />
                        {full && defect.status !== 'Resolved' && (
                          <p className="mt-1 text-xs text-ink/50">Target: {defectTarget[priority]}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${defectStatusStyles[defect.status]}`}>
                          {defect.status}
                        </span>
                      </td>
                      {full && (
                        <td className="px-4 py-3">
                          {defect.status === 'Resolved' ? (
                            <span className="text-ink/60">{defect.technician ?? '—'}</span>
                          ) : (
                            <select
                              value={defect.technician ?? 'Unassigned'}
                              onChange={(e) => hk.assignDefect(room, defect.id, e.target.value)}
                              className={`${field} w-auto! py-1.5`}
                            >
                              {technicians.map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {defect.status === 'Maintenance Requested' &&
                            (full ? (
                              <button type="button" onClick={() => hk.startDefect(room, defect.id)} className={btnPrimary}>
                                Start
                              </button>
                            ) : (
                              <button type="button" onClick={() => hk.finishDefect(room, defect.id)} className={btnPrimary}>
                                Done
                              </button>
                            ))}
                          {defect.status === 'In Progress' && (
                            <button type="button" onClick={() => hk.finishDefect(room, defect.id)} className={btnPrimary}>
                              Done
                            </button>
                          )}
                          {defect.status === 'Done' && (
                            <>
                              <button type="button" onClick={() => hk.verifyDefect(room, defect.id, true, '')} className={btnPrimary}>
                                Verified
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejecting(rejecting === key ? null : key)
                                  setNote('')
                                }}
                                className={btnGhost}
                              >
                                Reopen
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {rejecting === key && (
                      <tr>
                        <td colSpan={full ? 6 : 5} className="bg-canvas px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="What is still wrong? (required)"
                              className={field}
                              autoFocus
                            />
                            <button type="button" onClick={() => reject(room, defect.id)} disabled={!note.trim()} className={btnPrimary}>
                              Send back
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <Empty title="No repairs here" hint="Problems reported from a room appear here when they reach maintenance." />
        )}
        <Pager page={page} total={orders.length} onPage={setPage} noun="repairs" />
      </section>

      {overlays}
    </div>
  )
}