// Who a guest belongs with.
//
// Three kinds, and they answer different questions at the desk:
//
//   - A HOUSEHOLD is another guest. It answers "are these two together?" - which decides whether the
//     desk puts them on the same floor, whether a message about one should go to the other, and
//     whether two bookings on the same night are two guests or one family.
//   - A COMPANY answers "who is paying?", and the hotel already keeps those accounts.
//   - An AGENT answers "who sold this?", which matters because the hotel owes them and because the
//     guest's own price is not the hotel's price.
//
// A household link is made on both records at once. A relationship recorded on one side only is the
// kind of thing that is true until somebody opens the other record and finds nothing there.
//
// Pure rules only: no React.

import type { Guest, GuestLink } from '../types'

export const LINK_LABEL: Record<GuestLink['kind'], string> = {
  household: 'Travels with',
  company: 'Works for',
  agent: 'Booked through',
}

export const LINK_NOTE: Record<GuestLink['kind'], string> = {
  household: 'Another guest this one travels with. The link is made on both records.',
  company: 'The company account that may be paying for the stay.',
  agent: 'The travel agent that sold the stay.',
}

export function newLinkId(list: GuestLink[]): string {
  let n = list.length + 1
  while (list.some((x) => x.id === `link-${n}`)) n += 1
  return `link-${n}`
}

export const linksOf = (g: Guest, kind?: GuestLink['kind']): GuestLink[] =>
  (g.links ?? []).filter((l) => !kind || l.kind === kind)

export const alreadyLinked = (g: Guest, targetId: string): boolean =>
  (g.links ?? []).some((l) => l.targetId === targetId)

/** The link to add to a guest, or nothing when it is already there. */
export function addLink(g: Guest, link: Omit<GuestLink, 'id'>): GuestLink[] | undefined {
  if (alreadyLinked(g, link.targetId)) return undefined
  return [...(g.links ?? []), { ...link, id: newLinkId(g.links ?? []) }]
}

/** The same link seen from the other guest's side, so a household reads the same both ways. */
export function mirror(from: Guest, relation?: string): Omit<GuestLink, 'id'> {
  return { kind: 'household', targetId: from.id, name: from.name, relation }
}

export const withoutLink = (g: Guest, linkId: string): GuestLink[] =>
  (g.links ?? []).filter((l) => l.id !== linkId)
