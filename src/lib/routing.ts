// Routing instructions: "put his restaurant bill on my room".
//
// The arrangement is older than hotel software. A manager takes three colleagues to dinner and the
// whole table goes on her room; a father pays for his daughter's room service but not her bar; a
// conference pays for lunches on the organiser's room and nothing else.
//
// The honest way to do this is to decide where a charge belongs at the moment it is posted, rather
// than to keep it in one place and perform the arithmetic again on every screen that reads it. A
// charge that has been routed sits on the bill that will pay it, and says whose it was.
//
// Pure rules only: no React.

export interface RoutingRule {
  id: string
  /** The charge category this covers, or every category. */
  category: string | 'Everything'
  /** The stay that will pay it. */
  toReservationId: string
  /** The name on that bill, kept so the desk can read the rule without looking it up. */
  toGuest: string
  /** Who agreed to it and when, because somebody will query it at checkout. */
  at: string
  by: string
}

/** Where a charge of this category should go, or nothing when it stays where it was posted. */
export function targetFor(rules: RoutingRule[] | undefined, category: string): RoutingRule | undefined {
  if (!rules || rules.length === 0) return undefined
  // A rule naming the category beats a catch-all, so "everything to the master except the bar" works
  // by adding one rule for the bar back to the guest.
  return rules.find((r) => r.category === category) ?? rules.find((r) => r.category === 'Everything')
}

export function newRuleId(rules: RoutingRule[]): string {
  let n = rules.length + 1
  while (rules.some((r) => r.id === `RT-${n}`)) n += 1
  return `RT-${n}`
}

export const describeRule = (rule: RoutingRule): string =>
  `${rule.category === 'Everything' ? 'Everything' : rule.category} goes to ${rule.toGuest}`
