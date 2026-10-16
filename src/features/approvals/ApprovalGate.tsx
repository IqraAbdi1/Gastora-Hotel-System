import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Field, Input } from '../../components/ui'
import { approvalFor, checkPin } from '../../lib/approvals'
import type { ApprovalLimits, ApprovalRecord } from '../../lib/approvals'
import type { PlanId } from '../../lib/features'
import { ugx } from '../../lib/format'
import { USERS } from '../../lib/roles'
import type { RoleId } from '../../lib/roles'

export type Approver = { name: string; role: RoleId; photo?: string }

/** Takes the approver's picture when their PIN is accepted. Proof of who was standing at the desk. */
function ApproverPhoto({ onShot, onFail }: { onShot: (dataUrl: string) => void; onFail: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          void videoRef.current.play()
        }
        setReady(true)
      })
      .catch(() => {
        setFailed(true)
        onFail()
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onFail])

  function take() {
    const v = videoRef.current
    if (!v) return
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height)
    onShot(canvas.toDataURL('image/jpeg', 0.7))
  }

  if (failed)
    return (
      <p className="rounded-lg border border-warn/30 bg-warn/10 p-2.5 text-xs text-warn">
        No camera on this computer. The approval is recorded without a photo.
      </p>
    )

  return (
    <div className="space-y-2">
      <video ref={videoRef} muted playsInline className="h-40 w-full rounded-lg border border-ink/15 bg-ink/80 object-cover" />
      <Button size="sm" onClick={take} disabled={!ready}>
        Take the photo
      </Button>
    </div>
  )
}

type Props = {
  amount: number
  limits: ApprovalLimits
  plan: PlanId
  kind: ApprovalRecord['kind']
  /** What is being approved, in words. */
  what: string
  onCancel: () => void
  onApproved: (approvers: Approver[], photoSkipped: boolean) => void
}

// The approval ladder on screen. The amount decides who may approve, the PIN says who they are,
// and the photo says who was there. A large amount needs two different people.
export default function ApprovalGate({ amount, limits, plan, kind, what, onCancel, onApproved }: Props) {
  const need = approvalFor(amount, limits, plan)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [approvers, setApprovers] = useState<Approver[]>([])
  const [pending, setPending] = useState<Approver | null>(null)
  const [noCamera, setNoCamera] = useState(false)

  const needed = need.coSign ? 2 : 1
  const photoNeeded = limits.photoRequired && !noCamera

  function submitPin() {
    const used = approvers.map((a) => USERS.find((u) => u.name === a.name)?.id ?? '')
    const result = checkPin(pin, need, USERS, used)
    if (!result.ok) {
      setError(result.why)
      return
    }
    setError('')
    setPin('')
    const who: Approver = { name: result.user.name, role: result.user.role }
    if (photoNeeded) setPending(who)
    else finish([...approvers, who])
  }

  function finish(list: Approver[]) {
    setApprovers(list)
    if (list.length >= needed) onApproved(list, noCamera && limits.photoRequired)
  }

  return (
    <div className="space-y-3 rounded-xl border border-warn/30 bg-warn/[0.08] p-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">Approval needed: {need.label}</p>
          {need.coSign && <Badge tone="bad">Two people</Badge>}
          {limits.photoRequired && <Badge tone="warn">Photo</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-ink/70">
          {ugx(amount)} · {what}. {need.because}
        </p>
      </div>

      {approvers.length > 0 && (
        <ul className="space-y-1">
          {approvers.map((a) => (
            <li key={a.name} className="flex items-center gap-2 text-xs font-semibold text-good">
              {a.photo && <img src={a.photo} alt="" className="h-8 w-10 rounded border border-ink/15 object-cover" />}
              {a.name} signed{a.photo ? ' with a photo' : ''}
            </li>
          ))}
        </ul>
      )}

      {pending ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink/80">
            {pending.name}, look at the camera. The photo is saved with this approval.
          </p>
          <ApproverPhoto
            onShot={(photo) => {
              const who = { ...pending, photo }
              setPending(null)
              finish([...approvers, who])
            }}
            onFail={() => {
              setNoCamera(true)
              const who = pending
              setPending(null)
              finish([...approvers, who])
            }}
          />
        </div>
      ) : (
        approvers.length < needed && (
          <div className="space-y-2">
            <Field
              label={approvers.length === 0 ? `${need.label}: enter your PIN` : 'Second approval: a different person'}
              error={error || undefined}
              hint={error ? undefined : 'The manager types it themselves. Do not type it for them.'}
            >
              {(id) => (
                <Input
                  id={id}
                  value={pin}
                  inputMode="numeric"
                  type="password"
                  maxLength={6}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                  placeholder="••••"
                  className="w-32"
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button size="sm" onClick={submitPin} disabled={pin.length < 4}>
                Check PIN
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        )
      )}

      <p className="text-xs text-ink/55">
        {kind === 'charge-reversal' ? 'Cancelling a charge' : 'Releasing a valuable'} is listed for the manager to review today.
      </p>
    </div>
  )
}
