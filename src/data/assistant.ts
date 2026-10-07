import type { DraftAction, Suggestion } from '../types'

const lateCheckoutDraft: DraftAction = {
  kind: 'draft',
  label: 'Draft late-checkout offer',
  title: 'Late checkout offer for Amina Nakato',
  recipient: 'Amina Nakato (SMS)',
  body: 'Hello Amina, welcome back to Sample Hotel. We can offer you a late checkout until 2 PM on your departure day. Reply YES and we will confirm it for you. We look forward to seeing you today.',
}

export const aiSamples: Suggestion[] = [
  {
    source: 'ai',
    text: 'Amina Nakato has stayed twice before and asked for late checkout both times. Offer it at check-in?',
    actions: [lateCheckoutDraft],
  },
  {
    source: 'ai',
    text: 'Greet Grace Namukasa first: repeat guest with a Suite booking.',
    actions: [{ kind: 'go', label: 'Open arrivals', to: '/desk/reservations?view=arrivals' }],
  },
]