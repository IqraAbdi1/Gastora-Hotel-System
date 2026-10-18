import { useCallback, useMemo, useState } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import type { ReactNode } from 'react'
import {
  DEFAULT_OPTIONS,
  SAMPLE_TAX,
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
import { DEFAULT_STAY_TIMES } from '../../lib/stayTimes'
import type { StayTimes } from '../../lib/stayTimes'
import type { NewTenant, TenantRegistry } from '../../lib/features'
import { DEFAULT_TAX } from '../../lib/tax'
import type { TaxSettings } from '../../lib/tax'
import { FeaturesContext } from './featuresContext'
import type { FeaturesValue } from './featuresContext'

export default function FeaturesProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useBrowserSyncedState<Tenant[]>('gastora:platform:tenants', SAMPLE_TENANTS)
  const [currentId, setCurrentId] = useState('t1')
  const [optionsById, setOptionsById] = useBrowserSyncedState<Record<string, HotelOptions>>('gastora:hotel:options', {})
  const [taxById, setTaxById] = useBrowserSyncedState<Record<string, TaxSettings>>('gastora:hotel:tax', SAMPLE_TAX)
  const [stayTimesById, setStayTimesById] = useBrowserSyncedState<Record<string, StayTimes>>('gastora:hotel:stayTimes', {})

  const patchTenant = useCallback(
    (id: string, fn: (t: Tenant) => Tenant) => {
      setTenants((list) => list.map((t) => (t.id === id ? fn(t) : t)))
    },
    [setTenants],
  )

  const setPlan = useCallback(
    (id: string, plan: PlanId) => patchTenant(id, (t) => ({ ...t, plan, overrides: {} })),
    [patchTenant],
  )

  const setCompanySize = useCallback(
    (id: string, size: CompanySize) => patchTenant(id, (t) => ({ ...t, companySize: size })),
    [patchTenant],
  )

  const setTax = useCallback(
    (patch: Partial<TaxSettings>) =>
      setTaxById((m) => ({ ...m, [currentId]: { ...(m[currentId] ?? DEFAULT_TAX), ...patch } })),
    [currentId, setTaxById],
  )

  const setStayTimes = useCallback(
    (patch: Partial<StayTimes>) =>
      setStayTimesById((m) => ({ ...m, [currentId]: { ...(m[currentId] ?? DEFAULT_STAY_TIMES), ...patch } })),
    [currentId, setStayTimesById],
  )

  const addTenant = useCallback((input: NewTenant) => {
    const created: Tenant = {
      id: `t${Date.now().toString().slice(-6)}`,
      name: input.name.trim(),
      rooms: input.rooms,
      plan: input.plan,
      status: 'active',
      companySize: input.companySize,
      overrides: {},
      registry: input.registry,
    }
    setTenants((list) => [...list, created])
    return created
  }, [setTenants])

  const setRegistry = useCallback(
    (id: string, patch: Partial<TenantRegistry>) => patchTenant(id, (t) => ({ ...t, registry: { ...t.registry, ...patch } })),
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
    [currentId, setOptionsById],
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
      tax: features.taxLines ? (taxById[tenant.id] ?? DEFAULT_TAX) : null,
      stayTimes: stayTimesById[tenant.id] ?? DEFAULT_STAY_TIMES,
      options,
      inspectionMode,
      selectTenant: setCurrentId,
      setPlan,
      setStatus,
      setOverride,
      clearOverrides,
      setOptions,
      setCompanySize,
      setTax,
      setStayTimes,
      addTenant,
      setRegistry,
    }
  }, [tenants, currentId, optionsById, taxById, stayTimesById, setPlan, setStatus, setOverride, clearOverrides, setOptions, setCompanySize, setTax, setStayTimes, addTenant, setRegistry])

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>
}