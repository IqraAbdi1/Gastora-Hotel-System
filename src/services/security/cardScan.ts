// Finds card numbers typed where they should never be: 13 to 19 digits, with spaces or dashes
// allowed between them, that pass the Luhn check. Other long numbers (phones, TINs) are left alone.

const CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g

/** Luhn check, used to tell a card number from any other long number. */
export function luhnOk(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export interface CardHit {
  /** The text as typed, for locating it. Never shown in full. */
  raw: string
  last4: string
  brand: string
}

function brandOf(d: string): string {
  if (/^4/.test(d)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard'
  if (/^3[47]/.test(d)) return 'Amex'
  return 'Card'
}

export function findCardNumbers(text: string): CardHit[] {
  const hits: CardHit[] = []
  for (const m of text.matchAll(CANDIDATE)) {
    const d = m[0].replace(/\D/g, '')
    if (d.length >= 13 && d.length <= 19 && luhnOk(d)) hits.push({ raw: m[0], last4: d.slice(-4), brand: brandOf(d) })
  }
  return hits
}

/** The text with every card number replaced by its last four digits. */
export function redactCardNumbers(text: string): string {
  return text.replace(CANDIDATE, (m) => {
    const d = m.replace(/\D/g, '')
    return d.length >= 13 && luhnOk(d) ? `[card •••• ${d.slice(-4)} removed]` : m
  })
}

/** A snippet safe to show: the card number masked to its last four digits. */
export const maskedText = redactCardNumbers
