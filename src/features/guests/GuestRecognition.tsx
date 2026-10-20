import { Badge } from '../../components/ui'
import { benefitList, loyaltyKnown, nextTier, stayHistory, tierFor } from '../../lib/loyalty'
import type { StayHistory } from '../../lib/loyalty'
import { dayMonth } from '../../lib/format'
import { useHotel } from '../../lib/hotelContext'
import type { Guest, Reservation } from '../../types'
import { useFeatures } from '../platform/featuresContext'

const TIER_TONE = ['warn', 'neutral', 'accent'] as const

/**
 * What the desk should know about a returning guest: how many times they have stayed, what they earn,
 * and what they like. Rule, not AI: these are counted from finished stays, not guessed.
 */
export default function GuestRecognition({
  guest,
  reservation,
  compact = false,
}: {
  guest?: Guest
  reservation?: Reservation
  compact?: boolean
}) {
  const { reservations } = useHotel()
  const { options } = useFeatures()
  const loyalty = options.loyalty

  if (!guest) return null

  /**
   * A guest who has not joined the programme is not profiled. Their stays still exist, because the
   * hotel must keep them, but nothing here is counted, recognised or rewarded.
   */
  if (!loyaltyKnown(guest)) {
    if (compact) return null
    return (
      <div className="rounded-lg border border-ink/10 bg-canvas/60 p-2.5 text-xs text-ink/60">
        Not in the returning-guest programme. Ask at check-in.
      </div>
    )
  }

  const history: StayHistory = stayHistory(guest, reservations, reservation?.id)
  const tier = tierFor(history, loyalty)
  const next = nextTier(history, loyalty)
  const prefs = guest.preferences
  const tags = prefs?.tags ?? []
  const written = [prefs?.room, prefs?.bed, prefs?.diet, prefs?.language, prefs?.other].filter(Boolean) as string[]
  const hasPrefs = tags.length > 0 || written.length > 0

  if (history.stays === 0 && !hasPrefs && !guest.vip) return null

  const tierIndex = tier ? loyalty.tiers.findIndex((t) => t.id === tier.id) : -1

  return (
    <div className="space-y-2 rounded-xl border border-brand/20 bg-brand/[0.05] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {guest.vip && <Badge tone="accent">VIP</Badge>}
        {tier && <Badge tone={TIER_TONE[Math.min(tierIndex, 2)]}>{tier.name}</Badge>}
        {history.stays > 0 && (
          <p className="text-sm font-semibold text-ink">
            {history.stays === 1 ? 'Stayed once before' : `${history.stays} stays before`}
            <span className="font-normal text-ink/60">
              {' '}
              · {history.nights} night{history.nights === 1 ? '' : 's'}
              {history.lastStay ? ` · last left ${dayMonth(history.lastStay)}` : ''}
            </span>
          </p>
        )}
        {history.stays === 0 && hasPrefs && <p className="text-sm font-semibold text-ink">Known guest</p>}
      </div>

      {tier && !compact && (
        <p className="text-xs text-ink/70">
          Earns: {benefitList(tier).join(' · ')}.
          {!loyalty.autoApply && ' The discount needs a manager to approve it.'}
        </p>
      )}

      {hasPrefs && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-ink/60">Likes:</span>
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink/80 ring-1 ring-ink/10">
              {t}
            </span>
          ))}
          {written.map((t) => (
            <span key={t} className="text-xs text-ink/70">
              {t}
            </span>
          ))}
        </div>
      )}

      {next && !compact && history.stays > 0 && (
        <p className="text-xs text-ink/55">
          {next.staysToGo > 0 && next.nightsToGo > 0
            ? `${next.staysToGo} more stay${next.staysToGo === 1 ? '' : 's'} or ${next.nightsToGo} more night${next.nightsToGo === 1 ? '' : 's'} to reach ${next.tier.name}.`
            : `Almost at ${next.tier.name}.`}
        </p>
      )}
    </div>
  )
}
