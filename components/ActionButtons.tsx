import { useNavigate } from 'react-router-dom'
import type { AssistantAction } from '../types'
import { useDraft } from '../lib/draftContext'

type Props = { actions: AssistantAction[]; onDone?: () => void }

export default function ActionButtons({ actions, onDone }: Props) {
  const navigate = useNavigate()
  const { openDraft } = useDraft()

  function run(action: AssistantAction) {
    if (action.kind === 'go') navigate(action.to)
    else openDraft(action)
    onDone?.()
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => run(a)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            a.kind === 'draft' ? 'bg-brand text-white' : 'border border-brand text-brand'
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}