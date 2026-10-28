// Turning a photograph of an ID into the characters of its machine-readable strip.
//
// Two honest limits, stated here because they decide where this is worth using:
// a phone camera held over a flat card reads the strip well; a laptop webcam at a desk often does not,
// because of glare and too few pixels across 30 characters. And the reading engine is downloaded the
// first time it is used, so the first scan needs the internet even though later ones do not.
//
// Nothing read here is trusted on its own. Every field goes through the check digits in mrz.ts, and
// whatever comes out is shown to the receptionist to confirm before it reaches a guest record.

import { parseMrz } from './mrz'
import type { MrzResult } from './mrz'

const VERSION = '5.1.1'
const SCRIPT = `https://cdn.jsdelivr.net/npm/tesseract.js@${VERSION}/dist/tesseract.min.js`

/** Only the characters the strip is allowed to contain. Narrowing this is most of the accuracy. */
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'

// A strip is not printed in an ordinary typeface. It is set in OCR-B, a face drawn in the 1960s so that
// a machine could tell O from 0 and the filler character from a letter. A reader trained on English
// prose does not know that face: it reads the filler as K or L and turns a name into a different name.
// This is a reader trained on the strip itself, which is the difference between a demonstration and a
// feature. If it cannot be fetched, English is used and the check digits catch what it gets wrong.
const MRZ_MODEL = 'https://raw.githubusercontent.com/DoubangoTelecom/tesseractMRZ/master/tessdata_fast'

interface OcrWorker {
  setParameters(p: Record<string, string>): Promise<unknown>
  recognize(image: HTMLCanvasElement): Promise<{ data: { text: string } }>
  terminate(): Promise<unknown>
}

interface TesseractGlobal {
  createWorker(
    lang: string,
    oem: number,
    options?: {
      logger?: (m: { status: string; progress: number }) => void
      /** Where to fetch the character model from, when it is not the one bundled with the reader. */
      langPath?: string
      /** The model here is served as it is, not compressed. */
      gzip?: boolean
    },
  ): Promise<OcrWorker>
}

type Note = (text: string) => void

let scriptLoad: Promise<TesseractGlobal> | null = null
let workerLoad: Promise<OcrWorker> | null = null

/** Whether the engine is already here, so the desk can be told the first scan is the slow one. */
export const readerLoaded = () => workerLoad !== null

function loadScript(): Promise<TesseractGlobal> {
  if (scriptLoad) return scriptLoad
  scriptLoad = new Promise<TesseractGlobal>((resolve, reject) => {
    const existing = (window as unknown as { Tesseract?: TesseractGlobal }).Tesseract
    if (existing) return resolve(existing)
    const tag = document.createElement('script')
    tag.src = SCRIPT
    tag.async = true
    tag.onload = () => {
      const t = (window as unknown as { Tesseract?: TesseractGlobal }).Tesseract
      if (t) resolve(t)
      else reject(new Error('The reader loaded but did not start.'))
    }
    tag.onerror = () => {
      scriptLoad = null
      reject(new Error('The reader could not be downloaded. Check the internet connection, or type the strip instead.'))
    }
    document.head.appendChild(tag)
  })
  return scriptLoad
}

/** Start the reader, downloading it the first time. */
export async function loadReader(note?: Note): Promise<OcrWorker> {
  if (workerLoad) return workerLoad
  workerLoad = (async () => {
    note?.('Getting the reader ready')
    const Tesseract = await loadScript()
    const logger = (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') note?.(`Reading the strip, ${Math.round(m.progress * 100)}%`)
      else note?.('Getting the reader ready')
    }
    const worker = await Tesseract.createWorker('mrz', 1, { logger, langPath: MRZ_MODEL, gzip: false }).catch(async () => {
      note?.('Getting the reader ready')
      return Tesseract.createWorker('eng', 1, { logger })
    })
    await worker.setParameters({
      tessedit_char_whitelist: CHARSET,
      // The strip is a block of lines of one size, not a page of prose.
      tessedit_pageseg_mode: '6',
      classify_bln_numeric_mode: '0',
    })
    return worker
  })().catch((e: unknown) => {
    workerLoad = null
    throw e
  })
  return workerLoad
}

/** Let go of the reader when the desk closes the scanner, so a phone is not left holding it. */
export async function releaseReader(): Promise<void> {
  const held = workerLoad
  workerLoad = null
  if (!held) return
  try {
    const worker = await held
    await worker.terminate()
  } catch {
    // Nothing to release.
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That image could not be opened.'))
    img.src = src
  })
}

/** The brightness that best separates ink from card, worked out from the picture itself. */
function threshold(grey: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < grey.length; i += 1) hist[grey[i]] += 1
  const total = grey.length
  let sum = 0
  for (let i = 0; i < 256; i += 1) sum += i * hist[i]
  let back = 0
  let weightBack = 0
  let best = 0
  let cut = 128
  for (let t = 0; t < 256; t += 1) {
    weightBack += hist[t]
    if (weightBack === 0) continue
    const weightFore = total - weightBack
    if (weightFore === 0) break
    back += t * hist[t]
    const meanBack = back / weightBack
    const meanFore = (sum - back) / weightFore
    const between = weightBack * weightFore * (meanBack - meanFore) ** 2
    if (between > best) {
      best = between
      cut = t
    }
  }
  return cut
}

/**
 * The picture, made readable: the part of it that holds the strip, enlarged to a size the reader can
 * work with, drained of colour and reduced to ink and paper.
 */
export async function prepareImage(dataUrl: string, bottomFraction = 1): Promise<HTMLCanvasElement> {
  const img = await loadImage(dataUrl)
  const sliceTop = Math.round(img.naturalHeight * (1 - bottomFraction))
  const sliceHeight = img.naturalHeight - sliceTop
  const scale = Math.min(3, Math.max(1, 1600 / Math.max(1, img.naturalWidth)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(sliceHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot prepare the image.')
  ctx.drawImage(img, 0, sliceTop, img.naturalWidth, sliceHeight, 0, 0, canvas.width, canvas.height)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = frame.data
  const grey = new Uint8Array(px.length / 4)
  for (let i = 0, g = 0; i < px.length; i += 4, g += 1) {
    grey[g] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
  }
  const cut = threshold(grey)
  for (let i = 0, g = 0; i < px.length; i += 4, g += 1) {
    const v = grey[g] > cut ? 255 : 0
    px[i] = v
    px[i + 1] = v
    px[i + 2] = v
    px[i + 3] = 255
  }
  ctx.putImageData(frame, 0, 0)
  return canvas
}

export interface ScanAttempt {
  /** Everything the reader saw, kept so a failed scan can be looked at. */
  text: string
  result: MrzResult
}

/**
 * Read an ID from a photograph. The whole picture is tried first; if the strip is not found, the lower
 * part of the card is tried on its own, enlarged, which is where the strip always is.
 */
export async function readIdImage(dataUrl: string, note?: Note): Promise<ScanAttempt> {
  const worker = await loadReader(note)
  let last: ScanAttempt = { text: '', result: { ok: false, reason: 'Nothing was read.' } }
  for (const fraction of [1, 0.45, 0.3]) {
    const canvas = await prepareImage(dataUrl, fraction)
    const out = await worker.recognize(canvas)
    const text = out.data.text ?? ''
    const result = parseMrz(text)
    last = { text, result }
    if (result.ok) return last
    note?.('Looking again at the bottom of the card')
  }
  return last
}
