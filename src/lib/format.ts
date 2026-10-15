export const ugx = (amount: number) => 'UGX ' + amount.toLocaleString('en-US')

export const dayMonth = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

export const nightsBetween = (arrival: string, departure: string) =>
  Math.round((new Date(departure + 'T00:00:00Z').getTime() - new Date(arrival + 'T00:00:00Z').getTime()) / 86400000)

// "15 Oct, 14:30" in the browser's local time.
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// "just now", "5 min ago", "3 h ago", then a date.
export function timeAgo(iso: string, now: number) {
  const mins = Math.round((now - Date.parse(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ago`
  return dateTime(iso)
}
