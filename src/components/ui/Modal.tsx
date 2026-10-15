import { useEffect } from 'react'
import type { ReactNode } from 'react'
import Button from './Button'

// A dialog over the page. Escape or a click on the backdrop closes it.
// `side` slides it in from the right, for longer forms and record details.
export function Modal({
  title,
  description,
  onClose,
  side = false,
  wide = false,
  footer,
  children,
}: {
  title: string
  description?: ReactNode
  onClose: () => void
  side?: boolean
  /** More room, for record details with several sections. */
  wide?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-ink/40 ${side ? 'justify-end' : 'items-start justify-center overflow-y-auto p-4 sm:items-center'}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex flex-col bg-surface shadow-xl ${
          side
            ? `h-full w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`
            : `max-h-[calc(100vh-2rem)] w-full rounded-xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink/60">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg px-2 py-1 text-lg leading-none text-ink/50 hover:bg-canvas hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

// "Are you sure?" for actions that are hard to undo.
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink/80">{message}</div>
    </Modal>
  )
}
