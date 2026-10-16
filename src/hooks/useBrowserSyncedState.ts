import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

const SYNC_EVENT = 'gastora:browser-state-sync'
type SyncDetail<T> = { key: string; value: T }

/**
 * Persists state in localStorage and synchronizes it between components in the
 * current tab and other tabs on the same origin. This is browser-only sync,
 * not server or multi-device synchronization.
 */
export function readBrowserValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const saved = window.localStorage.getItem(key)
    return saved === null ? fallback : (JSON.parse(saved) as T)
  } catch {
    return fallback
  }
}

export function useBrowserSyncedState<T>(key: string, fallback: T): [T, Dispatch<SetStateAction<T>>] {
  const fallbackRef = useRef(fallback)
  const [value, setValue] = useState<T>(() => readBrowserValue(key, fallbackRef.current))
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const applyValue = (next: T) => {
      valueRef.current = next
      setValue(next)
    }
    const syncFromOtherTab = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return
      if (event.key === null || event.newValue === null) {
        applyValue(fallbackRef.current)
        return
      }
      try { applyValue(JSON.parse(event.newValue) as T) } catch { /* Ignore malformed storage. */ }
    }
    const syncWithinTab = (event: Event) => {
      const detail = (event as CustomEvent<SyncDetail<T>>).detail
      if (detail?.key === key) applyValue(detail.value)
    }
    window.addEventListener('storage', syncFromOtherTab)
    window.addEventListener(SYNC_EVENT, syncWithinTab)
    return () => {
      window.removeEventListener('storage', syncFromOtherTab)
      window.removeEventListener(SYNC_EVENT, syncWithinTab)
    }
  }, [key])

  const setSyncedValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    // Keep a synchronous ref so consecutive functional updates do not use stale state.
    const next = typeof action === 'function'
      ? (action as (previous: T) => T)(valueRef.current)
      : action
    valueRef.current = next
    setValue(next)
    try { window.localStorage.setItem(key, JSON.stringify(next)) } catch { /* Keep in-memory operation available. */ }
    window.dispatchEvent(new CustomEvent<SyncDetail<T>>(SYNC_EVENT, { detail: { key, value: next } }))
  }, [key])

  // Persist initial/default state and state changes, including state set by sync listeners.
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage may be unavailable or full. */ }
  }, [key, value])

  return [value, setSyncedValue]
}
