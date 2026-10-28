import { useCallback, useEffect, useMemo, useState } from 'react'
import { TODAY } from '../../data/sample'
import { workforceService } from '../../services'
import type { Actor } from '../../services/types'
import type { WorkforceSnapshot } from '../../services/workforce/workforceService'
import type { Department, StaffUser } from '../../services/workforce/workforceTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

/**
 * The people data of the hotel being shown, loaded from the workforce service and reloaded whenever it
 * changes. Also raises overdue tasks once a minute, by the hotel's own SLA settings.
 */
export function useWorkforce() {
  const { tenant, options } = useFeatures()
  const { user, role } = useAuth()
  const propertyId = tenant.id
  const [data, setData] = useState<WorkforceSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    workforceService
      .load(propertyId)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load staff data'))
  }, [propertyId])

  useEffect(() => {
    reload()
    return workforceService.subscribe(reload)
  }, [reload])

  const rule = useMemo(() => ({ on: options.sla.on, secondStepAt: options.sla.secondStepAt }), [options.sla.on, options.sla.secondStepAt])
  useEffect(() => {
    const tick = () => void workforceService.runEscalations(propertyId, rule, Date.now())
    tick()
    const id = window.setInterval(tick, 60000)
    return () => window.clearInterval(id)
  }, [propertyId, rule])

  const actor: Actor = useMemo(() => ({ id: user?.id ?? 'anon', name: user?.name ?? 'Unknown' }), [user])

  const maps = useMemo(() => {
    const staffById = new Map<string, StaffUser>((data?.staff ?? []).map((u) => [u.id, u]))
    const deptById = new Map<string, Department>((data?.departments ?? []).map((d) => [d.id, d]))
    return { staffById, deptById }
  }, [data])

  // Who may do what on these pages. The backend checks the same.
  const roleId = role?.id
  const perms = {
    manageStaff: roleId === 'owner' || roleId === 'admin' || roleId === 'gm',
    editRoster: roleId === 'owner' || roleId === 'admin' || roleId === 'gm' || roleId === 'hkhead',
    approve: roleId === 'owner' || roleId === 'gm',
    sendPayroll: roleId === 'owner' || roleId === 'admin' || roleId === 'gm' || roleId === 'finance',
  }

  return {
    data,
    error,
    propertyId,
    actor,
    today: TODAY,
    name: (id?: string) => (id ? maps.staffById.get(id)?.fullName ?? 'Unknown' : 'Nobody'),
    dept: (id?: string) => (id ? maps.deptById.get(id)?.name ?? '—' : '—'),
    ...maps,
    perms,
    reload,
  }
}

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
