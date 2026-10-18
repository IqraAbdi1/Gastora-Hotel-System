import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { DEFAULT_CHANNELS } from '../../lib/channels'
import type { Channel, Push } from '../../lib/channels'

// Channels and the push log, kept beside the hotel's other records. No provider: the browser-synced
// hook already keeps every component that calls this in step, within the tab and across tabs.
const CHANNELS = 'gastora:hotel:channels'
const PUSHES = 'gastora:hotel:channelPushes'

export function useChannels() {
  const [channels, setChannels] = useBrowserSyncedState<Channel[]>(CHANNELS, DEFAULT_CHANNELS)
  const [pushes, setPushes] = useBrowserSyncedState<Push[]>(PUSHES, [])
  return { channels, setChannels, pushes, setPushes }
}
