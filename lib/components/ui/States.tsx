import type { ReactNode } from 'react'

// Shown when a list has nothing in it. Say what is empty and, if useful, what to do next.
export function EmptyState({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-ink/60" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', hint, onRetry }: { title?: string; hint?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="px-4 py-8 text-center" role="alert">
      <p className="text-sm font-semibold text-bad">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 text-sm font-semibold text-brand hover:underline">
          Try again
        </button>
      )}
    </div>
  )
}
