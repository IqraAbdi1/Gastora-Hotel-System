import { useHousekeeping } from '../features/housekeeping/hkContext'

// Number of front desk requests that housekeeping has not answered yet.
export default function RequestsBadge() {
  const { counts } = useHousekeeping()
  if (counts.requests === 0) return null
  return <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink">{counts.requests}</span>
}