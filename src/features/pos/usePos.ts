import { useEffect, useMemo, useState } from 'react'
import { posService } from '../../services'
import type { Actor } from '../../services/types'
import type { PosOutlet, PosSnapshot } from '../../services/pos/posTypes'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

/** Roles that may approve a discount above the outlet's limit and change outlet set-up. */
export const POS_MANAGER_ROLES = ['owner', 'gm', 'admin', 'finance']

// The POS data of the hotel being shown, reloaded whenever the service says something changed.
export function usePos() {
  const { tenant, features } = useFeatures()
  const { user, role } = useAuth()
  const pid = tenant.id
  const [loaded, setLoaded] = useState<{ pid: string; data: PosSnapshot } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      posService
        .snapshot(pid)
        .then((data) => {
          if (!alive) return
          setLoaded({ pid, data })
          setError(null)
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not load the POS'))
    load()
    const stop = posService.subscribe(load)
    return () => {
      alive = false
      stop()
    }
  }, [pid])

  const data = loaded?.pid === pid ? loaded.data : null
  const actor: Actor = useMemo(() => ({ id: user?.id ?? 'unknown', name: user?.name ?? 'Staff' }), [user])

  // A small hotel works with its restaurant and bar only; the outlet switcher appears with more.
  const outlets: PosOutlet[] = useMemo(() => {
    const active = (data?.outlets ?? []).filter((o) => o.active).sort((a, b) => a.sortOrder - b.sortOrder)
    return features.posMultiOutlet ? active : active.filter((o) => o.type === 'restaurant' || o.type === 'bar').slice(0, 2)
  }, [data, features.posMultiOutlet])

  return {
    pid,
    actor,
    data,
    loading: !data && !error,
    error,
    outlets,
    features,
    isManager: POS_MANAGER_ROLES.includes(role?.id ?? ''),
    service: posService,
  }
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')
