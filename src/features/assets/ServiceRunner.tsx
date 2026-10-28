import { useEffect } from 'react'
import { TODAY } from '../../data/sample'
import { shouldRaise } from '../../lib/preventive'
import type { PlannedJob } from '../../lib/preventive'
import { useFeatures } from '../platform/featuresContext'
import { useAssets } from './useAssets'
import { usePreventive } from './usePreventive'

/**
 * The thing that remembers the servicing. It draws nothing: it looks at every plan, works out what has
 * fallen due, and puts the job on the list.
 *
 * Honest about where it runs: this is a prototype with no server, so it only acts while the app is open.
 * A real build runs the same rules on the server, where nobody has to leave a browser on.
 */
export default function ServiceRunner() {
  const { features } = useFeatures()
  const { assets } = useAssets()
  const { plans, jobs, raiseJobs } = usePreventive()

  useEffect(() => {
    if (!features.preventiveMaintenance) return
    const raised: PlannedJob[] = []
    for (const plan of plans) {
      const asset = assets.find((a) => a.id === plan.assetId)
      if (!asset) continue
      // Jobs raised a moment ago count too, or one pass could raise the same work twice.
      const job = shouldRaise(plan, asset, [...jobs, ...raised], TODAY)
      if (job) raised.push(job)
    }
    if (raised.length > 0) raiseJobs(raised)
  }, [features.preventiveMaintenance, plans, assets, jobs, raiseJobs])

  return null
}
