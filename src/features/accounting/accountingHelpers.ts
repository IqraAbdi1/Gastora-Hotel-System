import { useState } from 'react'
import type { Tone } from '../../components/ui'
import type { JournalStatus } from '../../services/accounting/accountingTypes'

// Helpers shared by the accounting pages.

export const JOURNAL_TONE: Record<JournalStatus, Tone> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'good',
  rejected: 'bad',
  void: 'neutral',
}

export const JOURNAL_LABEL: Record<JournalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  void: 'Void',
}

/** Runs a service call and keeps track of "busy" and of the error to show if it fails. */
export function useRun() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(fn: () => Promise<unknown>, onDone?: () => void): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone?.()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, error, setError }
}

export const shortDate = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''

export const stampOf = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

/** Roles that may change accounting set-up (rules, rates, settings). The service checks it again. */
export const FINANCE_SETUP = ['owner', 'admin', 'finance']
