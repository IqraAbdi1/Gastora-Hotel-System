import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const inputClass =
  'w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-canvas disabled:text-ink/50'

// Label, control, then a hint or an error. The control is passed the id so the label points at it.
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink/80">
        {label}
        {required && <span className="text-bad"> *</span>}
      </label>
      {children(id)}
      {error ? <p className="text-xs font-medium text-bad">{error}</p> : hint && <p className="text-xs text-ink/55">{hint}</p>}
    </div>
  )
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClass} ${className}`} {...rest} />
}

export function Select({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${inputClass} ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClass} ${className}`} {...rest} />
}
