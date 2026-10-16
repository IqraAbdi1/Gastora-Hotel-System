import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/**
 * Persists a state value in this browser and listens for localStorage changes
 * from other tabs on the same origin. This is browser-only sync, not cloud sync.
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

  useEffect(() => {
    const syncFromOtherTab = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return
      if (event.key === null || event.newValue === null) {
        setValue(fallbackRef.current)
        return
      }
      try {
        setValue(JSON.parse(event.newValue) as T)
      } catch {
        // Ignore malformed values rather than replacing valid in-memory state.
      }
    }
    window.addEventListener('storage', syncFromOtherTab)
    return () => window.removeEventListener('storage', syncFromOtherTab)
  }, [key])

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage can be unavailable or full; the app remains usable in memory.
    }
  }, [key, value])

  return [value, setValue]
}
