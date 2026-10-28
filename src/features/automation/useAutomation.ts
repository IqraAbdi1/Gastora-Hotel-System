import { useEffect, useMemo, useRef, useState } from 'react'
import { TODAY } from '../../data/sample'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { useHotel } from '../../lib/hotelContext'
import { useNow } from '../../lib/useNow'
import { automationService } from '../../services'
import type { AutomationSnapshot } from '../../services/automation/automationModels'
import type { AutomationActor } from '../../services/automation/automationService'
import { useApprovals } from '../approvals/approvalsContext'
import { useAuth } from '../auth/authContext'
import { useFeedback } from '../feedback/useFeedback'
import { useHousekeeping } from '../housekeeping/hkContext'
import { useFeatures } from '../platform/featuresContext'
import { useRequests } from '../procurement/requestsContext'
import { POS_STORAGE_KEYS } from '../pos/posTypes'
import type { HeldOrder, Product, Sale } from '../pos/posTypes'

/** Loads from the automation service and loads again whenever it changes. */
export function useAutomationData<T>(load: () => Promise<T>, fallback: T, deps: unknown[]) {
  const [data, setData] = useState<T>(fallback)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const latest = useRef(load)
  useEffect(() => {
    latest.current = load
  })
  // Reload when the things the caller named change. Snapshots are objects, so they are compared by identity.
  const [key, setKey] = useState(0)
  const [prev, setPrev] = useState<unknown[]>(deps)
  if (deps.length !== prev.length || deps.some((d, i) => d !== prev[i])) {
    setPrev(deps)
    setKey(key + 1)
  }
  useEffect(() => {
    const run = () => latest.current()
    let alive = true
    const go = () =>
      run()
        .then((d) => {
          if (!alive) return
          setData(d)
          setError(null)
          setLoaded(true)
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load'))
    go()
    const stop = automationService.subscribe(go)
    return () => {
      alive = false
      stop()
    }
  }, [key])
  return { data, error, loaded }
}

/** The hotel's own records, handed to the mock so its rules work from real data. */
export function useAutomationSnapshot(): AutomationSnapshot {
  const { reservations, rooms, guests } = useHotel()
  const hk = useHousekeeping()
  const { stock } = useRequests()
  const { records } = useApprovals()
  const { feedback } = useFeedback()
  const { tenant, options, stayTimes } = useFeatures()
  const [posSales] = useBrowserSyncedState<Sale[]>(POS_STORAGE_KEYS.sales, [])
  const [posOrders] = useBrowserSyncedState<HeldOrder[]>(POS_STORAGE_KEYS.heldOrders, [])
  const [posProducts] = useBrowserSyncedState<Product[]>(POS_STORAGE_KEYS.products, [])
  const now = useNow(60000)
  const minute = new Date(Math.floor(now / 60000) * 60000).toISOString()

  return useMemo(
    () => ({
      propertyId: tenant.id,
      plan: tenant.plan,
      today: TODAY,
      now: minute,
      reservations,
      rooms,
      guests,
      hkRooms: hk.rooms,
      hkTasks: hk.tasks,
      defects: hk.allDefects,
      spells: hk.spells,
      stock,
      posSales,
      posOrders,
      posProducts,
      approvals: records,
      feedback,
      rates: options.rates,
      events: options.rates.events ?? [],
      upsell: options.upsell,
      addOns: options.addOns ?? [],
      sla: options.sla,
      checkInTime: stayTimes.checkInTime,
      checkOutTime: stayTimes.checkOutTime,
      managerLimit: options.limits.manager,
    }),
    [tenant.id, tenant.plan, minute, reservations, rooms, guests, hk.rooms, hk.tasks, hk.allDefects, hk.spells, stock, posSales, posOrders, posProducts, records, feedback, options, stayTimes],
  )
}

/** Run a refresh whenever the hotel's records change. */
export function useRefresh(refresh: (s: AutomationSnapshot) => Promise<void>, snapshot: AutomationSnapshot) {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    refresh(snapshot).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not work it out'))
  }, [refresh, snapshot])
  return error
}

/** The signed-in person, as the service records them. */
export function useActor(): AutomationActor | null {
  const { user } = useAuth()
  return useMemo(() => (user ? { id: user.id, name: user.name, role: user.role } : null), [user])
}

/** Runs a service call, keeping "busy" and the error to show. */
export function useRun() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run<T>(fn: () => Promise<T>, onDone?: (v: T) => void) {
    setBusy(true)
    setError(null)
    try {
      const v = await fn()
      onDone?.(v)
      return v
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.')
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, error, setError }
}
