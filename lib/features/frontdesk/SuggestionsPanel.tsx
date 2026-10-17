import ActionButtons from '../../components/ActionButtons'
import { Badge, EmptyState, Modal } from '../../components/ui'
import type { Suggestion } from '../../types'

// Ideas for the desk. "Rule" ones come from the bookings; "AI (sample)" ones are fixed demo examples.
export default function SuggestionsPanel({ items, onClose }: { items: Suggestion[]; onClose: () => void }) {
  return (
    <Modal
      side
      title="Suggestions"
      description={
        <>
          <strong>Rule</strong> items are worked out from the bookings. <strong>AI (sample)</strong> items are fixed examples
          for the demo, not real advice.
        </>
      }
      onClose={onClose}
    >
      {items.length === 0 ? (
        <EmptyState title="No suggestions right now" />
      ) : (
        <ul className="space-y-3">
          {items.map((s) => (
            <li key={s.text} className="rounded-lg border border-ink/10 bg-canvas/50 p-3 text-sm">
              <div className="mb-1">
                {s.source === 'rule' ? <Badge tone="brand">Rule</Badge> : <Badge tone="accent">AI (sample)</Badge>}
              </div>
              <p className="text-ink/85">{s.text}</p>
              <ActionButtons actions={s.actions} onDone={onClose} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
