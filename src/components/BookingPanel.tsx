import { useState } from 'react'
import { NewReservationForm } from '../features/frontdesk/NewReservationPage'
import type { BookingPreset } from '../lib/bookingContext'

// New booking and walk-in, in a window over the page, in the same style as check-in.
export default function BookingPanel({ preset, onClose }: { preset: BookingPreset; onClose: () => void }) {
  const [run, setRun] = useState(0)
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/40 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="New booking">
      <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-canvas shadow-2xl">
        <header className="flex items-center justify-between gap-3 bg-linear-to-r from-brand-deep to-brand px-4 py-3 text-white sm:px-6">
          <div>
            <p className="text-xs font-medium text-white/70">Front desk</p>
            <p className="text-lg font-bold tracking-tight">Booking</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Close
          </button>
        </header>
        <div className="p-4 sm:p-6">
          <NewReservationForm key={run} preset={preset} onClose={onClose} onAgain={() => setRun(run + 1)} />
        </div>
      </div>
    </div>
  )
}
