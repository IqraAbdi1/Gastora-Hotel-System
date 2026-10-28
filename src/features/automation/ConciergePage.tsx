import { useState } from 'react'
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea } from '../../components/ui'
import type { Column } from '../../components/ui'
import Switch from '../../components/Switch'
import { TODAY } from '../../data/sample'
import { dateTime, timeAgo } from '../../lib/format'
import { useNow } from '../../lib/useNow'
import { automationService } from '../../services'
import type { ConciergeConversation, ConciergeReply, Escalation, KbArticle, KbArticleInput } from '../../services/automation/automationTypes'
import { useFeatures } from '../platform/featuresContext'
import { Drivers, ErrorLine, ReasonDialog } from './automationUi'
import { useActor, useAutomationData, useRun } from './useAutomation'

type Tab = 'escalations' | 'conversations' | 'kb'

const ESC_TONE = { open: 'bad', taken: 'warn', answered: 'good', closed: 'neutral' } as const
const CONV_TONE = { open: 'neutral', escalated: 'bad', closed: 'neutral' } as const

export default function ConciergePage() {
  const { tenant } = useFeatures()
  const pid = tenant.id
  const { data: conversations } = useAutomationData(() => automationService.listConversations(pid), [], [pid])
  const { data: escalations } = useAutomationData(() => automationService.listEscalations(pid), [], [pid])
  const { data: kb } = useAutomationData(() => automationService.listKb(pid), [], [pid])
  const [tab, setTab] = useState<Tab>('escalations')
  const [viewing, setViewing] = useState<ConciergeConversation | null>(null)

  const now = useNow()
  const waiting = escalations.filter((e) => e.status === 'open' || e.status === 'taken')
  const today = conversations.filter((c) => c.lastMessageAt.slice(0, 10) === TODAY || now - Date.parse(c.lastMessageAt) < 86400000)
  const asked = conversations.reduce((n, c) => n + c.messageCount / 2, 0)
  const answered = conversations.reduce((n, c) => n + c.answeredCount, 0)

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Automation" title="Concierge" description="Guest questions from their stay page. Anything the assistant cannot answer comes here." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Conversations, 24 h" icon="guests" value={today.length} hint={`${conversations.length} in all`} />
        <StatCard label="Answered by assistant" icon="sparkles" value={asked ? `${Math.round((answered / asked) * 100)}%` : '—'} hint={`${answered} of ${Math.round(asked)} questions`} />
        <StatCard
          label="Waiting for staff"
          icon="alert"
          value={waiting.length}
          hint={`${escalations.filter((e) => e.status === 'open').length} not taken`}
          tone={waiting.length ? 'warn' : 'good'}
          onClick={() => setTab('escalations')}
          active={tab === 'escalations'}
        />
        <StatCard label="Knowledge base" icon="list" value={kb.filter((a) => a.active).length} hint="Articles switched on" onClick={() => setTab('kb')} active={tab === 'kb'} />
      </div>

      <Tabs<Tab>
        label="Concierge"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'escalations', label: 'Escalations', count: waiting.length, alert: escalations.some((e) => e.status === 'open') },
          { key: 'conversations', label: 'Conversations', count: conversations.length },
          { key: 'kb', label: 'Knowledge base', count: kb.length },
        ]}
      />

      {tab === 'escalations' && <EscalationQueue escalations={escalations} conversations={conversations} onOpen={setViewing} />}
      {tab === 'conversations' && <ConversationList conversations={conversations} onOpen={setViewing} />}
      {tab === 'kb' && <KnowledgeBase kb={kb} />}

      {viewing && <Transcript conversation={viewing} escalations={escalations.filter((e) => e.conversationId === viewing.id)} onClose={() => setViewing(null)} />}
    </div>
  )
}

function EscalationQueue({ escalations, conversations, onOpen }: { escalations: Escalation[]; conversations: ConciergeConversation[]; onOpen: (c: ConciergeConversation) => void }) {
  const actor = useActor()
  const now = useNow()
  const { run, busy, error, setError } = useRun()
  const [show, setShow] = useState<'waiting' | 'done'>('waiting')
  const [answering, setAnswering] = useState<Escalation | null>(null)
  const [closing, setClosing] = useState<Escalation | null>(null)
  const list = escalations
    .filter((e) => (show === 'waiting' ? e.status === 'open' || e.status === 'taken' : e.status === 'answered' || e.status === 'closed'))
    .sort((a, b) => (show === 'waiting' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)))

  return (
    <Card
      title="Escalations"
      icon="alert"
      count={list.length}
      actions={
        <div className="flex gap-1">
          <Button size="sm" variant={show === 'waiting' ? 'primary' : 'ghost'} onClick={() => setShow('waiting')}>
            Waiting
          </Button>
          <Button size="sm" variant={show === 'done' ? 'primary' : 'ghost'} onClick={() => setShow('done')}>
            Done
          </Button>
        </div>
      }
    >
      <ErrorLine error={answering || closing ? null : error} />
      {list.length === 0 ? (
        <EmptyState title={show === 'waiting' ? 'No guest is waiting' : 'Nothing answered yet'} />
      ) : (
        <ul className="space-y-3">
          {list.map((e) => {
            const conv = conversations.find((c) => c.id === e.conversationId)
            return (
              <li key={e.id} className="rounded-xl border border-ink/10 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {e.guestName}
                      {e.room && <span className="text-sm font-normal text-ink/55">Room {e.room}</span>}
                      <Badge tone={ESC_TONE[e.status]} dot={e.status === 'open'}>
                        {e.status}
                      </Badge>
                    </p>
                    <p className="mt-1 text-sm text-ink/80">“{e.question}”</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {e.reason} · {timeAgo(e.createdAt, now)}
                      {e.takenBy ? ` · taken by ${e.takenBy.name}` : ''}
                      {e.answeredBy ? ` · answered by ${e.answeredBy.name}, ${dateTime(e.answeredAt ?? '')}` : ''}
                      {e.closedBy ? ` · closed by ${e.closedBy.name}` : ''}
                    </p>
                    {e.answer && <p className="mt-1 rounded-lg bg-good/[0.07] px-2.5 py-1.5 text-sm text-ink/80">{e.answer}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.status === 'open' && (
                    <Button size="sm" disabled={busy} onClick={() => actor && run(() => automationService.takeEscalation(e.id, actor))}>
                      Take it
                    </Button>
                  )}
                  {(e.status === 'open' || e.status === 'taken') && (
                    <Button size="sm" variant={e.status === 'taken' ? 'primary' : 'secondary'} disabled={busy} onClick={() => setAnswering(e)}>
                      Answer
                    </Button>
                  )}
                  {e.status !== 'closed' && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setClosing(e)}>
                      Close
                    </Button>
                  )}
                  {conv && (
                    <Button size="sm" variant="ghost" onClick={() => onOpen(conv)}>
                      Conversation
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {answering && (
        <ReasonDialog
          title={`Answer ${answering.guestName}`}
          label="Your reply, shown on their stay page"
          confirm="Send answer"
          error={error}
          onCancel={() => {
            setAnswering(null)
            setError(null)
          }}
          onConfirm={(text) => actor && run(() => automationService.answerEscalation(answering.id, text, actor), () => setAnswering(null))}
        />
      )}
      {closing && (
        <ReasonDialog
          title="Close escalation"
          label={closing.status === 'answered' ? 'Note (optional)' : 'Why close it without an answer?'}
          optional={closing.status === 'answered'}
          confirm="Close"
          error={error}
          onCancel={() => {
            setClosing(null)
            setError(null)
          }}
          onConfirm={(note) => actor && run(() => automationService.closeEscalation(closing.id, note, actor), () => setClosing(null))}
        />
      )}
    </Card>
  )
}

function ConversationList({ conversations, onOpen }: { conversations: ConciergeConversation[]; onOpen: (c: ConciergeConversation) => void }) {
  const now = useNow()
  const columns: Column<ConciergeConversation>[] = [
    {
      key: 'guest',
      header: 'Guest',
      cell: (c) => (
        <div>
          <p className="font-semibold text-ink">{c.guestName}</p>
          <p className="text-xs text-ink/55">
            {c.reservationId}
            {c.room ? ` · Room ${c.room}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'msgs', header: 'Messages', align: 'right', hideBelow: 'sm', cell: (c) => <span className="tabular-nums">{c.messageCount}</span> },
    {
      key: 'answered',
      header: 'Answered',
      align: 'right',
      hideBelow: 'md',
      cell: (c) => <span className="tabular-nums text-ink/70">{c.answeredCount} by assistant</span>,
    },
    { key: 'last', header: 'Last message', align: 'right', cell: (c) => <span className="text-ink/70">{timeAgo(c.lastMessageAt, now)}</span> },
    { key: 'status', header: '', align: 'right', cell: (c) => <Badge tone={CONV_TONE[c.status]} dot={c.status === 'escalated'}>{c.status}</Badge> },
  ]
  return (
    <Card title="Conversations" icon="guests" count={conversations.length} padded={false}>
      <DataTable columns={columns} rows={conversations} rowKey={(c) => c.id} onRowClick={onOpen} empty={{ title: 'No guest has asked anything yet' }} />
    </Card>
  )
}

function Transcript({ conversation, escalations, onClose }: { conversation: ConciergeConversation; escalations: Escalation[]; onClose: () => void }) {
  const { data: messages } = useAutomationData(() => automationService.listMessages(conversation.id), [], [conversation.id])
  const actor = useActor()
  const { run, busy, error } = useRun()
  const [reply, setReply] = useState('')
  return (
    <Modal
      side
      wide
      title={conversation.guestName}
      description={`${conversation.reservationId}${conversation.room ? ` · Room ${conversation.room}` : ''} · ${escalations.length} escalation${escalations.length === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write to the guest" aria-label="Reply" />
          <Button disabled={busy || reply.trim().length < 2} onClick={() => actor && run(() => automationService.staffReply(conversation.id, reply, actor), () => setReply(''))}>
            Send
          </Button>
        </div>
      }
    >
      <ErrorLine error={error} />
      <ul className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.sender === 'guest' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.sender === 'guest' ? 'bg-canvas text-ink' : m.sender === 'staff' ? 'bg-brand text-white' : 'border border-brand/20 bg-brand/[0.05] text-ink'}`}>
              <p className={`text-[11px] font-semibold ${m.sender === 'staff' ? 'text-white/75' : 'text-ink/50'}`}>
                {m.sender === 'guest' ? conversation.guestName : m.sender === 'staff' ? m.staffName : 'Assistant'} · {dateTime(m.at)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              {m.sender === 'assistant' && (
                <div className="mt-1.5 border-t border-brand/10 pt-1.5">
                  <p className="text-[11px] text-ink/55">
                    {m.intent === 'escalate' ? 'Handed to staff' : m.intent === 'request' ? 'Raised a guest request' : m.intent === 'greeting' ? 'Greeting' : 'Answered from the knowledge base'}
                    {m.confidence !== undefined ? ` · ${Math.round(m.confidence * 100)}% sure` : ''}
                    {m.guestRequestId ? ` · ${m.guestRequestId}` : ''}
                  </p>
                  <Drivers drivers={m.drivers ?? []} compact />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

const blank: KbArticleInput = { topic: '', question: '', answer: '', keywords: [], category: 'faq', requestTitle: '', active: true }

function KnowledgeBase({ kb }: { kb: KbArticle[] }) {
  const { tenant, stayTimes } = useFeatures()
  const actor = useActor()
  const { run, busy, error, setError } = useRun()
  const [editing, setEditing] = useState<(KbArticleInput & { words: string }) | null>(null)
  const [trial, setTrial] = useState('')
  const [answer, setAnswer] = useState<ConciergeReply | null>(null)

  const ctx = { hotelName: tenant.name, checkInTime: stayTimes.checkInTime, checkOutTime: stayTimes.checkOutTime, lateFreeUntil: stayTimes.lateFreeUntil }

  const columns: Column<KbArticle>[] = [
    {
      key: 'topic',
      header: 'Topic',
      cell: (a) => (
        <div className="max-w-[18rem] whitespace-normal">
          <p className="font-semibold text-ink">{a.topic}</p>
          <p className="line-clamp-1 text-xs text-ink/55">{a.answer}</p>
        </div>
      ),
    },
    { key: 'cat', header: 'Kind', cell: (a) => <Badge tone={a.category === 'request' ? 'info' : 'neutral'}>{a.category === 'request' ? 'Request' : 'FAQ'}</Badge> },
    { key: 'kw', header: 'Keywords', hideBelow: 'md', cell: (a) => <span className="text-xs text-ink/60">{a.keywords.slice(0, 4).join(', ')}</span> },
    { key: 'by', header: 'Updated', hideBelow: 'lg', cell: (a) => <span className="text-xs text-ink/55">{a.updatedBy.name}, {dateTime(a.updatedAt)}</span> },
    {
      key: 'on',
      header: 'On',
      align: 'right',
      cell: (a) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch
            on={a.active}
            label={`${a.topic} switched on`}
            disabled={busy}
            onChange={(v) => actor && run(() => automationService.saveKb(tenant.id, { ...a, active: v }, actor))}
          />
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <Card title="Try the assistant" icon="sparkles" description="Ask as a guest would. Nothing is sent to anyone.">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => automationService.preview(tenant.id, trial, ctx), setAnswer)
          }}
        >
          <Input value={trial} onChange={(e) => setTrial(e.target.value)} placeholder="What time is breakfast?" aria-label="Question" />
          <Button type="submit" disabled={!trial.trim()}>
            Ask
          </Button>
        </form>
        {answer && (
          <div className="mt-3 rounded-xl border border-brand/20 bg-brand/[0.04] p-3">
            <p className="text-sm text-ink">{answer.body}</p>
            <p className="mt-1 text-xs text-ink/55">
              {answer.escalate ? `Would go to staff: ${answer.escalate.reason}` : answer.request ? `Would raise a request: ${answer.request.title}` : 'Answered'} · {Math.round(answer.confidence * 100)}% sure
            </p>
            <Drivers drivers={answer.drivers} />
          </div>
        )}
      </Card>

      <Card
        title="Knowledge base"
        icon="list"
        count={kb.length}
        padded={false}
        actions={
          <Button size="sm" onClick={() => setEditing({ ...blank, words: '' })}>
            New article
          </Button>
        }
      >
        <DataTable columns={columns} rows={kb} rowKey={(a) => a.id} onRowClick={(a) => setEditing({ ...a, words: a.keywords.join(', ') })} empty={{ title: 'No articles yet' }} />
      </Card>

      {editing && (
        <Modal
          side
          title={editing.id ? 'Edit article' : 'New article'}
          onClose={() => {
            setEditing(null)
            setError(null)
          }}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  actor &&
                  run(() => automationService.saveKb(tenant.id, { ...editing, keywords: editing.words.split(',') }, actor), () => setEditing(null))
                }
              >
                Save
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <ErrorLine error={error} />
            <Field label="Topic" required>
              {(id) => <Input id={id} value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} />}
            </Field>
            <Field label="Kind">
              {(id) => (
                <Select id={id} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as KbArticle['category'] })}>
                  <option value="faq">FAQ: the assistant answers</option>
                  <option value="request">Request: answered and sent to the desk</option>
                </Select>
              )}
            </Field>
            {editing.category === 'request' && (
              <Field label="Title the desk sees" required>
                {(id) => <Input id={id} value={editing.requestTitle ?? ''} onChange={(e) => setEditing({ ...editing, requestTitle: e.target.value })} />}
              </Field>
            )}
            <Field label="Example question">
              {(id) => <Input id={id} value={editing.question} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />}
            </Field>
            <Field label="Answer" required hint="{checkOutTime}, {checkInTime}, {lateFreeUntil} and {hotelName} fill in from settings.">
              {(id) => <Textarea id={id} rows={4} value={editing.answer} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />}
            </Field>
            <Field label="Keywords" required hint="Separated by commas.">
              {(id) => <Input id={id} value={editing.words} onChange={(e) => setEditing({ ...editing, words: e.target.value })} />}
            </Field>
            <label className="flex items-center gap-3 text-sm text-ink/80">
              <Switch on={editing.active} label="Switched on" onChange={(v) => setEditing({ ...editing, active: v })} />
              Switched on
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
