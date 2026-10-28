import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '../../components/ui'
import { dayMonth } from '../../lib/format'
import { isRealPhoto } from '../../lib/roomPhotos'
import type { StoredPhoto } from '../../lib/roomPhotos'
import { shrinkPhoto } from './photoShrink'

/**
 * A button that takes a photo. On a phone it opens the camera; on a computer it opens the file picker.
 * The photo is shrunk before it is handed on. IdPhotoInput does the single ID photo at the desk; this one
 * shrinks the picture and can be used again and again, which a room needs.
 */
export function TakePhotoButton({
  onPhoto,
  disabled,
  label = 'Add photo',
  size = 'sm',
}: {
  onPhoto: (src: string) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setBusy(true)
    try {
      onPhoto(await shrinkPhoto(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That photo could not be used.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button variant="secondary" size={size} disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Preparing…' : label}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={pick}
        className="hidden"
        aria-label={label}
        data-testid="photo-input"
      />
      {error && <span className="mt-1 text-xs text-bad">{error}</span>}
    </span>
  )
}

/** Small pictures in a grid. Tap one to see it large. Old text placeholders show as placeholders. */
export function PhotoThumbs({
  photos,
  onRemove,
  alt = 'Room photo',
  compact = false,
}: {
  photos: StoredPhoto[]
  onRemove?: (index: number) => void
  alt?: string
  /** Small squares with no caption, for a row in a list. */
  compact?: boolean
}) {
  const [open, setOpen] = useState<number | null>(null)
  const shown = open === null ? null : photos[open]

  return (
    <>
      <div className={compact ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-3 gap-2 sm:grid-cols-4'}>
        {photos.map((photo, i) =>
          isRealPhoto(photo) ? (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpen(i)}
              className={`group relative overflow-hidden rounded-lg border border-ink/10 bg-canvas ${compact ? 'h-12 w-12' : 'aspect-square'}`}
              aria-label={`Open photo ${i + 1}, taken by ${photo.by}`}
            >
              <img src={photo.src} alt={alt} className="h-full w-full object-cover transition group-hover:scale-105" />
              {!compact && (
                <span className="absolute inset-x-0 bottom-0 truncate bg-ink/55 px-1.5 py-0.5 text-left text-[11px] text-white">
                  {photo.by} · {photo.time}
                </span>
              )}
            </button>
          ) : (
            <div
              key={`${photo}-${i}`}
              className="relative flex aspect-square items-center justify-center rounded-lg border border-dashed border-ink/20 bg-canvas p-1 text-center text-xs text-ink/60"
            >
              {photo}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove ${photo}`}
                  className="absolute top-0.5 right-1 text-sm leading-none text-ink/40 hover:text-bad"
                >
                  ×
                </button>
              )}
            </div>
          ),
        )}
      </div>
      {shown && isRealPhoto(shown) && open !== null && (
        <PhotoViewer
          src={shown.src}
          caption={`Taken by ${shown.by} · ${dayMonth(shown.day)} at ${shown.time}`}
          alt={alt}
          onClose={() => setOpen(null)}
          onRemove={
            onRemove
              ? () => {
                  onRemove(open)
                  setOpen(null)
                }
              : undefined
          }
        />
      )}
    </>
  )
}

/** The photo large, over everything, including an open room panel. Escape closes only this. */
function PhotoViewer({
  src,
  caption,
  alt,
  onClose,
  onRemove,
}: {
  src: string
  caption: string
  alt: string
  onClose: () => void
  onRemove?: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    // Caught before the room panel's own listener, so Escape closes the photo and not the panel under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ink/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <img src={src} alt={alt} className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-xl" />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-white">
        <span className="mr-2">{caption}</span>
        {onRemove &&
          (confirm ? (
            <>
              <span>Remove this photo?</span>
              <Button size="sm" variant="danger" onClick={onRemove}>
                Yes, remove
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
              Remove
            </Button>
          ))}
        <Button size="sm" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
