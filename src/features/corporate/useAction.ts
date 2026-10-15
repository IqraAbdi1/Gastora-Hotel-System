import { useState } from 'react'

// Runs a service call and keeps track of "saving" and of the error message to show if it fails.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>, onDone?: () => void) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, error, setError }
}
