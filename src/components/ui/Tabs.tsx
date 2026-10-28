export type TabItem<K extends string> = { key: K; label: string; count?: number; alert?: boolean }

// A row of tab buttons for switching between parts of one record. Scrolls sideways on a phone.
export default function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const on = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              on ? 'bg-brand text-white' : 'text-ink/65 hover:bg-canvas hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${on ? 'bg-white/20' : 'bg-ink/8 text-ink/60'}`}>{t.count}</span>
            )}
            {t.alert && <span className={`h-2 w-2 rounded-full ${on ? 'bg-accent' : 'bg-warn'}`} aria-label="Needs attention" />}
          </button>
        )
      })}
    </div>
  )
}
