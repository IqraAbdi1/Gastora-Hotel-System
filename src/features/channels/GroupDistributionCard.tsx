import { useState } from 'react'
import { Badge, Button, Card } from '../../components/ui'
import { DEFAULT_CHANNELS, sellableBy } from '../../lib/channels'
import type { Channel } from '../../lib/channels'
import { useFeatures } from '../platform/featuresContext'
import { useChannels } from './useChannels'

/**
 * Distribution across an owner's properties.
 *
 * Each hotel keeps its own channels, because a lodge and a city hotel do not sell in the same places at
 * the same commission. What an owner wants is not one setting for everybody but the ability to see all
 * of them at once, and to copy a set-up that works rather than typing it three times.
 *
 * Copying takes the channels, their commissions and their mappings. It never takes a hotel's own room
 * names across, because those belong to that hotel's agreement with the channel.
 */
export default function GroupDistributionCard() {
  const { tenant, tenants, selectTenant } = useFeatures()
  const { channels, allChannels, setFor } = useChannels()
  const [done, setDone] = useState('')

  const group = tenant.group
  const sisters = tenants.filter((t) => t.group && t.group === group && t.id !== tenant.id)
  if (!group || sisters.length === 0) return null

  const channelsOf = (id: string): Channel[] => allChannels[id] ?? DEFAULT_CHANNELS

  function copyTo(id: string, name: string) {
    // The commission and the mapping travel; the push history does not, because it did not happen there.
    setFor(
      id,
      channels.map((c) => ({ ...c, lastPush: undefined, mappings: c.mappings.map((m) => ({ ...m })) })),
    )
    setDone(name)
  }

  return (
    <Card
      title="Across the group"
      icon="list"
      count={sisters.length + 1}
      padded
      description={`${group}. Each hotel sells where it chooses; this is all of them at once.`}
    >
      <ul className="space-y-2">
        {[tenant, ...sisters].map((t) => {
          const list = t.id === tenant.id ? channels : channelsOf(t.id)
          const on = list.filter((c) => c.on)
          const mine = t.id === tenant.id
          return (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-ink/10 p-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {t.name}
                  {mine && <Badge tone="neutral">this hotel</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-ink/60">
                  {on.length === 0
                    ? 'Sells only at its own desk and on its own site.'
                    : on
                        .map((c) => `${c.name} ${c.commissionPercent}%`)
                        .join(' · ')}
                </p>
                {on.length > 0 && (
                  <p className="mt-0.5 text-xs text-ink/45">
                    {on.reduce((n, c) => n + sellableBy(c).length, 0)} room type and channel pairs open
                  </p>
                )}
              </div>
              {!mine && (
                <Button size="sm" variant="secondary" onClick={() => copyTo(t.id, t.name)}>
                  Copy this hotel's set-up here
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {done && (
        <p className="mt-3 rounded-lg bg-good/[0.1] p-3 text-sm text-good">
          {tenant.name}'s channels, commissions and room names were copied to {done}. Open {done} to check the names
          that channel uses for its rooms, which are its own.
        </p>
      )}

      <p className="mt-3 text-xs text-ink/55">
        A hotel's rates, restrictions and prices stay its own. Only the channel set-up is copied, and the push history
        is not, because it did not happen there.{' '}
        <button type="button" className="font-semibold text-brand" onClick={() => selectTenant(sisters[0].id)}>
          Switch to {sisters[0].name}
        </button>{' '}
        to see its side.
      </p>
    </Card>
  )
}
