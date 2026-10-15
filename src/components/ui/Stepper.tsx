export type Step = { key: string; label: string }

// Numbered steps along the top of a wizard. Finished steps can be clicked to go back.
export default function Stepper({
  steps,
  current,
  onGo,
}: {
  steps: Step[]
  /** Index of the step being shown. */
  current: number
  onGo?: (index: number) => void
}) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto" aria-label="Steps">
      {steps.map((s, i) => {
        const done = i < current
        const on = i === current
        return (
          <li key={s.key} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              disabled={!done || !onGo}
              onClick={() => onGo?.(i)}
              aria-current={on ? 'step' : undefined}
              className="flex shrink-0 items-center gap-2 text-sm font-semibold disabled:cursor-default"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-good text-white' : on ? 'bg-brand text-white ring-4 ring-brand/15' : 'bg-ink/10 text-ink/50'
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={on ? 'text-ink' : done ? 'text-ink/80' : 'text-ink/45'}>{s.label}</span>
            </button>
            {i < steps.length - 1 && <span className={`h-px min-w-4 flex-1 ${done ? 'bg-good/50' : 'bg-ink/15'}`} aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}
