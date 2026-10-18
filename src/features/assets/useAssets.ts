import { useMemo } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { sampleAssets } from '../../lib/assets'
import type { Asset, MeterReading } from '../../lib/assets'
import { TODAY } from '../../data/sample'
import { useFeatures } from '../platform/featuresContext'

// The equipment register, kept per hotel. An owner with three properties has three generators, and a
// reading taken on one must never land on another.
const ASSETS = 'gastora:hotel:assets'

type ByTenant<T> = Record<string, T>

const byTenant = <T,>(stored: unknown): ByTenant<T> =>
  stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as ByTenant<T>) : {}

export function useAssets() {
  const { tenant } = useFeatures()
  const [stored, setStored] = useBrowserSyncedState<ByTenant<Asset[]>>(ASSETS, {})
  const all = byTenant<Asset[]>(stored)
  // The sample is built once, not on every render: it is the fallback until this hotel saves its own.
  const sample = useMemo(() => sampleAssets(TODAY), [])
  const assets = all[tenant.id] ?? sample

  const write = (next: Asset[]) => setStored({ ...all, [tenant.id]: next })

  return {
    assets,
    setAssets: write,
    save: (asset: Asset) =>
      write(assets.some((a) => a.id === asset.id) ? assets.map((a) => (a.id === asset.id ? asset : a)) : [asset, ...assets]),
    remove: (id: string) => write(assets.filter((a) => a.id !== id)),
    /** A reading is added to the asset, newest kept alongside the rest; the history is the point. */
    addReading: (id: string, reading: MeterReading) =>
      write(
        assets.map((a) =>
          a.id === id ? { ...a, readings: [...(a.readings ?? []), reading].sort((x, y) => y.takenOn.localeCompare(x.takenOn)) } : a,
        ),
      ),
  }
}
