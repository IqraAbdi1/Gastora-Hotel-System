import type { Tone } from '../../components/ui'
import type {
  BeoStatus,
  ContractStatus,
  CostCategory,
  EquipmentCategory,
  EventStatus,
  EventType,
  LeadStage,
  PackageKind,
  PostingCategory,
  QuoteLineKind,
  QuoteStatus,
  SpaceKind,
} from '../../services/events/eventsTypes'

export const EVENT_TYPES: EventType[] = ['conference', 'wedding', 'meeting', 'corporate', 'social']
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  conference: 'Conference',
  wedding: 'Wedding',
  meeting: 'Meeting',
  corporate: 'Corporate event',
  social: 'Social event',
}

export const STAGE_TONE: Record<LeadStage, Tone> = { enquiry: 'info', proposal: 'accent', tentative: 'warn', definite: 'good', lost: 'bad' }
export const STAGE_DOT: Record<LeadStage, string> = { enquiry: 'bg-info', proposal: 'bg-accent', tentative: 'bg-warn', definite: 'bg-good', lost: 'bg-bad' }

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = { tentative: 'Tentative', definite: 'Definite', completed: 'Completed', cancelled: 'Cancelled' }
export const EVENT_STATUS_TONE: Record<EventStatus, Tone> = { tentative: 'warn', definite: 'good', completed: 'neutral', cancelled: 'bad' }

export const BEO_STATUS_LABEL: Record<BeoStatus, string> = { draft: 'Draft', issued: 'Issued', signed: 'Signed by client' }
export const BEO_STATUS_TONE: Record<BeoStatus, Tone> = { draft: 'neutral', issued: 'info', signed: 'good' }

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined' }
export const QUOTE_STATUS_TONE: Record<QuoteStatus, Tone> = { draft: 'neutral', sent: 'info', accepted: 'good', declined: 'bad' }

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = { draft: 'Draft', sent: 'Sent for signature', signed: 'Signed', cancelled: 'Cancelled' }
export const CONTRACT_STATUS_TONE: Record<ContractStatus, Tone> = { draft: 'neutral', sent: 'info', signed: 'good', cancelled: 'bad' }

export const SPACE_KIND_LABEL: Record<SpaceKind, string> = { hall: 'Hall', boardroom: 'Boardroom', garden: 'Garden', restaurant: 'Restaurant', terrace: 'Terrace' }
export const PACKAGE_KIND_LABEL: Record<PackageKind, string> = {
  'day-delegate': 'Day delegate',
  'half-day': 'Half day',
  wedding: 'Wedding',
  cocktail: 'Cocktail',
  menu: 'Menu',
}
export const EQUIPMENT_LABEL: Record<EquipmentCategory, string> = { av: 'Audio-visual', furniture: 'Furniture', decor: 'Decor', staff: 'Staff' }
export const LINE_KIND_LABEL: Record<QuoteLineKind, string> = { package: 'Package', space: 'Space hire', room: 'Bedrooms', equipment: 'Equipment', other: 'Other' }
export const POSTING_CATEGORIES: PostingCategory[] = ['Room hire', 'Food', 'Beverage', 'Equipment', 'Rooms', 'Other']
export const COST_CATEGORIES: CostCategory[] = ['food', 'beverage', 'staff', 'equipment', 'decor', 'other']
export const COST_LABEL: Record<CostCategory, string> = { food: 'Food', beverage: 'Beverage', staff: 'Staff', equipment: 'Equipment', decor: 'Decor', other: 'Other' }

/** "1,250,000" or "1250000" typed into a box, as a number. */
export const num = (s: string) => Number(String(s).replace(/[^\d.]/g, '')) || 0

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Every day of an event, first to last. */
export function eventDays(b: { startDate: string; endDate: string }) {
  const out: string[] = []
  for (let d = b.startDate; d <= b.endDate && out.length < 31; d = addDays(d, 1)) out.push(d)
  return out
}

export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export const stampText = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Millions with one decimal: "UGX 46.2M". For tight spaces such as board cards. */
export const ugxShort = (n: number) => (n === 0 ? 'UGX 0' : n >= 1_000_000 ? `UGX ${(n / 1_000_000).toFixed(1)}M` : `UGX ${Math.round(n / 1000)}k`)

export const sectionHeading = 'text-xs font-semibold uppercase tracking-wide text-ink/50'
