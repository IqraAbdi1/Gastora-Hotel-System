import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { DEFAULT_CHANNELS } from '../../lib/channels'
import type { Channel, Push } from '../../lib/channels'
import { useFeatures } from '../platform/featuresContext'

// Channels and the push log, kept per hotel.
//
// Per hotel matters: an owner with three properties sells each of them on different channels at
// different commissions, and a change to one must not quietly change the others. The store is keyed by
// the hotel, so switching hotels shows that hotel's channels and nothing else.
//
// No provider: the browser-synced hook already keeps every component that calls this in step, within
// the tab and across tabs.
const CHANNELS = 'gastora:hotel:channels'
const PUSHES = 'gastora:hotel:channelPushes'

type ByTenant<T> = Record<string, T>

/**
 * An earlier build kept one list for the whole demonstration, before an owner with several properties
 * made that wrong. A stored list is not a hotel's set-up any more, so it is left behind rather than
 * spread across hotels it was never meant for.
 */
const byTenant = <T,>(stored: unknown): ByTenant<T> =>
  stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as ByTenant<T>) : {}

export function useChannels() {
  const { tenant } = useFeatures()
  const [storedAll, setStoredAll] = useBrowserSyncedState<ByTenant<Channel[]>>(CHANNELS, {})
  const [storedPushes, setStoredPushes] = useBrowserSyncedState<ByTenant<Push[]>>(PUSHES, {})
  const all = byTenant<Channel[]>(storedAll)
  const allPushes = byTenant<Push[]>(storedPushes)
  const setAll = setStoredAll
  const setAllPushes = setStoredPushes

  const channels = all[tenant.id] ?? DEFAULT_CHANNELS
  const pushes = allPushes[tenant.id] ?? []

  return {
    channels,
    setChannels: (next: Channel[]) => setAll({ ...all, [tenant.id]: next }),
    pushes,
    setPushes: (next: Push[]) => setAllPushes({ ...allPushes, [tenant.id]: next }),
    /** Every hotel's channels, for the owner looking across a group. */
    allChannels: all,
    setFor: (tenantId: string, next: Channel[]) => setAll({ ...all, [tenantId]: next }),
  }
}
