import { useState } from 'react'
import { dayMonth } from '../../lib/format'
import { useHousekeeping } from './hkContext'
import { defectStatusStyles, isActive, taskStatusStyles } from './hkModel'
import type { TabKey } from './hkModel'
import { Modal, PriorityChip, StatusChip, btnGhost, btnPrimary, card } from './hkUi'

export default function RoomDetailPanel({
  roomNumber,
  onClose,
  onIssue,
  startTab = 'overview',
}: {
  roomNumber: string
  onClose: () => void
  onIssue: (room: string) => void
  startTab?: TabKey
}) {
  const hk = useHousekeeping()
  const [tab, setTab] = useState<TabKey>(startTab)

  const room = hk.rooms.find((r) => r.room === roomNumber)
  if (!room) return null
  const details = hk.detailsOf(roomNumber)
  const stay = hk.stayOf(roomNumber)
  const task = hk.tasks.find((t) => t.room === roomNumber && isActive(t))
  const openDefects = details.defects.filter((d) => d.status !== 'Resolved').length

  const tabs: [TabKey, string][] = [
    ['overview', 'Overview'],
    ['minibar', 'Minibar'],
    ['linen', 'Linen'],
    ['defects', `Defects (${openDefects})`],
    ['history', 'History'],
  ]

  return (
    <Modal side onClose={onClose} label={`Room ${room.room} details`}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink/10 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Room details</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">Room {room.room}</h2>
              <StatusChip status={room.status} />
              <PriorityChip priority={room.priority} />
            </div>
            <p className="mt-1 text-sm text-ink/60">
              {room.type} · {room.zone}
              {room.arrival && ` · ${room.arrival}`}
            </p>
            {room.reason && <p className="mt-1 text-sm text-purple-700">Reason: {room.reason}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-xl text-ink/50 hover:bg-canvas">
            ×
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-ink/10 px-3">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
                tab === key ? 'border-brand text-brand' : 'border-transparent text-ink/60 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {tab === 'overview' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Occupancy', stay ? 'Occupied' : 'Vacant'],
                  ['Guest', stay ? stay.guest : '—'],
                  ['Reservation', stay ? `${stay.id} · until ${dayMonth(stay.departure)}` : '—'],
                  ['Last cleaned', details.lastCleaned],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-ink/10 bg-canvas p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>

              <div className={`${card} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Inspection</h3>
                  <span className="text-xs text-ink/60">
                    {details.inspectedBy === '—' ? 'Pending' : `By ${details.inspectedBy}`}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink/70">{details.inspectionNote}</p>
              </div>

              <div className={`${card} p-4`}>
                <h3 className="font-semibold">Current task</h3>
                {task ? (
                  <div className="mt-2 rounded-lg bg-canvas p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{task.type}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${taskStatusStyles[task.status]}`}>
                        {task.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink/60">
                      {task.attendant} · Due {task.dueTime}
                    </p>
                    {task.notes && <p className="mt-1 text-sm text-ink/70">{task.notes}</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ink/60">No active task for this room.</p>
                )}
              </div>

              <div className={`${card} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Room photos</h3>
                    <p className="text-sm text-ink/60">Placeholders until photo upload is connected.</p>
                  </div>
                  <button type="button" onClick={() => hk.addPhoto(roomNumber)} className={btnGhost}>
                    + Add photo
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {details.photos.map((photo, i) => (
                    <div
                      key={`${photo}-${i}`}
                      className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-ink/20 bg-canvas text-sm text-ink/60"
                    >
                      {photo}
                    </div>
                  ))}
                  {details.photos.length === 0 && <p className="text-sm text-ink/60">No photos captured.</p>}
                </div>
              </div>
            </>
          )}

          {tab === 'minibar' && (
            <div className={card}>
              <div className="border-b border-ink/10 p-4">
                <h3 className="font-semibold">Minibar capture</h3>
                <p className="text-sm text-ink/60">Record what was used. It will post to the folio once billing is linked.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas text-xs uppercase tracking-wide text-ink/50">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Stocked</th>
                      <th className="px-4 py-3">Used</th>
                      <th className="px-4 py-3">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {details.minibar.map((item, i) => (
                      <tr key={item.name}>
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-ink/70">{item.quantity}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min={0}
                            max={item.quantity}
                            value={item.used}
                            onChange={(e) => hk.setMinibarUsed(roomNumber, i, Number(e.target.value))}
                            className="w-20 rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold">{item.quantity - item.used}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'linen' && (
            <div className={card}>
              <div className="border-b border-ink/10 p-4">
                <h3 className="font-semibold">Linen capture</h3>
                <p className="text-sm text-ink/60">Confirm the quantities found while servicing the room.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas text-xs uppercase tracking-wide text-ink/50">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Expected</th>
                      <th className="px-4 py-3">Found</th>
                      <th className="px-4 py-3">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {details.linen.map((item, i) => {
                      const variance = item.found - item.expected
                      return (
                        <tr key={item.name}>
                          <td className="px-4 py-3 font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-ink/70">{item.expected}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              max={item.expected}
                              value={item.found}
                              onChange={(e) => hk.setLinenFound(roomNumber, i, Number(e.target.value))}
                              className="w-20 rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className={`px-4 py-3 font-semibold ${variance < 0 ? 'text-bad' : 'text-good'}`}>{variance}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'defects' && (
            <>
              <div className={`${card} flex items-center justify-between gap-3 p-4`}>
                <div>
                  <h3 className="font-semibold">Defects and maintenance</h3>
                  <p className="text-sm text-ink/60">Report a problem. Maintenance fixes it and closes it.</p>
                </div>
                <button type="button" onClick={() => onIssue(roomNumber)} className={btnPrimary}>
                  + Report a problem
                </button>
              </div>

              {details.defects.length === 0 && (
                <div className="rounded-xl border border-dashed border-ink/20 p-8 text-center">
                  <p className="font-medium">No defects recorded</p>
                </div>
              )}

              {details.defects.map((defect) => (
                <div key={defect.id} className={`${card} p-4`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{defect.category}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{defect.severity}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${defectStatusStyles[defect.status]}`}>
                          {defect.status}
                        </span>
                        {defect.blocksRoom && (
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">Room out of sale</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-ink/70">{defect.description}</p>
                      <p className="mt-1 text-xs text-ink/50">
                        Reported {defect.reportedAt}
                        {defect.technician && ` · With ${defect.technician}`}
                      </p>
                      {defect.note && <p className="mt-1 text-xs text-ink/60">{defect.note}</p>}
                    </div>
                    {defect.status === 'Open' && (
                      <button type="button" onClick={() => hk.requestMaintenance(roomNumber, defect.id)} className={btnGhost}>
                        Request maintenance
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'history' && (
            <div className={card}>
              <div className="border-b border-ink/10 p-4">
                <h3 className="font-semibold">Room history</h3>
                <p className="text-sm text-ink/60">What happened to this room in this session.</p>
              </div>
              {details.history.length === 0 && <p className="p-4 text-sm text-ink/60">Nothing recorded yet.</p>}
              <div className="divide-y divide-ink/10">
                {details.history.map((item) => (
                  <div key={item.id} className="grid gap-1 p-4 sm:grid-cols-[70px_160px_110px_1fr]">
                    <span className="text-xs font-medium text-ink/50">{item.time}</span>
                    <span className="font-semibold">{item.action}</span>
                    <span className="text-sm text-ink/60">{item.user}</span>
                    <span className="text-sm text-ink/70">{item.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink/10 px-5 py-3">
          <button type="button" onClick={onClose} className={btnGhost}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}