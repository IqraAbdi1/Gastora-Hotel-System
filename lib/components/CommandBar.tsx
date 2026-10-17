import { useState } from 'react'
import type { FormEvent } from 'react'
import { answerQuestion } from '../lib/rules'
import type { Answer } from '../types'
import ActionButtons from './ActionButtons'
import { useHotel } from '../lib/hotelContext'


export default function CommandBar() {
  const { reservations, rooms } = useHotel()
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (query.trim()) setAnswer(answerQuestion(query, reservations, rooms))
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-xl">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a guest or room, or ask: who arrives today without a deposit?"
        className="w-full rounded-lg border border-ink/15 bg-canvas px-4 py-2 text-sm outline-none focus:border-brand"
      />
      {answer && (
        <div className="absolute left-0 right-0 top-12 z-20 rounded-xl border border-ink/10 bg-surface p-4 text-sm shadow-lg">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warn">Assistant (sample)</p>
          <p>{answer.text}</p>
          <ActionButtons actions={answer.actions} onDone={() => setAnswer(null)} />
          <button type="button" onClick={() => setAnswer(null)} className="mt-3 block text-xs font-semibold text-ink/60">
            Close
          </button>
        </div>
      )}
    </form>
  )
}