import { useCallback, useEffect, useMemo, useState } from 'react'
import { eventsService } from '../../services'
import { emptyData } from '../../services/events/eventsSample'
import type { Actor, EventsData } from '../../services/events/eventsTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

// Events for the hotel being shown. Loads from the service and reloads whenever it changes.
export function useEvents() {
  const { tenant, features } = useFeatures()
  const { user } = useAuth()
  const [data, setData] = useState<EventsData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      eventsService
        .load(tenant.id)
        .then((d) => {
          if (!alive) return
          setData(d)
          setError(null)
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load events'))
        .finally(() => alive && setLoading(false))
    load()
    const stop = eventsService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [tenant.id])

  const actor = useMemo<Actor>(() => (user ? { id: user.id, name: user.name } : { id: 'anon', name: 'Unknown' }), [user])
  const byId = useCallback(<T extends { id: string }>(list: T[], id: string | undefined) => list.find((x) => x.id === id), [])

  return {
    data,
    loading,
    error,
    actor,
    propertyId: tenant.id,
    sales: features.eventsSales,
    service: eventsService,
    byId,
  }
}

/** Runs a service call and keeps its error for the form to show. */
export function useRun() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])
  return { busy, error, setError, run }
}
