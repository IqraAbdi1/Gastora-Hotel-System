// Merging two records of the same person.
//
// Duplicates are not an edge case. A guest telephones, then books online with a different spelling,
// then walks in and gives a nickname: three records, one person, and from then on every number about
// her is wrong. Her tier is wrong because her stays are split three ways, her history is wrong at the
// desk, and the hotel counts three guests where it has one.
//
// The rules merging follows, in order of how much trouble each one saves:
//
//   1. Nothing is thrown away. The record being kept wins where both have a value; the other's values
//      fill its blanks; and anything that genuinely disagrees is shown to the person deciding rather
//      than silently resolved.
//   2. Consent is never upgraded by merging. If one record says the guest agreed to marketing and the
//      other says they did not, the more recent answer stands - and if the merge would turn a no into
//      a yes, it is marked, because consent is the one field a hotel must be able to defend.
//   3. Every stay moves. A merge that leaves bookings pointing at a record nobody can open is worse
//      than the duplicate was.
//   4. The merge is written down on the record that survives: what was merged, by whom, when.
//
// Pure rules only: no React.

import type { Guest, GuestNote, Reservation } from '../types'

const filled = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== ''

export interface FieldClash {
  field: string
  keeping: string
  dropping: string
}

export interface MergePlan {
  keep: Guest
  drop: Guest
  /** The record as it will be once the two are joined. */
  result: Guest
  /** Values on both records that disagree. The kept one wins; the other is shown so nothing is a surprise. */
  clashes: FieldClash[]
  /** Blanks on the kept record that the other one fills. */
  fills: string[]
  /** Bookings that will move to the kept record. */
  stays: number
  /** True when merging would turn a refusal of marketing into agreement. */
  consentWidens: boolean
}

const LABELS: Record<string, string> = {
  phone: 'Telephone',
  email: 'Email',
  nationality: 'Nationality',
  dateOfBirth: 'Date of birth',
  gender: 'Gender',
  address: 'Address',
  idNumber: 'Identification',
  idType: 'Kind of identification',
}

const SIMPLE = ['phone', 'email', 'nationality', 'dateOfBirth', 'gender', 'address', 'idNumber', 'idType'] as const

/** What joining these two would do, worked out before anything is changed. */
export function mergePlan(keep: Guest, drop: Guest, reservations: Reservation[]): MergePlan {
  const clashes: FieldClash[] = []
  const fills: string[] = []
  const result: Guest = { ...keep }

  for (const key of SIMPLE) {
    const mine = keep[key]
    const theirs = drop[key]
    if (!filled(theirs)) continue
    if (!filled(mine)) {
      ;(result as Record<string, unknown>)[key] = theirs
      fills.push(LABELS[key] ?? key)
    } else if (String(mine).trim() !== String(theirs).trim()) {
      clashes.push({ field: LABELS[key] ?? key, keeping: String(mine), dropping: String(theirs) })
    }
  }

  // Preferences join: tags are a set, and the free note of the record being dropped is appended rather
  // than lost, because it is usually where the useful sentence is.
  const tags = Array.from(new Set([...(keep.preferences?.tags ?? []), ...(drop.preferences?.tags ?? [])]))
  const otherNotes = [keep.preferences?.other, drop.preferences?.other].filter(filled) as string[]
  if (tags.length > 0 || otherNotes.length > 0) {
    result.preferences = {
      ...drop.preferences,
      ...keep.preferences,
      ...(tags.length > 0 ? { tags } : {}),
      ...(otherNotes.length > 0 ? { other: Array.from(new Set(otherNotes)).join(' ') } : {}),
    }
  }

  // Consent: the more recent answer stands, whichever record it came from.
  const newer = (drop.consentAt ?? '') > (keep.consentAt ?? '') ? drop : keep
  const older = newer === drop ? keep : drop
  result.loyaltyConsent = newer.loyaltyConsent ?? older.loyaltyConsent
  result.marketingConsent = newer.marketingConsent ?? older.marketingConsent
  result.sensitiveConsent = newer.sensitiveConsent ?? older.sensitiveConsent
  result.consentAt = newer.consentAt ?? older.consentAt
  const consentWidens = keep.marketingConsent === false && result.marketingConsent === true

  // VIP is a decision somebody made once. If either record carries it, it stands.
  result.vip = keep.vip || drop.vip

  result.notes = [...(keep.notes ?? []), ...(drop.notes ?? [])].sort((a, b) => a.at.localeCompare(b.at))

  const stays = reservations.filter((r) => (r.guestId ? r.guestId === drop.id : r.guest === drop.name)).length

  return { keep, drop, result, clashes, fills, stays, consentWidens }
}

/** The line written on the record that survives, so the join can be explained a year later. */
export function mergeNote(plan: MergePlan, by: string, at: string): GuestNote {
  const bits = [
    `Joined with ${plan.drop.id} (${plan.drop.name}).`,
    plan.stays > 0 ? `${plan.stays} booking${plan.stays === 1 ? '' : 's'} moved here.` : 'No bookings to move.',
    plan.fills.length > 0 ? `Filled in: ${plan.fills.join(', ')}.` : '',
    plan.clashes.length > 0
      ? `Kept this record's ${plan.clashes.map((c) => c.field.toLowerCase()).join(', ')}; the other said ${plan.clashes
          .map((c) => c.dropping)
          .join(', ')}.`
      : '',
    plan.consentWidens ? 'The newer consent allowed marketing where this record refused it.' : '',
  ].filter(Boolean)
  return { id: `note-merge-${plan.drop.id}-${at.replace(/\D/g, '')}`, at, by, text: bits.join(' ') }
}

// ---- Finding them in the first place ----

const digits = (s: string) => s.replace(/\D/g, '')
const tokens = (s: string) =>
  s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ')

export interface DuplicatePair {
  a: Guest
  b: Guest
  reason: string
}

/**
 * Pairs that look like one person. Deliberately narrow: the same telephone, or the same name written
 * the same way. A looser rule would bury the real duplicates under a list of common Ugandan surnames,
 * and a merge suggested wrongly is worse than one not suggested at all.
 */
export function duplicatePairs(guests: Guest[], limit = 20): DuplicatePair[] {
  const out: DuplicatePair[] = []
  for (let i = 0; i < guests.length; i++) {
    for (let j = i + 1; j < guests.length; j++) {
      const a = guests[i]
      const b = guests[j]
      const phoneA = digits(a.phone ?? '').slice(-9)
      const phoneB = digits(b.phone ?? '').slice(-9)
      if (phoneA.length >= 9 && phoneA === phoneB) {
        out.push({ a, b, reason: 'Same telephone number' })
      } else if (tokens(a.name) !== '' && tokens(a.name) === tokens(b.name)) {
        out.push({ a, b, reason: 'Same name' })
      }
      if (out.length >= limit) return out
    }
  }
  return out
}
