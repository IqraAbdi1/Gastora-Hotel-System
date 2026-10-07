import { Link } from 'react-router-dom'

type Props = {
  label: string
  value: string | number
  hint?: string
  to: string
  tone?: 'default' | 'warn' | 'bad'
}

const toneClass = { default: 'text-brand', warn: 'text-warn', bad: 'text-bad' }

export default function KpiCard({ label, value, hint, to, tone = 'default' }: Props) {
  return (
    <Link
      to={to}
      className="group block rounded-xl border border-ink/10 bg-surface p-4 shadow-sm transition hover:border-brand hover:shadow-md"
    >
      <p className="text-sm font-medium text-ink/60">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${toneClass[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/60 group-hover:text-brand">{hint}</p>}
    </Link>
  )
}