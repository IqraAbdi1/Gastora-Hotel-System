import type { ReactNode } from 'react'
import { Badge, ErrorState, LoadingState } from '../../components/ui'
import type { WorkPriority } from '../../services/workforce/workforceTypes'
import { PRIORITY_TONE } from './workforceFormat'


export function PriorityBadge({ priority }: { priority: WorkPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{priority}</Badge>
}

/** A red line under a form or panel with the message the service gave. */
export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
      {error}
    </p>
  )
}

export function Initials({ name, className = '' }: { name: string; className?: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand ${className}`}>
      {letters}
    </span>
  )
}

/** Loading and error states for a page while the service answers. */
export function Loaded({ ready, error, onRetry, children }: { ready: boolean; error: string | null; onRetry: () => void; children: ReactNode }) {
  if (error) return <ErrorState hint={error} onRetry={onRetry} />
  if (!ready) return <LoadingState />
  return <>{children}</>
}
