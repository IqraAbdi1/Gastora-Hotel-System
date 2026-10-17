import { Input } from '../../components/ui'
import { PREFERENCE_TAGS, SENSITIVE_TAGS } from '../../lib/loyalty'

// Saved on the guest, not the booking, so the next time they arrive the desk already knows.

export default function PreferenceChips({
  tags,
  onTags,
  note,
  onNote,
  sensitiveOk,
  onSensitiveOk,
}: {
  tags: string[]
  onTags: (next: string[]) => void
  note: string
  onNote: (next: string) => void
  /** The guest agreed to the hotel keeping dietary and access needs. */
  sensitiveOk: boolean
  onSensitiveOk: (next: boolean) => void
}) {
  const toggle = (t: string) => onTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])

  const chip = (t: string, on: boolean, disabled: boolean) => (
    <button
      key={t}
      type="button"
      onClick={() => toggle(t)}
      aria-pressed={on}
      disabled={disabled}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        on ? 'bg-brand text-white' : 'bg-surface text-ink/70 ring-1 ring-ink/12 hover:ring-brand/40'
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:ring-ink/12`}
    >
      {t}
    </button>
  )

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

      <div className="rounded-lg border border-info/25 bg-info/[0.07] p-2.5">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={sensitiveOk}
            onChange={(e) => {
              onSensitiveOk(e.target.checked)
              // Permission withdrawn, so the answers go with it rather than sitting there unused.
              if (!e.target.checked) onTags(tags.filter((t) => !SENSITIVE_TAGS.includes(t)))
            }}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Diet and access needs.</span> The guest agrees to the hotel keeping these
            between stays. Ask separately: what someone eats can say what they believe or what is wrong with their
            health, and the law treats it as sensitive.
          </span>
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SENSITIVE_TAGS.map((t) => chip(t, tags.includes(t), !sensitiveOk))}
        </div>
      </div>
    </div>
  )
}
