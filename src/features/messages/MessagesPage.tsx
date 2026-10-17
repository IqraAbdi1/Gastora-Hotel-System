import { useMemo, useState } from 'react'
import { Badge, Button, Card, Field, Input, PageHeader, Segmented, Select, StatCard, Textarea } from '../../components/ui'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import {
  BASIS_NOTE,
  CHANNEL_LABEL,
  DEFAULT_MESSAGING,
  DEFAULT_TEMPLATES,
  KIND_LABEL,
  MESSAGE_BASIS,
  PLACEHOLDERS,
  unknownPlaceholders,
} from '../../lib/messages'
import type { GuestMessage, MessageChannel, MessageKind } from '../../lib/messages'
import { useMessages } from './messagesContext'

type View = 'outbox' | 'sent' | 'wording' | 'how'

const statusTone: Record<GuestMessage['status'], 'warn' | 'good' | 'bad' | 'neutral'> = {
  queued: 'warn',
  sent: 'good',
  failed: 'bad',
  cancelled: 'neutral',
}

// Everything the hotel says to its guests, in one place: what is waiting to go, what has gone, and the
// wording itself. The wording is the hotel's, not ours, so it is edited here and nowhere else.
export default function MessagesPage() {
  const { messages, outbox, send, sendAll, cancel } = useMessages()
  const { options, setOptions } = useFeatures()
  const { user } = useAuth()
  const [view, setView] = useState<View>('outbox')

  const settings = options.messaging ?? DEFAULT_MESSAGING
  const me = user?.staffName ?? user?.name ?? 'Front desk'

  const sent = useMemo(() => messages.filter((m) => m.status === 'sent'), [messages])
  const failed = useMemo(() => messages.filter((m) => m.status === 'failed'), [messages])

  const patch = (next: Partial<typeof settings>) => setOptions({ messaging: { ...settings, ...next } })

  const editTemplate = (kind: MessageKind, change: Partial<(typeof settings.templates)[number]>) =>
    patch({ templates: settings.templates.map((t) => (t.kind === kind ? { ...t, ...change } : t)) })

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front desk"
        title="Guest messages"
        description="Written by the system from the hotel's own wording. Nobody has to remember to send them."
        actions={
          outbox.length > 0 ? (
            <Button onClick={() => sendAll(me)}>Send all {outbox.length}</Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Waiting to go" value={String(outbox.length)} tone={outbox.length > 0 ? 'warn' : 'default'} hint="Written and ready" />
        <StatCard label="Sent" value={String(sent.length)} tone="good" hint="Recorded on the stay" />
        <StatCard label="Could not go" value={String(failed.length)} tone={failed.length > 0 ? 'bad' : 'default'} hint="No number, or no permission" />
      </div>

      <Segmented
        options={[
          { key: 'outbox', label: `Waiting (${outbox.length})` },
          { key: 'sent', label: 'Sent' },
          { key: 'wording', label: 'Wording' },
          { key: 'how', label: 'How they go out' },
        ]}
        value={view}
        onChange={setView}
        label="Messages view"
      />

      {view === 'outbox' && (
        <Card title="Waiting to go" description="Check the wording, then send. Nothing goes out on its own unless the hotel has asked for that." padded>
          {outbox.length === 0 ? (
            <p className="text-sm text-ink/60">Nothing waiting. Messages appear here as bookings are made and guests arrive.</p>
          ) : (
            <ul className="space-y-3">
              {outbox.map((m) => (
                <li key={m.id} className="rounded-xl border border-ink/10 bg-canvas p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{KIND_LABEL[m.kind]}</Badge>
                    <span className="text-sm font-semibold text-ink">{m.guestName}</span>
                    <span className="text-xs text-ink/55">
                      {CHANNEL_LABEL[m.channel]} · {m.to}
                    </span>
                    {m.auto && <span className="text-xs text-ink/45">written by the system</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">{m.body}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => send(m.id, me)}>
                      Send
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(m.id)}>
                      Don't send
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {failed.length > 0 && (
            <div className="mt-4 rounded-xl bg-bad/[0.06] p-3">
              <p className="text-sm font-semibold text-bad">{failed.length} could not be sent</p>
              <ul className="mt-2 space-y-1 text-sm text-ink/75">
                {failed.map((m) => (
                  <li key={m.id}>
                    {m.guestName} — {KIND_LABEL[m.kind]}: {m.problem}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {view === 'sent' && (
        <Card title="Sent" description="The hotel's record of what the guest was told and when." padded>
          {sent.length === 0 ? (
            <p className="text-sm text-ink/60">Nothing has been sent yet.</p>
          ) : (
            <ul className="space-y-2">
              {[...sent].map((m) => (
                <li key={m.id} className="border-b border-ink/5 pb-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone[m.status]} dot>
                      {KIND_LABEL[m.kind]}
                    </Badge>
                    <span className="text-sm font-semibold text-ink">{m.guestName}</span>
                    <span className="text-xs text-ink/55">
                      {m.sentAt} · {CHANNEL_LABEL[m.channel]} · {m.to}
                      {m.by ? ` · sent by ${m.by}` : ' · sent by the system'}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {view === 'wording' && (
        <Card
          title="The hotel's wording"
          description="Every message the guest receives. Edit it, or switch one off without touching the rest."
          padded
        >
          <div className="mb-4 rounded-lg bg-brand/[0.06] p-3 text-xs text-ink/70">
            <p className="font-semibold text-ink">What you can put inside a message</p>
            <p className="mt-1">
              {PLACEHOLDERS.map((p) => `{${p.key}} ${p.meaning.toLowerCase()}`).join(' · ')}
            </p>
          </div>
          <ul className="space-y-4">
            {settings.templates.map((t) => {
              const unknown = unknownPlaceholders(t.text)
              return (
                <li key={t.kind} className="rounded-xl border border-ink/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{t.label}</p>
                      <p className="text-xs text-ink/60">{t.blurb}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-ink/75">
                      <input type="checkbox" checked={t.on} onChange={(e) => editTemplate(t.kind, { on: e.target.checked })} />
                      Send this one
                    </label>
                  </div>
                  <Textarea
                    rows={3}
                    className="mt-2"
                    value={t.text}
                    onChange={(e) => editTemplate(t.kind, { text: e.target.value })}
                    aria-label={`Wording for ${t.label}`}
                  />
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-ink/55">{BASIS_NOTE[MESSAGE_BASIS[t.kind]]}</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand"
                      onClick={() => editTemplate(t.kind, { text: DEFAULT_TEMPLATES.find((d) => d.kind === t.kind)?.text ?? t.text })}
                    >
                      Reset wording
                    </button>
                  </div>
                  {unknown.length > 0 && (
                    <p className="mt-1 text-xs text-warn">
                      The system cannot fill {unknown.map((u) => `{${u}}`).join(', ')} — the guest will see it exactly as typed.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {view === 'how' && (
        <Card title="How they go out" description="Set once by the hotel admin." padded>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Channel">
              {(id) => (
                <Select id={id} value={settings.channel} onChange={(e) => patch({ channel: e.target.value as MessageChannel })}>
                  {(Object.keys(CHANNEL_LABEL) as MessageChannel[]).map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABEL[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Name the guest sees">
              {(id) => <Input id={id} value={settings.senderName} onChange={(e) => patch({ senderName: e.target.value })} placeholder="The hotel name" />}
            </Field>
            <Field label="Deposit reminder, days before arrival">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={14}
                  value={settings.depositDaysBefore}
                  onChange={(e) => patch({ depositDaysBefore: Math.max(0, Number(e.target.value) || 0) })}
                />
              )}
            </Field>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-ink/80">
            <input type="checkbox" className="mt-1" checked={settings.autoSend} onChange={(e) => patch({ autoSend: e.target.checked })} />
            <span>
              Send without asking. Off, the system writes each message and somebody at the desk presses send. On, it goes by itself.
              <span className="block text-xs text-ink/55">Most hotels leave this off for the first weeks, while the wording settles.</span>
            </span>
          </label>
          <p className="mt-4 rounded-lg bg-ink/[0.04] p-3 text-xs text-ink/65">
            In this prototype nothing leaves the building. A message marked sent is the hotel's record that it went; connecting a real WhatsApp
            or SMS provider is one change, in one place.
          </p>
        </Card>
      )}
    </div>
  )
}
