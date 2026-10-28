import type { Tone } from '../../components/ui'
import type { WorkPriority } from '../../services/workforce/workforceTypes'

export const PRIORITY_TONE: Record<WorkPriority, Tone> = { Urgent: 'bad', High: 'warn', Normal: 'neutral' }

export function hoursText(h: number) {
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, '')} h`
}

export function shortDay(ymd: string) {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function timeOf(iso: string | number) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
