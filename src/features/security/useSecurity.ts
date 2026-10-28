import { useCallback, useEffect, useMemo, useState } from 'react'
import { securityService } from '../../services'
import type { SecurityService } from '../../services/security/securityService'
import type { SecurityActor } from '../../services/security/securityTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

/**
 * Loads one piece of security data for the hotel being shown, and loads it again whenever the
 * service says something changed or the hotel changes. Pass a loader defined outside the component.
 */
export function useSecurityData<T>(load: (s: SecurityService, propertyId: string) => Promise<T>) {
  const { tenant } = useFeatures()
  const [state, setState] = useState<{ data: T | null; error: string | null; key: string | null }>({ data: null, error: null, key: null })

  useEffect(() => {
    let alive = true
    const run = () =>
      load(securityService, tenant.id)
        .then((data) => alive && setState({ data, error: null, key: tenant.id }))
        .catch((e: unknown) => alive && setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Could not load', key: tenant.id })))
    run()
    const stop = securityService.subscribe(run)
    return () => {
      alive = false
      stop()
    }
  }, [load, tenant.id])

  // Data from another hotel is never shown while the new one loads.
  const current = state.key === tenant.id
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !current }
}

/** The person acting (the role on screen, so "view as" behaves like that role) and what they may change. */
export function useSecurityActor() {
  const { user, role } = useAuth()
  const { tenant } = useFeatures()
  const actor = useMemo<SecurityActor | null>(() => (user && role ? { id: user.id, name: user.name, role: role.id } : null), [user, role])
  const canAdmin = role?.id === 'owner' || role?.id === 'admin'
  return { actor, canAdmin, propertyId: tenant.id, service: securityService }
}

/** Runs a service call, keeps its error for the page to show, and reports when it is busy. */
export function useAction() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
  return { run, error, busy, clear: () => setError(null) }
}

/** Hands the browser a file to save. */
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
