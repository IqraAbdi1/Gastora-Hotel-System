import { Input } from '../../components/ui'
import { PREFERENCE_TAGS } from '../../lib/loyalty'

// Saved on the guest, not the booking, so the next time they arrive the desk already knows.

export default function PreferenceChips({
  tags,
  onTags,
  note,
  onNote,
}: {
  tags: string[]
  onTags: (next: string[]) => void
  note: string
  onNote: (next: string) => void
}) {
  const toggle = (t: string) => onTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PREFERENCE_TAGS.map((t) => {
          const on = tags.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              aria-pressed={on}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                on ? 'bg-brand text-white' : 'bg-surface text-ink/70 ring-1 ring-ink/12 hover:ring-brand/40'
              }`}
            >
              {t}
            </button>
          )
        })}
      </div>
      <Input value={note} onChange={(e) => onNote(e.target.value)} placeholder="Anything else to remember for next time" />
      <p className="text-xs text-ink/55">
        Saved on the guest, so it is here next time. Keep it factual: a guest can ask to see what the hotel wrote about them.
      </p>
    </div>
  )
}
