import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import type { Feedback } from '../../lib/feedback'

// What guests said, kept beside the hotel's other records. The guest's own pages write here too, which
// is why it is browser-synced rather than held in one screen's state.
const KEY = 'gastora:hotel:feedback'

export function useFeedback() {
  const [feedback, setFeedback] = useBrowserSyncedState<Feedback[]>(KEY, [])
  const add = (f: Feedback) => setFeedback([f, ...feedback])
  const update = (id: string, patch: Partial<Feedback>) =>
    setFeedback(feedback.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return { feedback, setFeedback, add, update }
}
