import { createContext, useContext } from 'react'
import type { StayTimes } from '../../lib/stayTimes'
import type { TaxSettings } from '../../lib/tax'
import type {
  FeatureKey,
  FeatureMap,
  HotelOptions,
  InspectionMode,
  PlanId,
  CompanySize,
  Tenant,
  TenantStatus,
} from '../../lib/features'

export interface FeaturesValue {
  tenants: Tenant[]
  /** The hotel the app is currently showing (demo selector). */
  tenant: Tenant
  features: FeatureMap
  /** This hotel's tax rules, or null when the Tax lines feature is off. */
  tax: TaxSettings | null
  /** This hotel's check-in and check-out times. Always set; the hotel admin or owner changes them. */
  stayTimes: StayTimes
  options: HotelOptions
  /** Off if the hotel has no inspections feature, otherwise the hotel's choice. */
  inspectionMode: InspectionMode
  selectTenant: (id: string) => void
  setPlan: (id: string, plan: PlanId) => void
  setStatus: (id: string, status: TenantStatus) => void
  setOverride: (id: string, key: FeatureKey, value: boolean) => void
  clearOverrides: (id: string) => void
  setOptions: (patch: Partial<HotelOptions>) => void
  setCompanySize: (id: string, size: CompanySize) => void
  /** Changes the tax rules of the hotel being shown. Only the hotel admin and owner use this. */
  setTax: (patch: Partial<TaxSettings>) => void
  setStayTimes: (patch: Partial<StayTimes>) => void
}

export const FeaturesContext = createContext<FeaturesValue | null>(null)

export function useFeatures(): FeaturesValue {
  const v = useContext(FeaturesContext)
  if (!v) throw new Error('useFeatures must be used inside FeaturesProvider')
  return v
}