import type { Guest, GuestDetails } from '../types'

// A filled-in value wins. An empty one keeps what the profile already has.
const keep = (next: string | undefined, old: string | undefined) =>
  next && next.trim() !== '' ? next.trim() : old

// What the guest gave us at check-in becomes part of their profile,
// so next time the check-in form is already filled in.
export function mergeCheckIn(g: Guest, d: GuestDetails): Guest {
  return {
    ...g,
    idType: d.idNumber.trim() !== '' ? d.idType : g.idType,
    idNumber: keep(d.idNumber, g.idNumber),
    nationality: keep(d.nationality, g.nationality),
    dateOfBirth: keep(d.dateOfBirth, g.dateOfBirth),
    gender: keep(d.gender, g.gender),
    address: keep(d.address, g.address),
    email: keep(d.email, g.email),
    marketingConsent: d.marketingConsent ?? g.marketingConsent,
  }
}