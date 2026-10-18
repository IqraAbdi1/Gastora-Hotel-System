import { useState } from 'react'
import { Button, Field, Modal, Segmented, Select, Textarea } from '../../components/ui'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from './hkContext'
import type { BlockKind } from './hkContext'
import { defectCategories } from './hkModel'
import type { RoomDefect } from './hkModel'

type Kind = 'broken' | 'discrepancy'
type Sell = 'yes' | 'no'

// One place to report a problem with a room: something broken, or a status that does not match.
export default function IssueDialog({ roomNumber, onClose }: { roomNumber: string; onClose: () => void }) {
  const hk = useHousekeeping()
  const { features } = useFeatures()
  const [kind, setKind] = useState<Kind>('broken')
  const [category, setCategory] = useState('General')
  const [severity, setSeverity] = useState<RoomDefect['severity']>('Medium')
  const [text, setText] = useState('')
  const [sell, setSell] = useState<Sell>('yes')
  const [block, setBlock] = useState<BlockKind>('out-of-order')
  const room = hk.rooms.find((r) => r.room === roomNumber)
  if (!room) return null

  // A room with a guest in it can be reported, but it cannot be taken out of sale from here.
  const occupied = room.status === 'Occupied'
  const blocks = kind === 'broken' && !occupied && sell === 'no'
  const blockKind: BlockKind = features.maintenanceFull ? block : 'out-of-order'

  function save() {
    if (!text.trim()) return
    if (kind === 'discrepancy') hk.setException(roomNumber, 'discrepancy', text)
    else hk.reportDefect(roomNumber, { category, severity, description: text, blocksRoom: blocks ? blockKind : undefined })
    onClose()
  }

  return (
    <Modal
      title="Report a problem"
      description={`Room ${room.room} · ${room.type} · ${room.zone}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!text.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          label="Kind of problem"
          value={kind}
          onChange={setKind}
          options={[
            { key: 'broken', label: 'Something is broken' },
            { key: 'discrepancy', label: 'Status is wrong' },
          ]}
        />

        {kind === 'broken' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="What is it">
                {(id) => (
                  <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                    {defectCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="How serious">
                {(id) => (
                  <Select
                    id={id}
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as RoomDefect['severity'])}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </Select>
                )}
              </Field>
            </div>

            <Field label="What is wrong" required>
              {(id) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="For example: the air conditioning does not cool."
                  className="resize-none"
                />
              )}
            </Field>

            {occupied ? (
              <p className="rounded-lg bg-canvas p-3 text-sm text-ink/70">
                A guest is in this room, so it cannot be taken out of sale from here. Moving the guest is a front desk
                action.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink/80">Can the room still be sold?</p>
                <Segmented
                  label="Can the room still be sold"
                  value={sell}
                  onChange={setSell}
                  options={[
                    { key: 'yes', label: 'Yes' },
                    { key: 'no', label: 'No' },
                  ]}
                />
                {sell === 'no' && features.maintenanceFull && (
                  <Select value={block} onChange={(e) => setBlock(e.target.value as BlockKind)} aria-label="How it is blocked">
                    <option value="out-of-order">Out of order: removed from sale until fixed</option>
                    <option value="out-of-service">Out of service: a short block</option>
                  </Select>
                )}
                <p className="text-xs text-ink/60">
                  {sell === 'no'
                    ? 'The room leaves sale now and any open cleaning task is cancelled. It goes to maintenance, and the room is cleaned and released when the repair is done.'
                    : features.maintenanceFull
                      ? 'A housekeeping supervisor sends it on to maintenance.'
                      : 'It goes straight to the maintenance list.'}
                </p>
              </div>
            )}
          </>
        ) : (
          <Field label="Reason" required hint="The front desk and housekeeping must agree before this room can be sold.">
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="For example: luggage found in a room marked vacant."
                className="resize-none"
              />
            )}
          </Field>
        )}
      </div>
    </Modal>
  )
}
