import { useState } from 'react'
import { Button, Field, Select, Textarea } from '../../components/ui'
import { ABOUT, KIND_LABEL, newFeedbackId } from '../../lib/feedback'
import type { About, FeedbackKind } from '../../lib/feedback'
import { stamp } from '../../lib/folio'
import type { Reservation } from '../../types'
import { useFeedback } from './useFeedback'

/**
 * The guest's own way of saying how it went, on the page they already have open.
 *
 * Asked at the end of the stay rather than in a survey nobody opens a week later, and short enough to
 * answer on a telephone while waiting for a taxi. A complaint arriving this way opens at the desk like
 * any other, because a guest who tells the hotel instead of the internet deserves the quicker answer.
 */
export default function GuestFeedbackForm({ stay }: { stay: Reservation }) {
  const { feedback, add } = useFeedback()
  const [rating, setRating] = useState<number | null>(null)
  const [about, setAbout] = useState<About>('The room')
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  const already = feedback.some((f) => f.reservationId === stay.id && f.fromGuest)
  if (already || sent) {
    return (
      <div className="mt-5 rounded-xl bg-good/[0.1] p-4 text-sm text-ink/80">
        <p className="font-semibold text-good">Thank you for telling us.</p>
        <p className="mt-0.5">
          {rating !== null && rating <= 3
            ? 'Somebody at the hotel will look at this today.'
            : 'It goes straight to the people who looked after you.'}
        </p>
      </div>
    )
  }

  function send() {
    // Three or less is treated as a complaint and stays open until somebody answers it. Four or five is
    // kept as a compliment and needs nobody to act.
    const kind: FeedbackKind = rating !== null && rating <= 3 ? 'complaint' : 'compliment'
    add({
      id: newFeedbackId(feedback),
      at: stamp(),
      by: stay.guest,
      fromGuest: true,
      kind,
      about,
      text: text.trim() || `Rated ${rating} out of 5.`,
      rating: rating ?? undefined,
      guestId: stay.guestId,
      guestName: stay.guest,
      reservationId: stay.id,
      room: stay.room ?? undefined,
      state: kind === 'complaint' ? 'open' : 'closed',
    })
    setSent(true)
  }

  return (
    <section className="mt-5 rounded-xl border border-ink/10 bg-surface p-4">
      <p className="text-sm font-semibold text-ink">How was your stay?</p>
      <p className="mt-0.5 text-xs text-ink/60">It takes a moment, and the hotel reads every one.</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
            className={`h-10 w-10 rounded-lg border text-sm font-bold transition ${
              rating === n ? 'border-brand bg-brand text-white' : 'border-ink/15 bg-canvas text-ink/70 hover:border-brand/40'
            }`}
          >
            {n}
          </button>
        ))}
        <span className="self-center pl-2 text-xs text-ink/55">
          {rating === null ? '1 is poor, 5 is very good' : rating <= 3 ? 'We would like to put this right' : 'Thank you'}
        </span>
      </div>

      {rating !== null && (
        <div className="mt-3 space-y-3">
          <Field label="What about?">
            {(id) => (
              <Select id={id} value={about} onChange={(e) => setAbout(e.target.value as About)}>
                {ABOUT.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={rating <= 3 ? 'What went wrong?' : 'Anything you would like to say?'}>
            {(id) => <Textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          <Button onClick={send}>Send it to the hotel</Button>
          <p className="text-xs text-ink/55">
            {rating <= 3
              ? `This opens at the front desk straight away and stays open until somebody answers it. It is kept as ${KIND_LABEL.complaint.toLowerCase()}.`
              : 'This is kept with your stay so the people who looked after you can see it.'}
          </p>
        </div>
      )}
    </section>
  )
}
