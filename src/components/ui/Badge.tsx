import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad' | 'accent' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-ink/8 text-ink/70 ring-ink/10',
  brand: 'bg-brand/10 text-brand ring-brand/20',
  good: 'bg-good/10 text-good ring-good/20',
  warn: 'bg-warn/10 text-warn ring-warn/20',
  bad: 'bg-bad/10 text-bad ring-bad/20',
  accent: 'bg-accent/15 text-ink ring-accent/30',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
}

const dots: Record<Tone, string> = {
  neutral: 'bg-ink/40',
  brand: 'bg-brand',
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  accent: 'bg-accent',
  info: 'bg-sky-600',
}

// The one status chip. Colour carries meaning: good = done/settled, warn = needs a look, bad = problem.
export default function Badge({ tone = 'neutral', dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  )
}
