import { useState } from 'react'
import { useRequests } from '../procurement/requestsContext'
import { REVERSAL_MIN_SAMPLE, formatUGX } from '../procurement/requestsModel'

/** Whole numbers only. Empty or text gives null. */
const num = (s: string) => {
  const t = s.replace(/[,\s]/g, '')
  return /^\d+$/.test(t) ? parseInt(t, 10) : null
}

export default function LossSettingsDialog({ onClose }: { onClose: () => void }) {
  const { lossLimit, setLossLimit, reversalAlert, setReversalAlert } = useRequests()
  const [limit, setLimit] = useState(String(lossLimit))
  const [flag, setFlag] = useState(String(reversalAlert))
  const [error, setError] = useState('')

  const limitNow = num(limit)

  function save() {
    const a = num(limit)
    const b = num(flag)
    if (a === null) {
      setError('Enter the approval limit as a number. Use 0 for never wait.')
      return
    }
    if (b === null || b > 100) {
      setError('Enter the reversal flag as a number from 0 to 100.')
      return
    }
    const problem = setLossLimit(a) ?? setReversalAlert(b)
    if (problem) {
      setError(problem)
      return
    }
    onClose()
  }

  const field = 'mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4">
      <div className="my-10 w-full max-w-md space-y-4 rounded-xl bg-surface p-5">
        <div>
          <h2 className="text-lg font-bold">Write-off rules</h2>
          <p className="text-sm text-ink/60">Only the owner and hotel admin can change these.</p>
        </div>

        <label className="block text-sm font-medium">
          Approval limit for one write-off (UGX)
          <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" className={field} />
          <span className="mt-1 block text-xs font-normal text-ink/60">
            {limitNow === 0
              ? 'Every write-off is posted at once and reviewed later.'
              : limitNow === null
                ? 'Enter a number.'
                : `A single write-off above ${formatUGX(limitNow)} waits for the general manager before stock changes.`}
          </span>
        </label>

        <label className="block text-sm font-medium">
          Reversal flag (% of the month's write-offs)
          <input value={flag} onChange={(e) => setFlag(e.target.value)} inputMode="numeric" className={field} />
          <span className="mt-1 block text-xs font-normal text-ink/60">
            The owner sees a red flag when more than this share of the month's write-offs are reversed. 0 turns it off. It
            needs at least {REVERSAL_MIN_SAMPLE} write-offs in the month and never blocks anyone.
          </span>
        </label>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-ink/20 px-4 py-2 text-sm font-medium text-ink/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white"
          >
            Save rules
          </button>
        </div>
      </div>
    </div>
  )
}