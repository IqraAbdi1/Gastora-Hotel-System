import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Modal, Segmented } from './ui'
import { parseMrz } from '../lib/mrz'
import type { MrzRead } from '../lib/mrz'
import { readIdImage, readerLoaded, releaseReader } from '../lib/mrzOcr'

/** Where the characters came from. It is kept with the guest record, because it says how much to trust them. */
export type ScanSource = 'camera' | 'photo' | 'typed'

type Props = {
  /** The ID photograph already taken at the desk, if there is one. */
  photo?: string
  onUse: (read: MrzRead, source: ScanSource, photo?: string) => void
  onClose: () => void
}

type Way = 'camera' | 'photo' | 'typed'

const SOURCE_NOTE: Record<ScanSource, string> = {
  camera: 'Read from the card by camera',
  photo: 'Read from the photograph of the ID',
  typed: 'Typed from the strip on the card',
}

// Showing the ID to a camera instead of typing nine fields. The strip on the back of a national ID, or
// the two lines at the foot of a passport, carry the same details as the printed side and a check digit
// for each one, so a misread is caught here instead of ending up on an invoice.
export default function IdScanSheet({ photo, onUse, onClose }: Props) {
  const [way, setWay] = useState<Way>(photo ? 'photo' : 'camera')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [shot, setShot] = useState<string | undefined>()
  const [read, setRead] = useState<{ read: MrzRead; source: ScanSource; photo?: string } | null>(null)
  const [seen, setSeen] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  // The camera is only held while it is being looked at.
  useEffect(() => {
    if (way !== 'camera' || read) {
      stop()
      return
    }
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const name = (e as { name?: string }).name
        setError(
          name === 'NotAllowedError'
            ? 'The camera was not allowed. Allow it for this site, or use the photograph of the ID instead.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device. Use the photograph of the ID, or type the strip.'
              : 'The camera could not be opened. Use the photograph of the ID, or type the strip.',
        )
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [way, read])

  useEffect(() => () => void releaseReader(), [])

  const typedResult = useMemo(() => (typed.trim() === '' ? null : parseMrz(typed)), [typed])

  async function readImage(dataUrl: string, source: ScanSource) {
    setBusy(true)
    setError('')
    setNote(readerLoaded() ? 'Reading the strip' : 'Getting the reader ready. This happens once.')
    try {
      const attempt = await readIdImage(dataUrl, setNote)
      setSeen(attempt.text)
      if (attempt.result.ok) setRead({ read: attempt.result.read, source, photo: dataUrl })
      else setError(attempt.result.reason)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'The ID could not be read.')
    } finally {
      setBusy(false)
      setNote('')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setError('The camera is not ready yet.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setShot(dataUrl)
    stop()
    void readImage(dataUrl, 'camera')
  }

  const ways: { key: Way; label: string }[] = [
    { key: 'camera', label: 'Camera' },
    { key: 'photo', label: 'A photo' },
    { key: 'typed', label: 'Type the strip' },
  ]

  function again() {
    setRead(null)
    setError('')
    setSeen('')
    setShot(undefined)
  }

  return (
    <Modal
      title="Read the ID"
      description="The strip on the back of an ID or foot of a passport."
      onClose={onClose}
      wide
      header={
        read ? undefined : (
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              options={ways}
              value={way}
              onChange={(k) => {
                setError('')
                setSeen('')
                setWay(k)
              }}
              label="How to read the ID"
            />
            <span className="text-xs text-ink/55">A driving permit has no strip and is still typed.</span>
          </div>
        )
      }
      footer={
        read ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={again}>
              Read it again
            </Button>
            <Button onClick={() => onUse(read.read, read.source, read.photo)}>Use these details</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-ink/55">Nothing is saved until you confirm what was read.</span>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )
      }
    >
      {read ? (
        <Review read={read.read} source={read.source} photo={read.photo} />
      ) : (
        <div className="space-y-4">
          {way === 'camera' && (
            <div>
              <div className="relative overflow-hidden rounded-xl bg-ink">
                {shot ? (
                  <img src={shot} alt="The ID as it was captured" className="max-h-[22rem] w-full object-contain" />
                ) : (
                  <video ref={videoRef} playsInline muted className="max-h-[22rem] w-full bg-ink object-contain" />
                )}
                {!shot && (
                  <div className="pointer-events-none absolute inset-x-6 bottom-6 h-16 rounded-md border-2 border-dashed border-white/80">
                    <span className="absolute -top-6 left-0 text-xs font-semibold text-white/90">Put the lines of letters and numbers in here</span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={capture} disabled={busy}>
                  {busy ? 'Reading' : 'Capture and read'}
                </Button>
                {shot && !busy && (
                  <Button variant="ghost" onClick={again}>
                    Take it again
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-ink/55">
                A phone camera held flat works best.
              </p>
            </div>
          )}

          {way === 'photo' && (
            <div>
              {photo ? (
                <div className="flex flex-wrap items-start gap-4">
                  <img src={photo} alt="The photograph of the ID" className="h-32 w-52 rounded-lg border border-ink/15 object-cover" />
                  <div>
                    <Button onClick={() => void readImage(photo, 'photo')} disabled={busy}>
                      {busy ? 'Reading' : 'Read this photo'}
                    </Button>
                    <p className="mt-2 text-xs text-ink/55">This is the photo already taken at the ID step.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink/70">No photo of the ID has been taken yet.</p>
              )}
              <div className="mt-3">
                <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
                  Choose another picture
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => void readImage(reader.result as string, 'photo')
                    reader.readAsDataURL(file)
                  }}
                />
              </div>
            </div>
          )}

          {way === 'typed' && (
            <div>
              <label htmlFor="mrz-lines" className="text-sm font-medium text-ink/80">
                The strip, one line per line
              </label>
              <textarea
                id="mrz-lines"
                rows={4}
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                placeholder={'IDUGA CM91012345...\n9102158F3012317UGA...\nNAKATO<<AMINA<GRACE<<<'}
                className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 font-mono text-sm tracking-wider text-ink focus:border-brand focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink/55">
                Three lines on an ID card, two on a passport.
              </p>
              {typedResult && !typedResult.ok && <p className="mt-2 text-sm text-bad">{typedResult.reason}</p>}
              {typedResult?.ok && (
                <div className="mt-3">
                  <Button onClick={() => setRead({ read: typedResult.read, source: 'typed', photo })}>Check what this says</Button>
                </div>
              )}
            </div>
          )}

          {busy && <p className="text-sm font-medium text-brand">{note || 'Working'}</p>}
          {error && (
            <div className="rounded-lg bg-bad/[0.06] p-3">
              <p className="text-sm font-medium text-bad">{error}</p>
              {seen.trim() !== '' && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-ink/60">What the camera saw</summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-ink/60">{seen.trim()}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Line({ label, value, trusted = true }: { label: string; value: string; trusted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/5 py-1.5 text-sm last:border-0">
      <dt className="text-ink/60">{label}</dt>
      <dd className="text-right font-semibold text-ink">
        {value || <span className="font-normal text-ink/40">not in the strip</span>}
        {!trusted && value && <span className="ml-2 align-middle text-xs font-semibold text-warn">check this</span>}
      </dd>
    </div>
  )
}

/** What was read, before it is allowed anywhere near a guest record. */
function Review({ read, source, photo }: { read: MrzRead; source: ScanSource; photo?: string }) {
  const clean = read.doubtful.length === 0 && read.wholeStripTrusted
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={clean ? 'good' : 'warn'} dot>
          {clean ? 'Every check digit agrees' : 'Some characters are doubtful'}
        </Badge>
        <Badge tone="neutral">{read.format === 'TD3' ? 'Passport' : 'Identity card'}</Badge>
        <span className="text-xs text-ink/55">{SOURCE_NOTE[source]}</span>
      </div>

      {!clean && (
        <p className="rounded-lg bg-warn/[0.08] p-3 text-sm text-ink/80">
          {read.doubtful.length > 0
            ? `The card's own check digits disagree with ${read.doubtful.join(' and ')}. Compare ${
                read.doubtful.length > 1 ? 'those fields' : 'that field'
              } with the printed side of the ID.`
            : 'The strip check failed. Compare with the printed side of the ID.'}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <dl>
          <Line label="Name on the ID" value={read.fullName} />
          <Line label="ID number" value={read.documentNumber.value} trusted={read.documentNumber.trusted} />
          <Line label="Type" value={read.format === 'TD3' ? 'Passport' : 'National ID'} />
          <Line label="Nationality" value={read.nationalityLabel} />
          <Line label="Date of birth" value={read.dateOfBirth.value} trusted={read.dateOfBirth.trusted} />
          <Line label="Expires" value={read.expiry.value} trusted={read.expiry.trusted} />
          <Line label="Sex" value={read.sex} />
        </dl>
        {photo && <img src={photo} alt="The ID that was read" className="h-28 w-44 rounded-lg border border-ink/15 object-cover" />}
      </div>

      <details>
        <summary className="cursor-pointer text-xs font-semibold text-ink/60">The strip itself</summary>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-ink/60">{read.lines.join('\n')}</pre>
      </details>

    </div>
  )
}
