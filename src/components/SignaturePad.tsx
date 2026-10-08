import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type Props = { onChange: (dataUrl: string | null) => void }

export default function SignaturePad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    }
  }

  function start(e: PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const p = point(e)
    drawing.current = true
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#11302C'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    c.setPointerCapture(e.pointerId)
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    setHasInk(true)
    onChange(canvasRef.current!.toDataURL('image/png'))
  }

  function clear() {
    const c = canvasRef.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={480}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full rounded-lg border border-dashed border-ink/30 bg-white"
        style={{ touchAction: 'none' }}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-ink/60">
        <span>{hasInk ? 'Signature captured' : 'Sign above with mouse, finger or stylus'}</span>
        <button type="button" onClick={clear} className="font-semibold text-brand">Clear</button>
      </div>
    </div>
  )
}