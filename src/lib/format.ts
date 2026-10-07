export const ugx = (amount: number) => 'UGX ' + amount.toLocaleString('en-US')

export const dayMonth = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

export const nightsBetween = (arrival: string, departure: string) =>
  Math.round((new Date(departure + 'T00:00:00Z').getTime() - new Date(arrival + 'T00:00:00Z').getTime()) / 86400000)