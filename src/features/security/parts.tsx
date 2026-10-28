import type { ReactNode } from 'react'
import { Badge } from '../../components/ui'

export function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="font-semibold">
          ×
        </button>
      )}
    </div>
  )
}

/** Small note that the signed-in role can look but not change. */
export function ReadOnly() {
  return <Badge tone="neutral">Read only</Badge>
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-ink/70">{children}</span>
}
