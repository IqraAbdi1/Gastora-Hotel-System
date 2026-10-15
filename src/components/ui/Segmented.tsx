// Two or three buttons that switch between views of the same page, such as Board and Calendar.
export default function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string }[]
  value: K
  onChange: (key: K) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg border border-ink/10 bg-surface p-0.5 shadow-sm">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
            value === o.key ? 'bg-brand text-white' : 'text-ink/65 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
