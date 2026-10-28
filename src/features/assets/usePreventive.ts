import { useMemo } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { planAfterDone, samplePlans } from '../../lib/preventive'
import type { PlannedJob, ServicePlan } from '../../lib/preventive'
import { TODAY } from '../../data/sample'
import { useFeatures } from '../platform/featuresContext'

// Service plans and the jobs they raise, kept per hotel like the register itself.
const PLANS = 'gastora:hotel:servicePlans'
const JOBS = 'gastora:hotel:plannedJobs'

type ByTenant<T> = Record<string, T>

const byTenant = <T,>(stored: unknown): ByTenant<T> =>
  stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as ByTenant<T>) : {}

export function usePreventive() {
  const { tenant } = useFeatures()
  const [storedPlans, setStoredPlans] = useBrowserSyncedState<ByTenant<ServicePlan[]>>(PLANS, {})
  const [storedJobs, setStoredJobs] = useBrowserSyncedState<ByTenant<PlannedJob[]>>(JOBS, {})
  const allPlans = byTenant<ServicePlan[]>(storedPlans)
  const allJobs = byTenant<PlannedJob[]>(storedJobs)

  const sample = useMemo(() => samplePlans(TODAY), [])
  const plans = allPlans[tenant.id] ?? sample
  const jobs = allJobs[tenant.id] ?? []

  const writePlans = (next: ServicePlan[]) => setStoredPlans({ ...allPlans, [tenant.id]: next })
  const writeJobs = (next: PlannedJob[]) => setStoredJobs({ ...allJobs, [tenant.id]: next })

  return {
    plans,
    jobs,
    savePlan: (plan: ServicePlan) =>
      writePlans(plans.some((p) => p.id === plan.id) ? plans.map((p) => (p.id === plan.id ? plan : p)) : [plan, ...plans]),
    removePlan: (id: string) => {
      writePlans(plans.filter((p) => p.id !== id))
      // An unfinished job from a plan nobody keeps any more is work nobody asked for.
      writeJobs(jobs.filter((j) => j.planId !== id || j.status === 'Done'))
    },
    raiseJobs: (raised: PlannedJob[]) => writeJobs([...raised, ...jobs]),
    setJob: (job: PlannedJob) => writeJobs(jobs.map((j) => (j.id === job.id ? job : j))),
    /**
     * Signing off a service does two things at once: it closes the job, and it moves the plan on from
     * the day the work was actually done. Done separately, one of them is eventually forgotten.
     */
    finishJob: (job: PlannedJob, doneOn: string, technician: string, reading?: number, note?: string) => {
      writeJobs(jobs.map((j) => (j.id === job.id ? { ...j, status: 'Done', doneOn, technician, doneAtReading: reading, note } : j)))
      const plan = plans.find((p) => p.id === job.planId)
      if (plan) writePlans(plans.map((p) => (p.id === plan.id ? planAfterDone(p, doneOn, reading) : p)))
    },
  }
}
