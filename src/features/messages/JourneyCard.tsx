import { Badge, Card } from '../../components/ui'
import { BASIS_NOTE, JOURNEY, KIND_LABEL, MESSAGE_BASIS, STAGE_LABEL, STAGE_NOTE } from '../../lib/messages'
import type { MessagingSettings, Stage } from '../../lib/messages'

/**
 * The hotel's guest journey: the same messages the templates below carry, laid out in the order a
 * guest meets them.
 *
 * The list of templates says what the hotel can send. This says what a guest actually experiences,
 * which is the thing worth looking at: a hotel that has switched off everything between booking and
 * departure has a gap it cannot see in an alphabetical list.
 */
export default function JourneyCard({ settings }: { settings: MessagingSettings }) {
  const stages: Stage[] = ['before', 'during', 'after']
  const isOn = (kind: string) => settings.templates.find((t) => t.kind === kind)?.on !== false

  return (
    <Card
      title="The guest journey"
      icon="calendar"
      padded
      description="What a guest hears from the hotel, in the order they hear it."
    >
      <div className="space-y-4">
        {stages.map((stage) => {
          const steps = JOURNEY.filter((j) => j.stage === stage)
          const live = steps.filter((j) => isOn(j.kind))
          return (
            <section key={stage}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{STAGE_LABEL[stage]}</p>
                <span className="text-xs text-ink/55">
                  {live.length} of {steps.length} switched on
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink/55">{STAGE_NOTE[stage]}</p>

              <ol className="mt-2 space-y-1.5">
                {steps.map((j) => {
                  const on = isOn(j.kind)
                  return (
                    <li
                      key={j.kind}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                        on ? 'border-ink/10 bg-surface' : 'border-ink/10 bg-ink/[0.03]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className={`font-medium ${on ? 'text-ink' : 'text-ink/45'}`}>{KIND_LABEL[j.kind]}</span>
                        <span className="ml-2 text-xs text-ink/55">{j.when}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={MESSAGE_BASIS[j.kind] === 'marketing' ? 'warn' : 'neutral'}>
                          {MESSAGE_BASIS[j.kind] === 'marketing' ? 'Needs permission' : 'Part of the stay'}
                        </Badge>
                        <Badge tone={on ? 'good' : 'neutral'} dot={on}>
                          {on ? 'On' : 'Off'}
                        </Badge>
                      </span>
                    </li>
                  )
                })}
              </ol>

              {live.length === 0 && (
                <p className="mt-1.5 text-xs text-warn">
                  The guest hears nothing from the hotel at this point of their stay.
                </p>
              )}
            </section>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-ink/55">
        {BASIS_NOTE['the stay']} {BASIS_NOTE.marketing} Each one is switched on and worded below.
      </p>
    </Card>
  )
}
