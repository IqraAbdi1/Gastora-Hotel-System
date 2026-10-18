import { useState } from 'react'
import { Button, Field, Input, Modal } from '../../components/ui'
import { ugx } from '../../lib/format'
import { SHARE_NOTE } from '../../lib/sharing'
import type { Reservation } from '../../types'

// A second guest in the same room, with a bill of their own.
export default function ShareDialog({
  reservation: r,
  onClose,
  onAdd,
}: {
  reservation: Reservation
  onClose: () => void
  onAdd: (guest: string, phone: string, splitRoom: boolean) => void
}) {
  const [guest, setGuest] = useState('')
  const [phone, setPhone] = useState('')
  const [splitRoom, setSplitRoom] = useState(true)

  return (
    <Modal
      title={`Somebody sharing room ${r.room}`}
      description={`With ${r.guest}, ${r.arrival} to ${r.departure}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={guest.trim().length < 2} onClick={() => onAdd(guest, phone, splitRoom)}>
            Add them to the room
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Guest name" required>{(id) => <Input id={id} value={guest} onChange={(e) => setGuest(e.target.value)} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      </div>
      <div className="mt-4 space-y-2">
        <label className="flex items-start gap-2 text-sm text-ink/80">
          <input type="radio" className="mt-1" checked={splitRoom} onChange={() => setSplitRoom(true)} />
          <span>
            <span className="font-medium">Divide the room between them</span>
            <span className="block text-xs text-ink/60">{SHARE_NOTE.split} Each side becomes {ugx(Math.round(r.total / 2))}.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink/80">
          <input type="radio" className="mt-1" checked={!splitRoom} onChange={() => setSplitRoom(false)} />
          <span>
            <span className="font-medium">{r.guest} carries the room</span>
            <span className="block text-xs text-ink/60">{SHARE_NOTE.primary}</span>
          </span>
        </label>
      </div>
      <p className="mt-3 text-xs text-ink/55">
        The room is counted once, not twice: the second booking holds no room of its own, so the hotel does not think it has sold a room it
        still has. Each guest checks out on their own bill.
      </p>
    </Modal>
  )
}
