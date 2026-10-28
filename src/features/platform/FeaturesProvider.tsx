import { useCallback, useMemo, useState } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import type { ReactNode } from 'react'
import {
  DEFAULT_OPTIONS,
  SAMPLE_SERVICES,
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
  const [storedTenants, setTenants] = useBrowserSyncedState<Tenant[]>('gastora:platform:tenants', SAMPLE_TENANTS)
  // A hotel saved in this browser last week has last week's shape, so anything Gastora has added since
  // - the owner a hotel belongs to, for instance - is filled in from the sample it came from.
  const tenants = useMemo(
    () =>
      storedTenants.map((t) => {
        const original = SAMPLE_TENANTS.find((x) => x.id === t.id)
        return original ? { ...original, ...t, group: t.group ?? original.group } : t
      }),
    [storedTenants],
  )
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
      group: input.group,
    }
    setTenants((list) => [...list, created])
    return created
  }, [setTenants])

  /**
   * Join a hotel to an owner's group, or take it out of one. Two hotels in the same group see each
   * other's free rooms, so only Gastora may set it: a hotel admin who could type another owner's
   * group name would be reading that owner's availability.
   */
  const setGroup = useCallback(
    (id: string, group: string) => patchTenant(id, (t) => ({ ...t, group: group.trim() || undefined })),
    [patchTenant],
  )

  /**
   * A second property starts from the first one's set-up rather than from nothing: the same room
   * policies, house rules, cleaning areas, message wording, tax rules and stay times. The owner then
   * changes what is different about the new place, which is far less than what is the same.
   */
  const copySettingsFrom = useCallback(
    (fromId: string, toId: string) => {
      setOptionsById((m) => (m[fromId] ? { ...m, [toId]: m[fromId] } : m))
      setTaxById((m) => (m[fromId] ? { ...m, [toId]: m[fromId] } : m))
      setStayTimesById((m) => (m[fromId] ? { ...m, [toId]: m[fromId] } : m))
    },
    [setOptionsById, setTaxById, setStayTimesById],
  )

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
    // Settings are kept in the browser between visits, so a hotel that saved its options last week has
    // an object with last week's shape. Merging over the defaults means a setting added since then
    // exists rather than being undefined in the middle of a page.
    const saved = optionsById[tenant.id]
    const merged: HotelOptions = saved
      ? {
          ...DEFAULT_OPTIONS,
          ...saved,
          rates: { ...DEFAULT_OPTIONS.rates, ...(saved.rates ?? {}) },
          messaging: {
            ...DEFAULT_OPTIONS.messaging,
            ...(saved.messaging ?? {}),
            // Templates are merged one by one rather than wholesale. A hotel that saved its wording
            // before a new message existed would otherwise never receive the new one, and the message
            // would quietly fail to be written at all because it has no text.
            templates: DEFAULT_OPTIONS.messaging.templates.map(
              (base) => saved.messaging?.templates?.find((t) => t.kind === base.kind) ?? base,
            ),
          },
          loyalty: { ...DEFAULT_OPTIONS.loyalty, ...(saved.loyalty ?? {}) },
          points: { ...DEFAULT_OPTIONS.points, ...(saved.points ?? {}) },
          upsell: { ...DEFAULT_OPTIONS.upsell, ...(saved.upsell ?? {}) },
          limits: { ...DEFAULT_OPTIONS.limits, ...(saved.limits ?? {}) },
          service: { ...DEFAULT_OPTIONS.service, ...(saved.service ?? {}) },
          autoAssign: { ...DEFAULT_OPTIONS.autoAssign, ...(saved.autoAssign ?? {}) },
          sla: { ...DEFAULT_OPTIONS.sla, ...(saved.sla ?? {}), targets: { ...DEFAULT_OPTIONS.sla.targets, ...(saved.sla?.targets ?? {}) } },
        }
      : DEFAULT_OPTIONS
    // A sample hotel starts with its own list of bookable services until it saves one of its own.
    const options: HotelOptions = saved?.services ? merged : { ...merged, services: SAMPLE_SERVICES[tenant.id] ?? [] }
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
      setGroup,
      copySettingsFrom,
      setRegistry,
    }
  }, [tenants, currentId, optionsById, taxById, stayTimesById, setPlan, setStatus, setOverride, clearOverrides, setOptions, setCompanySize, setTax, setStayTimes, addTenant, setGroup, copySettingsFrom, setRegistry])

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>
}