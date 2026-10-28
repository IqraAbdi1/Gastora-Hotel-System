import { useState } from 'react'
import IdPhotoInput from '../../components/IdPhotoInput'
import { Badge, Button, Field, Input, Select, Textarea } from '../../components/ui'
import { TODAY } from '../../data/sample'
import { LOST_CATEGORIES, isValuable } from '../../lib/lostFound'
import { useHotel } from '../../lib/hotelContext'
import { useAuth } from '../auth/authContext'
import { useLostFound } from './lostFoundContext'

const PLACES = ['Restaurant', 'Bar', 'Reception', 'Pool', 'Gym', 'Car park', 'Corridor', 'Conference room', 'Other']

// Housekeeping logs something they picked up. Where and when it was found is what lets the front desk
// check a guest's claim later, so both are required.
export default function LogItemDialog({ room: fixedRoom, onClose }: { room?: string; onClose: () => void }) {
  const { addItem } = useLostFound()
  const { rooms } = useHotel()
  const { user } = useAuth()

  // Opened from the room she is cleaning: the room is already known and cannot be mistyped.
  const [inRoom, setInRoom] = useState(true)
  const [room, setRoom] = useState(fixedRoom ?? '')
  const [place, setPlace] = useState(PLACES[0])
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(LOST_CATEGORIES[0])
  const [where, setWhere] = useState('')
  const [on, setOn] = useState(TODAY)
  const [photo, setPhoto] = useState<string | undefined>()
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState<string | null>(null)

  const valuable = isValuable(category)
  const storedAt = valuable ? 'Front desk safe' : 'Housekeeping store'
  const foundIn = inRoom ? room.trim() : place
  const valid = description.trim() !== '' && foundIn !== '' && where.trim() !== ''

  function save() {
    if (!valid) return
    const created = addItem({
      description: description.trim(),
      category,
      foundIn,
      foundWhere: where.trim(),
      foundOn: on,
      foundBy: user?.name ?? 'Housekeeping',
      photo,
      storedAt,
      notes: notes.trim() || undefined,
    })
    setDone(created.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label="Log a found item">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-linear-to-r from-brand-deep to-brand p-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Housekeeping · Lost and found</p>
            <h2 className="text-lg font-semibold">Log something you found</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-white/90 hover:text-white">
            Close
          </button>
        </div>

        {done ? (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-good/30 bg-good/10 p-4">
              <p className="font-semibold text-good">Logged as {done}.</p>
              <p className="mt-1 text-sm text-ink/75">
                The front desk can see it now. Take it to the {storedAt.toLowerCase()}.
              </p>
            </div>
            <Button className="w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="What is it" required hint="Describe it as you see it. Do not open bags or wallets.">
                  {(id) => (
                    <Input
                      id={id}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Blue phone charger with a two-pin plug"
                    />
                  )}
                </Field>
                <Field label="Kind of item" required>
                  {(id) => (
                    <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                      {LOST_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-ink/80">Where did you find it?</p>
                <div className="flex gap-2">
                  {[
                    { key: true, label: 'In a room' },
                    { key: false, label: 'Somewhere else' },
                  ].map((o) => (
                    <button
                      key={String(o.key)}
                      type="button"
                      onClick={() => setInRoom(o.key)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                        inRoom === o.key ? 'bg-brand text-white' : 'border border-ink/15 text-ink hover:bg-canvas'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {inRoom ? (
                    <Field label="Room number" required>
                      {(id) => (
                        <Select id={id} value={room} onChange={(e) => setRoom(e.target.value)}>
                          <option value="">Choose a room</option>
                          {rooms.map((x) => (
                            <option key={x.number} value={x.number}>
                              Room {x.number} · {x.type}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  ) : (
                    <Field label="Place" required>
                      {(id) => (
                        <Select id={id} value={place} onChange={(e) => setPlace(e.target.value)}>
                          {PLACES.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}
                  <Field label="Exactly where" required hint="Under the bed, in the bathroom, under table 4.">
                    {(id) => <Input id={id} value={where} onChange={(e) => setWhere(e.target.value)} />}
                  </Field>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date found" required>
                  {(id) => <Input id={id} type="date" value={on} max={TODAY} onChange={(e) => setOn(e.target.value)} />}
                </Field>
                <Field label="Found by">{(id) => <Input id={id} value={user?.name ?? 'Housekeeping'} readOnly />}</Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-ink/80">Photo</p>
                <IdPhotoInput value={photo} onChange={setPhoto} />
                <p className="mt-1 text-xs text-ink/55">
                  Helps the desk match the item.
                </p>
              </div>

              <Field label="Anything else" hint="Only what the front desk needs to know.">
                {(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
              </Field>

              <div className={`rounded-xl border p-3 text-sm ${valuable ? 'border-warn/30 bg-warn/10' : 'border-ink/10 bg-canvas'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">Keep it in: {storedAt}</p>
                  {valuable && <Badge tone="warn">Valuable</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-ink/70">
                  {valuable
                    ? 'Rule: valuables go to the front desk safe and a manager must approve before they are handed over.'
                    : 'Rule: ordinary items are kept in the housekeeping store.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 p-4">
              <Button className="flex-1" onClick={save} disabled={!valid}>
                Log the item
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
