import { useEffect, useState } from 'react'

// The current time, refreshed every `everyMs`. Lets "overdue" and "5 min ago" update by themselves.
export function useNow(everyMs = 60000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return now
}
