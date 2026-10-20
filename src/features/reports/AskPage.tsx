import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Chip, EmptyState, Input, PageHeader } from '../../components/ui'
import { analyticsAssistant, reportsService } from '../../services'
import type { AssistantAnswer, AssistantContext } from '../../services/reports/analyticsAssistant'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'
import { SampleBadge } from './ReportsUi'
import { useActor } from './reportsUtils'
import { useCostProfile, useQuestions } from './useReports'
import { useReportFacts } from './useReportFacts'

type Turn = { id: number; question: string; answer: AssistantAnswer }

export default function AskPage() {
  const facts = useReportFacts()
  const cost = useCostProfile()
  const { features, tenant } = useFeatures()
  const { canOpen, can, role } = useAuth()
  const actor = useActor()
  const history = useQuestions()
  const [text, setText] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ctx: AssistantContext = { facts, cost, permissions: { canOpen, can, features } }
  const suggestions = analyticsAssistant.suggestions(ctx)

  async function ask(question: string) {
    const q = question.trim()
    if (!q) {
      setError('Type a question')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const answer = await analyticsAssistant.ask(q, ctx)
      await reportsService.recordQuestion(
        tenant.id,
        { question: q, intent: answer.intent, answered: answer.understood && !answer.refusal, refusal: answer.refusal ?? (answer.understood ? undefined : 'Not understood'), sourceCount: answer.sources.length },
        actor,
      )
      setTurns((t) => [{ id: Date.now(), question: q, answer }, ...t])
      setText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer')
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void ask(text)
  }

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Reports" title="Ask" description="Ask about the hotel in plain words. Every answer lists its records." meta={role && <Badge tone="neutral">As {role.label}</Badge>} />

      <form onSubmit={submit} className="flex gap-2">
        <Input aria-label="Question" value={text} onChange={(e) => setText(e.target.value)} placeholder="What was occupancy last week?" maxLength={200} />
        <Button type="submit" disabled={busy}>
          Ask
        </Button>
      </form>
      {error && <p className="text-sm font-medium text-bad">{error}</p>}

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Chip key={s} active={false} onClick={() => void ask(s)}>
              {s}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink/55">Your role cannot open the pages these answers come from.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-4">
          {turns.length === 0 ? (
            <Card>
              <EmptyState title="No questions yet" hint="Pick one above or type your own." />
            </Card>
          ) : (
            turns.map((t) => <AnswerCard key={t.id} turn={t} />)
          )}
        </div>
        <Card title="Asked recently" icon="list" count={history.length} className="self-start">
          {history.length === 0 ? (
            <p className="text-sm text-ink/55">Nothing asked yet.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {history.slice(0, 12).map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => void ask(h.question)} className="block w-full text-left hover:text-brand">
                    <span className="block truncate font-medium text-ink">{h.question}</span>
                    <span className="flex items-center gap-1.5 text-xs text-ink/55">
                      <span className={`h-1.5 w-1.5 rounded-full ${h.answered ? 'bg-good' : 'bg-warn'}`} />
                      {h.answered ? `${h.sourceCount} sources` : h.refusal} · {h.askedBy} · {h.askedAt.slice(11)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function AnswerCard({ turn }: { turn: Turn }) {
  const a = turn.answer
  const [showAll, setShowAll] = useState(false)
  const sources = showAll ? a.sources : a.sources.slice(0, 6)
  return (
    <Card
      title={turn.question}
      icon="sparkles"
      description={a.periodLabel}
      actions={a.usesSample ? <SampleBadge label="Uses sample data" /> : a.refusal ? <Badge tone="warn">No access</Badge> : !a.understood ? <Badge tone="neutral">Not understood</Badge> : undefined}
    >
      <div className="space-y-3">
        {a.value && <p className="text-[26px] font-bold leading-tight tabular-nums text-ink">{a.value}</p>}
        <p className={`text-sm ${a.refusal ? 'text-warn' : 'text-ink/75'}`}>{a.text}</p>

        {a.table && a.table.rows.length > 0 && (
          <div className="-mx-4 overflow-x-auto border-y border-ink/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas/50">
                  {a.table.columns.map((c) => (
                    <th key={c.key} className={`px-4 py-2 text-xs font-semibold text-ink/55 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {a.table.rows.map((r, i) => (
                  <tr key={i}>
                    {a.table?.columns.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-4 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                        {r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {a.sources.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink/55">Sources · {a.sources.length}</p>
            <ul className="space-y-1.5 text-sm">
              {sources.map((s) => (
                <li key={`${s.kind}-${s.id}`} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    {s.to ? (
                      <Link to={s.to} className="font-medium text-brand hover:underline">
                        {s.label}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{s.label}</span>
                    )}
                    <span className="block truncate text-xs text-ink/55">{s.detail}</span>
                  </span>
                  <Badge tone={s.kind.includes('sample') || s.kind.includes('Cost') ? 'warn' : 'neutral'}>{s.kind}</Badge>
                </li>
              ))}
            </ul>
            {a.sources.length > 6 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-semibold text-brand hover:underline">
                {showAll ? 'Show fewer' : `Show all ${a.sources.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
