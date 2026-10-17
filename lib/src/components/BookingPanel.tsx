import { useState } from 'react'
import { NewReservationForm } from '../features/frontdesk/NewReservationPage'
import type { BookingPreset } from '../lib/bookingContext'

export default function BookingPanel({ preset, onClose }: { preset: BookingPreset; onClose: () => void }) {
  const [run, setRun] = useState(0)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-y-auto bg-canvas p-4 shadow-xl">
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-brand">
            Close
          </button>
        </div>
        <NewReservationForm key={run} preset={preset} onClose={onClose} onAgain={() => setRun(run + 1)} />
      </div>
    </div>
  )
}