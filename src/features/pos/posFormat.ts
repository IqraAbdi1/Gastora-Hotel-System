import { ugx } from '../../lib/format'

// The same "UGX 22,000" the rest of the app prints, rather than the browser's own "USh".
export const cash = (n: number) => ugx(Math.round(n))

export const pct = (n: number) => `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`
