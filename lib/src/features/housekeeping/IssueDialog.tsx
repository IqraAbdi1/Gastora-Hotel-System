import { useState } from 'react'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from './hkContext'
import type { BlockKind } from './hkContext'
import { defectCategories } from './hkModel'
import type { RoomDefect } from './hkModel'
import { Modal, btnGhost, btnPrimary, field } from './hkUi'

type Kind = 'broken' | 'discrepancy'

// One place to report a problem with a room: something broken, or a status that does not match.
export default function IssueDialog({ roomNumber, onClose }: { roomNumber: string; onClose: () => void }) {
  const hk = useHousekeeping()
  const { features } = useFeatures()
  const [kind, setKind] = useState<Kind>('broken')
  const [category, setCategory] = useState('General')
  const [severity, setSeverity] = useState<RoomDefect['severity']>('Medium')
  const [text, setText] = useState('')
  const [canSell, setCanSell] = useState(true)
  const [block, setBlock] = useState<BlockKind>('out-of-order')
  const room = hk.rooms.find((r) => r.room === roomNumber)
  if (!room) return null

  // A room with a guest in it can be reported, but it cannot be taken out of sale from here.
  const occupied = room.status === 'Occupied'
  const blocks = kind === 'broken' && !occupied && !canSell
  const blockKind: BlockKind = features.maintenanceFull ? block : 'out-of-order'

  function save() {
    if (!text.trim()) return
    if (kind === 'discrepancy') hk.setException(roomNumber, 'discrepancy', text)
    else hk.reportDefect(roomNumber, { category, severity, description: text, blocksRoom: blocks ? blockKind : undefined })
    onClose()
  }

  const tab = (k: Kind, label: string) => (
    <button
      type="button"
      onClick={() => setKind(k)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
        kind === k ? 'bg-brand text-white' : 'border border-ink/15 text-ink hover:bg-canvas'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Modal onClose={onClose} label="Report a problem">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <p className="text-sm font-medium text-ink/60">Room {room.room}</p>
        <h2 className="mt-1 text-xl font-bold">Report a problem</h2>

        <div className="mt-4 flex gap-2">
          {tab('broken', 'Something is broken')}
          {tab('discrepancy', 'Status is wrong')}
        </div>

        <div className="mt-5 space-y-4">
          {kind === 'broken' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="defect-category" className="mb-1 block text-sm font-medium">What is it</label>
                  <select id="defect-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                    {defectCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="defect-severity" className="mb-1 block text-sm font-medium">How serious</label>
                  <select
                    id="defect-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as RoomDefect['severity'])}
                    className={field}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="issue-text" className="mb-1 block text-sm font-medium">What is wrong</label>
                <textarea
                  id="issue-text"
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="For example: the AC does not cool."
                  className={`${field} resize-none`}
                />
              </div>

              {occupied ? (
                <p className="text-sm text-ink/60">
                  A guest is in this room, so it cannot be taken out of sale from here. Moving the guest is a front desk action.
                </p>
              ) : (
                <div>
                  <p className="mb-1 text-sm font-medium">Can the room still be sold?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCanSell(true)}
                      className={`rounded-lg px-4 py-1.5 text-sm ${canSell ? 'bg-brand text-white' : 'border border-ink/15 hover:bg-canvas'}`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanSell(false)}
                      className={`rounded-lg px-4 py-1.5 text-sm ${!canSell ? 'bg-brand text-white' : 'border border-ink/15 hover:bg-canvas'}`}
                    >
                      No
                    </button>
                  </div>
                  {!canSell && features.maintenanceFull && (
                    <select value={block} onChange={(e) => setBlock(e.target.value as BlockKind)} className={`${field} mt-2`}>
                      <option value="out-of-order">Out of Order: removed from sale until fixed</option>
                      <option value="out-of-service">Out of Service: a short block</option>
                    </select>
                  )}
                  <p className="mt-2 text-xs text-ink/60">
                    {!canSell
                      ? 'The room leaves sale now and any open cleaning task is cancelled. It goes to maintenance, and the room is cleaned and released when the repair is done.'
                      : features.maintenanceFull
                        ? 'A housekeeping supervisor sends it on to maintenance.'
                        : 'It goes straight to the maintenance list.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div>
              <label htmlFor="issue-text" className="mb-1 block text-sm font-medium">Reason</label>
              <textarea
                id="issue-text"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="For example: luggage found in a room marked vacant."
                className={`${field} resize-none`}
              />
              <p className="mt-2 text-xs text-ink/60">The front desk and housekeeping must agree before this room can be sold.</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            <button type="button" onClick={save} disabled={!text.trim()} className={btnPrimary}>Save</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}