import { PHOTO_MAX_SIDE } from '../../lib/roomPhotos'

/**
 * Shrinks a photo in the browser before it is kept: the longest side to PHOTO_MAX_SIDE and saved as JPEG.
 * A phone photo of 4 MB becomes roughly 150 to 250 KB. Browser only (it draws on a canvas).
 */
export async function shrinkPhoto(file: File, maxSide = PHOTO_MAX_SIDE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('That photo could not be opened. Try another one.'))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot prepare the photo.')
    // White behind a transparent picture, since JPEG has no transparency.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    // Step the quality down until the photo is a sensible size.
    let quality = 0.72
    let out = canvas.toDataURL('image/jpeg', quality)
    while (out.length > 360_000 && quality > 0.4) {
      quality -= 0.12
      out = canvas.toDataURL('image/jpeg', quality)
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
