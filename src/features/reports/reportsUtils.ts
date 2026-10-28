import type { NewReportSchedule } from '../../services/reports/reportsTypes'
import type { Actor } from '../../services/types'
import { useAuth } from '../auth/authContext'

// Small helpers shared by the reports pages.

export function useActor(): Actor {
  const { user } = useAuth()
  return { id: user?.id ?? 'unknown', name: user?.name ?? 'Unknown' }
}

export function downloadFile(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  // A byte-order mark so Excel reads the file as UTF-8.
  const blob = new Blob(['﻿', text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** "+12% vs last year", or nothing to compare against. */
export function deltaWords(now: number, before: number, against: string): string {
  if (!before) return `No figure ${against}`
  const pct = Math.round(((now - before) / Math.abs(before)) * 1000) / 10
  return `${pct > 0 ? '+' : ''}${pct}% ${against}`
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function frequencyWords(s: Pick<NewReportSchedule, 'frequency' | 'weekday' | 'monthDay' | 'sendAt'>) {
  if (s.frequency === 'daily') return `Daily at ${s.sendAt}`
  if (s.frequency === 'weekly') return `${WEEKDAYS[s.weekday]}s at ${s.sendAt}`
  return `Day ${s.monthDay} of each month at ${s.sendAt}`
}

