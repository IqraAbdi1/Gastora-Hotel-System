import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

type Props = {
  value?: string
  onChange: (dataUrl: string | undefined) => void
}

export default function IdPhotoInput({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('Image is over 3 MB. Please use a smaller photo.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = () => onChange(reader.result as string)
    reader.readAsDataURL(file)
  }

  function remove() {
    onChange(undefined)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="ID" className="h-20 w-32 rounded-lg border border-ink/15 object-cover" />
          <button type="button" onClick={remove} className="text-sm font-semibold text-bad">Remove</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-ink/30 px-3 py-4 text-sm text-ink/70 hover:border-brand"
        >
          Take or upload ID photo
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  )
}