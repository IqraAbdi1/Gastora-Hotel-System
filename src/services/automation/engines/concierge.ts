// The concierge's rules: match the guest's words against the hotel's own knowledge base. A request
// is answered and handed to the desk; a complaint, an emergency or anything it cannot place goes to a
// person. It never makes up an answer the knowledge base does not hold.
import type { ConciergeModel } from '../automationModels'
import type { ConciergeContext, ConciergeReply, Driver, KbArticle } from '../automationTypes'

const STOP = new Set(
  'a an the is are was what when where how do does can could i me my we our you your to for of in on at it and or please there any this that be have has with time'.split(' '),
)

/** Words that mean a person should answer, whatever the knowledge base holds. */
const URGENT = [
  'emergency',
  'urgent',
  'sick',
  'ill',
  'doctor',
  'hurt',
  'injured',
  'fire',
  'stolen',
  'theft',
  'police',
  'complain',
  'complaint',
  'angry',
  'unacceptable',
  'refund',
  'manager',
  'broken',
  'not working',
  "doesn't work",
  'does not work',
  'leak',
  'dirty',
  'cockroach',
  'noise',
  'noisy',
]
const HUMAN = ['speak to', 'talk to', 'a person', 'a human', 'real person', 'staff member', 'call me']

/** A whole word or phrase, so "ill" does not fire on "will". */
const has = (text: string, w: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?([^a-z]|$)`).test(text)
const ASKING = ['book', 'need', 'arrange', 'send', 'bring', 'can i get', 'can i have', 'could i have', 'could you', 'i would like', "i'd like", 'want', 'order', 'reserve']
const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|jambo|oli otya)\b[!. ]*$/

export const fill = (text: string, ctx: ConciergeContext) =>
  text
    .replaceAll('{checkOutTime}', ctx.checkOutTime)
    .replaceAll('{checkInTime}', ctx.checkInTime)
    .replaceAll('{lateFreeUntil}', ctx.lateFreeUntil)
    .replaceAll('{hotelName}', ctx.hotelName)

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))

function score(article: KbArticle, text: string, tokens: string[], asking: boolean) {
  const hits: string[] = []
  let points = 0
  for (const k of article.keywords) {
    const key = k.trim().toLowerCase()
    if (!key) continue
    if (has(text, key)) {
      hits.push(key)
      points += key.includes(' ') ? 3 : 2
    }
  }
  const q = new Set(words(article.question + ' ' + article.topic))
  const overlap = tokens.filter((t) => q.has(t))
  points += overlap.length * 0.5
  if (article.category === 'request' && asking && hits.length > 0) points += 2
  if (article.category === 'faq' && !asking && hits.length > 0) points += 0.5
  return { points, hits, overlap }
}

export const conciergeRules: ConciergeModel = {
  reply(raw: string, kb: KbArticle[], ctx: ConciergeContext): ConciergeReply {
    const text = ` ${raw.toLowerCase().trim()} `
    const tokens = words(raw)
    const drivers: Driver[] = []

    if (GREETING.test(raw.toLowerCase().trim())) {
      return {
        body: `Hello, and welcome to ${ctx.hotelName}. Ask me about Wi-Fi, breakfast, check-out, airport transfers or the spa, or tell me what you need.`,
        intent: 'greeting',
        confidence: 0.99,
        drivers: [{ basis: 'Rule', text: 'Recognised a greeting.' }],
      }
    }

    const urgent = URGENT.filter((w) => has(text, w))
    if (urgent.length > 0) {
      return {
        body: 'I am sorry about that. I have passed your message to a member of staff, who will reply here shortly. For an emergency, please call reception now.',
        intent: 'escalate',
        confidence: 0.95,
        drivers: [{ basis: 'Rule', text: `Words that need a person: ${urgent.slice(0, 3).join(', ')}.` }],
        escalate: { reason: 'Complaint or urgent' },
      }
    }
    const human = HUMAN.filter((w) => has(text, w))
    if (human.length > 0) {
      return {
        body: 'Of course. A member of staff will reply to you here shortly.',
        intent: 'escalate',
        confidence: 0.95,
        drivers: [{ basis: 'Rule', text: 'The guest asked for a person.' }],
        escalate: { reason: 'Asked for a person' },
      }
    }

    const asking = ASKING.some((w) => has(text, w))
    const ranked = kb
      .filter((a) => a.active)
      .map((a) => ({ a, ...score(a, text, tokens, asking) }))
      .filter((x) => x.hits.length > 0)
      .sort((x, y) => y.points - x.points)

    const best = ranked[0]
    if (!best || best.points < 2) {
      return {
        body: 'I do not have the answer to that, so I have asked a member of staff to reply here.',
        intent: 'escalate',
        confidence: 0.2,
        drivers: [{ basis: 'Rule', text: 'No article in the knowledge base matched.' }],
        escalate: { reason: 'Could not answer' },
      }
    }

    const confidence = Math.min(0.97, 0.45 + best.points / 12)
    drivers.push({ basis: 'Rule', text: `Matched "${best.a.topic}" on: ${best.hits.join(', ')}.` })
    if (ranked[1] && ranked[1].points >= best.points - 0.5) {
      drivers.push({ basis: 'Estimate', text: `Close second: "${ranked[1].a.topic}".` })
    }
    if (best.a.category === 'request') {
      drivers.push({ basis: 'Rule', text: 'A request, so it goes to the desk as a guest request.' })
      return {
        body: fill(best.a.answer, ctx),
        intent: 'request',
        confidence,
        kbArticleId: best.a.id,
        drivers,
        request: { title: best.a.requestTitle || best.a.topic, detail: raw.trim() },
      }
    }
    return { body: fill(best.a.answer, ctx), intent: 'faq', confidence, kbArticleId: best.a.id, drivers }
  },
}
