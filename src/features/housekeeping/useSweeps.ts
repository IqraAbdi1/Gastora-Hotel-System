import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import type { Sweep } from '../../lib/discrepancy'
import { useFeatures } from '../platform/featuresContext'

// Room checks, kept per hotel. The walk belongs to one property: two hotels in a group check their own
// corridors, and a sleeper found in one is nothing to do with the other.
const SWEEPS = 'gastora:hotel:roomChecks'

type ByTenant<T> = Record<string, T>

const byTenant = <T,>(stored: unknown): ByTenant<T> =>
  stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as ByTenant<T>) : {}

export function useSweeps() {
  const { tenant } = useFeatures()
  const [stored, setStored] = useBrowserSyncedState<ByTenant<Sweep[]>>(SWEEPS, {})
  const all = byTenant<Sweep[]>(stored)
  const sweeps = all[tenant.id] ?? []

  const write = (next: Sweep[]) => setStored({ ...all, [tenant.id]: next })

  return {
    sweeps,
    /** The walk somebody is in the middle of, if any. One at a time: two at once would disagree. */
    open: sweeps.find((s) => !s.finishedIso),
    start: (sweep: Sweep) => write([sweep, ...sweeps]),
    save: (sweep: Sweep) => write(sweeps.map((s) => (s.id === sweep.id ? sweep : s))),
  }
}
