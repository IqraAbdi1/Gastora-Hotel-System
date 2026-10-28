import { useCallback, useEffect, useMemo, useState } from 'react'
import { procurementService } from '../../services'
import type { ProcurementActor, ProcurementSnapshot } from '../../services/procurement/procurementTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

// The last snapshot loaded for each property, so a dialog opened from a loaded page starts with data.
const lastLoaded = new Map<string, ProcurementSnapshot>()

// Area I: quotations, invoices, contracts, transfers and cost control for the hotel being shown.
// Loads from the procurement service and loads again whenever it changes.
export function useProcurement() {
  const { user, role } = useAuth()
  const { tenant } = useFeatures()
  const propertyId = tenant.id
  const [loaded, setLoaded] = useState<{ propertyId: string; data: ProcurementSnapshot } | null>(() => {
    const cached = lastLoaded.get(propertyId)
    return cached ? { propertyId, data: cached } : null
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      procurementService
        .snapshot(propertyId)
        .then((data) => {
          lastLoaded.set(propertyId, data)
          if (!alive) return
          setLoaded({ propertyId, data })
          setError(null)
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load procurement data'))
    load()
    const stop = procurementService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [propertyId])

  // The role shown on screen, so "view as" previews behave like that role.
  const actor = useMemo<ProcurementActor | null>(() => (user && role ? { id: user.id, name: user.name, role: role.id } : null), [user, role])

  /** Runs one service call as the signed-in person. Resolves to an error message, or null when it worked. */
  const run = useCallback(
    async (call: (a: ProcurementActor) => Promise<unknown>): Promise<string | null> => {
      if (!actor) return 'Sign in first.'
      try {
        await call(actor)
        return null
      } catch (e) {
        return e instanceof Error ? e.message : 'That did not work.'
      }
    },
    [actor],
  )

  const data = loaded && loaded.propertyId === propertyId ? loaded.data : null
  return { data, error, propertyId, actor, run, service: procurementService }
}
