import { useState } from 'react'
import { Button, Field, Modal, Segmented, Select, Textarea } from '../../components/ui'
import { useAssets } from '../assets/useAssets'
import { useFeatures } from '../platform/featuresContext'
import { useHousekeeping } from './hkContext'
import type { BlockKind } from './hkContext'
import { defectCategories } from './hkModel'
import { clock, uid } from './hkModel'
import type { RoomDefect } from './hkModel'
import { useAuth } from '../auth/authContext'
import { TODAY } from '../../data/sample'
import { MAX_DEFECT_PHOTOS } from '../../lib/roomPhotos'
import type { RoomPhoto } from '../../lib/roomPhotos'
import { PhotoThumbs, TakePhotoButton } from './RoomPhotos'

type Kind = 'broken' | 'discrepancy'
type Sell = 'yes' | 'no'

// One place to report a problem with a room: something broken, or a status that does not match.
export default function IssueDialog({ roomNumber, onClose }: { roomNumber: string; onClose: () => void }) {
  const hk = useHousekeeping()
  const { features } = useFeatures()
  const { assets } = useAssets()
  const [kind, setKind] = useState<Kind>('broken')
  const [category, setCategory] = useState('General')
  const [severity, setSeverity] = useState<RoomDefect['severity']>('Medium')
  const [text, setText] = useState('')
  const [sell, setSell] = useState<Sell>('yes')
  const [assetId, setAssetId] = useState('')
  const [block, setBlock] = useState<BlockKind>('out-of-order')
  const [photos, setPhotos] = useState<RoomPhoto[]>([])
  // Set when the problem was saved but its photos could not be kept. The dialog stays open to say so.
  const [warning, setWarning] = useState('')
  const { user } = useAuth()
  const me = user?.staffName ?? user?.name ?? 'Housekeeping'
  const room = hk.rooms.find((r) => r.room === roomNumber)
  if (!room) return null

  // A room with a guest in it can be reported, but it cannot be taken out of sale from here.
  const occupied = room.status === 'Occupied'
  // Only the equipment in this room, so the list is short enough to pick from on a phone.
  const roomAssets = assets.filter((a) => a.room === roomNumber && a.state === 'in service')
  const blocks = kind === 'broken' && !occupied && sell === 'no'
  const blockKind: BlockKind = features.maintenanceFull ? block : 'out-of-order'

  function save() {
    if (!text.trim()) return
    if (kind === 'discrepancy') hk.setException(roomNumber, 'discrepancy', text)
    else {
      const problem = hk.reportDefect(roomNumber, {
        category,
        severity,
        description: text,
        blocksRoom: blocks ? blockKind : undefined,
        assetId: assetId || undefined,
        photos,
      })
      if (problem) {
        setWarning(problem)
        return
      }
    }
    onClose()
  }

  return (
    <Modal
      title="Report a problem"
      description={`Room ${room.room} · ${room.type} · ${room.zone}`}
      onClose={onClose}
      footer={
        warning ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!text.trim()}>
              Save
            </Button>
          </>
        )
      }
    >
      {warning ? (
        <p role="alert" className="rounded-lg bg-warn/10 p-3 text-sm text-ink">
          {warning}
        </p>
      ) : (
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

              {features.assetRegister && roomAssets.length > 0 && (
                <Field
                  label="Which piece of equipment"
                  hint="Adds the repair to its record."
                >
                  {(id) => (
                    <Select id={id} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                      <option value="">Not a particular machine</option>
                      {roomAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.tag} · {a.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}

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

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink/80">
                    Photos <span className="font-normal text-ink/55">(optional, up to {MAX_DEFECT_PHOTOS})</span>
                  </p>
                  <TakePhotoButton
                    label={photos.length ? 'Add another' : 'Take a photo'}
                    disabled={photos.length >= MAX_DEFECT_PHOTOS}
                    onPhoto={(src) =>
                      setPhotos((current) =>
                        current.length >= MAX_DEFECT_PHOTOS
                          ? current
                          : [...current, { id: uid(), src, by: me, day: TODAY, time: clock() }],
                      )
                    }
                  />
                </div>
                {photos.length > 0 && (
                  <div className="mt-2">
                    <PhotoThumbs
                      photos={photos}
                      alt="Photo of the problem"
                      onRemove={(i) => setPhotos((current) => current.filter((_, j) => j !== i))}
                    />
                  </div>
                )}
              </div>

              {occupied ? (
                <p className="rounded-lg bg-canvas p-3 text-sm text-ink/70">
                  Occupied rooms cannot be taken out of sale here.
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
            <Field label="Reason" required hint="Desk and housekeeping must agree.">
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
      )}
    </Modal>
  )
}
