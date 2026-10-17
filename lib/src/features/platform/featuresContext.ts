import { createContext, useContext } from 'react'
import type {
  FeatureKey,
  FeatureMap,
  HotelOptions,
  InspectionMode,
  PlanId,
  Tenant,
  TenantStatus,
} from '../../lib/features'

export interface FeaturesValue {
  tenants: Tenant[]
  /** The hotel the app is currently showing (demo selector). */
  tenant: Tenant
  features: FeatureMap
  options: HotelOptions
  /** Off if the hotel has no inspections feature, otherwise the hotel's choice. */
  inspectionMode: InspectionMode
  selectTenant: (id: string) => void
  setPlan: (id: string, plan: PlanId) => void
  setStatus: (id: string, status: TenantStatus) => void
  setOverride: (id: string, key: FeatureKey, value: boolean) => void
  clearOverrides: (id: string) => void
  setOptions: (patch: Partial<HotelOptions>) => void
}

export const FeaturesContext = createContext<FeaturesValue | null>(null)

export function useFeatures(): FeaturesValue {
  const v = useContext(FeaturesContext)
  if (!v) throw new Error('useFeatures must be used inside FeaturesProvider')
  return v
}