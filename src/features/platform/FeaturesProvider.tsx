import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_OPTIONS,
  SAMPLE_TENANTS,
  featuresOf,
  planHas,
} from '../../lib/features'
import type {
  FeatureKey,
  HotelOptions,
  InspectionMode,
  PlanId,
  CompanySize,
  Tenant,
  TenantStatus,
} from '../../lib/features'
import { FeaturesContext } from './featuresContext'
import type { FeaturesValue } from './featuresContext'

export default function FeaturesProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>(SAMPLE_TENANTS)
  const [currentId, setCurrentId] = useState('t1')
  const [optionsById, setOptionsById] = useState<Record<string, HotelOptions>>({})

  const patchTenant = useCallback((id: string, fn: (t: Tenant) => Tenant) => {
    setTenants((list) => list.map((t) => (t.id === id ? fn(t) : t)))
  }, [])

  const setPlan = useCallback(
    (id: string, plan: PlanId) => patchTenant(id, (t) => ({ ...t, plan, overrides: {} })),
    [patchTenant],
  )

  const setCompanySize = useCallback(
    (id: string, size: CompanySize) => patchTenant(id, (t) => ({ ...t, companySize: size })),
    [patchTenant],
  )

  const setStatus = useCallback(
    (id: string, status: TenantStatus) => patchTenant(id, (t) => ({ ...t, status })),
    [patchTenant],
  )

  const setOverride = useCallback(
    (id: string, key: FeatureKey, value: boolean) =>
      patchTenant(id, (t) => {
        const overrides = { ...t.overrides }
        if (value === planHas(t.plan, key)) delete overrides[key]
        else overrides[key] = value
        return { ...t, overrides }
      }),
    [patchTenant],
  )

  const clearOverrides = useCallback(
    (id: string) => patchTenant(id, (t) => ({ ...t, overrides: {} })),
    [patchTenant],
  )

  const setOptions = useCallback(
    (patch: Partial<HotelOptions>) =>
      setOptionsById((m) => ({
        ...m,
        [currentId]: { ...(m[currentId] ?? DEFAULT_OPTIONS), ...patch },
      })),
    [currentId],
  )

  const value = useMemo<FeaturesValue>(() => {
    const tenant = tenants.find((t) => t.id === currentId) ?? (tenants[0] as Tenant)
    const features = featuresOf(tenant)
    const options = optionsById[tenant.id] ?? DEFAULT_OPTIONS
    const inspectionMode: InspectionMode = features.inspections ? options.inspectionMode : 'off'
    return {
      tenants,
      tenant,
      features,
      options,
      inspectionMode,
      selectTenant: setCurrentId,
      setPlan,
      setStatus,
      setOverride,
      clearOverrides,
      setOptions,
      setCompanySize,
    }
  }, [tenants, currentId, optionsById, setPlan, setStatus, setOverride, clearOverrides, setOptions, setCompanySize])

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>
}