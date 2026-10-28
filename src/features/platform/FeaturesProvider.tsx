
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
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
  NewTenant,
  TenantRegistry,
} from '../../lib/features'
import { DEFAULT_STAY_TIMES } from '../../lib/stayTimes'
import type { StayTimes } from '../../lib/stayTimes'
import { DEFAULT_TAX } from '../../lib/tax'
import type { TaxSettings } from '../../lib/tax'
import { FeaturesContext } from './featuresContext'
import type { FeaturesValue } from './featuresContext'

/**
 * Converts a hotel name into a URL-safe slug.
 * Example: "Lakeview Hotel & Suites" -> "lakeview-hotel-suites"
 */
function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Creates a unique slug without overwriting an existing hotel's slug.
 * Example: lakeview, lakeview-2, lakeview-3.
 */
function createUniqueSlug(name: string, tenants: Tenant[]): string {
  const base = slugify(name) || 'hotel'
  const existingSlugs = new Set(
    tenants.map((tenant) => tenant.slug?.toLowerCase()).filter(Boolean),
  )

  if (!existingSlugs.has(base)) {
    return base
  }

  let suffix = 2

  while (existingSlugs.has(`${base}-${suffix}`)) {
    suffix += 1
  }

  return `${base}-${suffix}`
}

/**
 * Resolves a tenant slug from the current hostname.
 *
 * Local development:
 *   lakeview.localhost
 *
 * Deployed environment:
 *   lakeview.your-configured-domain.com
 *
 * Configure VITE_TENANT_BASE_DOMAIN for your actual domain.
 * The platform's main hostname does not resolve to a hotel tenant.
 */
function getTenantSlugFromHostname(hostname: string): string | null {
  const host = hostname.toLowerCase().split(':')[0]

  if (!host) {
    return null
  }

  // Supports hotel-specific subdomains during local development.
  if (host.endsWith('.localhost')) {
    const prefix = host.slice(0, -'.localhost'.length)

    // Only accept one subdomain label.
    if (prefix && !prefix.includes('.')) {
      return prefix
    }

    return null
  }

  const configuredDomain = import.meta.env.VITE_TENANT_BASE_DOMAIN
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')

  if (!configuredDomain || host === configuredDomain) {
    return null
  }

  const suffix = `.${configuredDomain}`

  if (!host.endsWith(suffix)) {
    return null
  }

  const prefix = host.slice(0, -suffix.length)

  // Avoid interpreting nested subdomains as hotel slugs.
  if (!prefix || prefix.includes('.')) {
    return null
  }

  // www is not a hotel slug.
  if (prefix === 'www') {
    return null
  }

  return prefix
}

export default function FeaturesProvider({
  children,
}: {
  children: ReactNode
}) {
  const [storedTenants, setTenants] = useBrowserSyncedState<Tenant[]>(
    'gastora:platform:tenants',
    SAMPLE_TENANTS,
  )

  // Fill in newer fields when older tenant records are loaded from browser storage.
  const tenants = useMemo(
    () =>
      storedTenants.map((tenant) => {
        const original = SAMPLE_TENANTS.find(
          (sample) => sample.id === tenant.id,
        )

        return original
          ? {
              ...original,
              ...tenant,
              group: tenant.group ?? original.group,
              slug: tenant.slug ?? original.slug,
            }
          : tenant
      }),
    [storedTenants],
  )

  const [currentId, setCurrentId] = useState('t1')

  // The hostname is read in the browser. The platform selector remains available
  // when the app is opened on the main hostname.
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : ''

  const hostnameSlug = getTenantSlugFromHostname(hostname)

  const hostnameTenant = useMemo(
    () =>
      hostnameSlug
        ? tenants.find(
            (tenant) => tenant.slug?.toLowerCase() === hostnameSlug,
          )
        : undefined,
    [hostnameSlug, tenants],
  )

  // A recognized hotel subdomain selects its own tenant automatically.
  // Otherwise, use the tenant selected through the platform interface.
  const activeTenantId = hostnameTenant?.id ?? currentId

  const [optionsById, setOptionsById] = useBrowserSyncedState<
    Record<string, HotelOptions>
  >('gastora:hotel:options', {})

  const [taxById, setTaxById] = useBrowserSyncedState<
    Record<string, TaxSettings>
  >('gastora:hotel:tax', SAMPLE_TAX)

  const [stayTimesById, setStayTimesById] = useBrowserSyncedState<
    Record<string, StayTimes>
  >('gastora:hotel:stayTimes', {})

  const patchTenant = useCallback(
    (id: string, fn: (tenant: Tenant) => Tenant) => {
      setTenants((list) =>
        list.map((tenant) =>
          tenant.id === id ? fn(tenant) : tenant,
        ),
      )
    },
    [setTenants],
  )

  const setPlan = useCallback(
    (id: string, plan: PlanId) =>
      patchTenant(id, (tenant) => ({
        ...tenant,
        plan,
        overrides: {},
      })),
    [patchTenant],
  )

  const setCompanySize = useCallback(
    (id: string, size: CompanySize) =>
      patchTenant(id, (tenant) => ({
        ...tenant,
        companySize: size,
      })),
    [patchTenant],
  )

  const setTax = useCallback(
    (patch: Partial<TaxSettings>) =>
      setTaxById((map) => ({
        ...map,
        [activeTenantId]: {
          ...(map[activeTenantId] ?? DEFAULT_TAX),
          ...patch,
        },
      })),
    [activeTenantId, setTaxById],
  )

  const setStayTimes = useCallback(
    (patch: Partial<StayTimes>) =>
      setStayTimesById((map) => ({
        ...map,
        [activeTenantId]: {
          ...(map[activeTenantId] ?? DEFAULT_STAY_TIMES),
          ...patch,
        },
      })),
    [activeTenantId, setStayTimesById],
  )

  const addTenant = useCallback(
    (input: NewTenant) => {
      const created: Tenant = {
        id: `t${Date.now().toString().slice(-6)}`,
        name: input.name.trim(),
        slug: createUniqueSlug(input.name, tenants),
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
    },
    [setTenants, tenants],
  )

  /**
   * Only the platform should assign or change a hotel group.
   * Sharing a group can expose availability across properties.
   */
  const setGroup = useCallback(
    (id: string, group: string) =>
      patchTenant(id, (tenant) => ({
        ...tenant,
        group: group.trim() || undefined,
      })),
    [patchTenant],
  )

  /**
   * Copy configuration from one property to another.
   */
  const copySettingsFrom = useCallback(
    (fromId: string, toId: string) => {
      setOptionsById((map) =>
        map[fromId] ? { ...map, [toId]: map[fromId] } : map,
      )

      setTaxById((map) =>
        map[fromId] ? { ...map, [toId]: map[fromId] } : map,
      )

      setStayTimesById((map) =>
        map[fromId] ? { ...map, [toId]: map[fromId] } : map,
      )
    },
    [setOptionsById, setTaxById, setStayTimesById],
  )

  const setRegistry = useCallback(
    (id: string, patch: Partial<TenantRegistry>) =>
      patchTenant(id, (tenant) => ({
        ...tenant,
        registry: {
          ...tenant.registry,
          ...patch,
        },
      })),
    [patchTenant],
  )

  const setStatus = useCallback(
    (id: string, status: TenantStatus) =>
      patchTenant(id, (tenant) => ({
        ...tenant,
        status,
      })),
    [patchTenant],
  )

  const setOverride = useCallback(
    (id: string, key: FeatureKey, enabled: boolean) =>
      patchTenant(id, (tenant) => {
        const overrides = { ...tenant.overrides }

        if (enabled === planHas(tenant.plan, key)) {
          delete overrides[key]
        } else {
          overrides[key] = enabled
        }

        return {
          ...tenant,
          overrides,
        }
      }),
    [patchTenant],
  )

  const clearOverrides = useCallback(
    (id: string) =>
      patchTenant(id, (tenant) => ({
        ...tenant,
        overrides: {},
      })),
    [patchTenant],
  )

  const setOptions = useCallback(
    (patch: Partial<HotelOptions>) =>
      setOptionsById((map) => ({
        ...map,
        [activeTenantId]: {
          ...(map[activeTenantId] ?? DEFAULT_OPTIONS),
          ...patch,
        },
      })),
    [activeTenantId, setOptionsById],
  )

  const value = useMemo<FeaturesValue>(() => {
    const tenant =
      tenants.find((item) => item.id === activeTenantId) ??
      (tenants[0] as Tenant)

    const features = featuresOf(tenant)

    // Merge defaults so older browser-saved settings receive newly added fields.
    const saved = optionsById[tenant.id]

    const merged: HotelOptions = saved
      ? {
          ...DEFAULT_OPTIONS,
          ...saved,
          rates: {
            ...DEFAULT_OPTIONS.rates,
            ...(saved.rates ?? {}),
          },
          messaging: {
            ...DEFAULT_OPTIONS.messaging,
            ...(saved.messaging ?? {}),
            templates: DEFAULT_OPTIONS.messaging.templates.map(
              (base) =>
                saved.messaging?.templates?.find(
                  (template) => template.kind === base.kind,
                ) ?? base,
            ),
          },
          loyalty: {
            ...DEFAULT_OPTIONS.loyalty,
            ...(saved.loyalty ?? {}),
          },
          points: {
            ...DEFAULT_OPTIONS.points,
            ...(saved.points ?? {}),
          },
          upsell: {
            ...DEFAULT_OPTIONS.upsell,
            ...(saved.upsell ?? {}),
          },
          limits: {
            ...DEFAULT_OPTIONS.limits,
            ...(saved.limits ?? {}),
          },
          service: {
            ...DEFAULT_OPTIONS.service,
            ...(saved.service ?? {}),
          },
          autoAssign: {
            ...DEFAULT_OPTIONS.autoAssign,
            ...(saved.autoAssign ?? {}),
          },
          sla: {
            ...DEFAULT_OPTIONS.sla,
            ...(saved.sla ?? {}),
            targets: {
              ...DEFAULT_OPTIONS.sla.targets,
              ...(saved.sla?.targets ?? {}),
            },
          },
        }
      : DEFAULT_OPTIONS

    // Sample hotels receive their sample services until they save their own.
    const options: HotelOptions = saved?.services
      ? merged
      : {
          ...merged,
          services: SAMPLE_SERVICES[tenant.id] ?? [],
        }

    const inspectionMode: InspectionMode = features.inspections
      ? options.inspectionMode
      : 'off'

    return {
      tenants,
      tenant,
      features,
      tax: features.taxLines
        ? taxById[tenant.id] ?? DEFAULT_TAX
        : null,
      stayTimes: stayTimesById[tenant.id] ?? DEFAULT_STAY_TIMES,
      options,
      inspectionMode,

      // A recognized hotel subdomain cannot be switched to another tenant
      // through the platform tenant selector.
      selectTenant: hostnameTenant
        ? () => {}
        : setCurrentId,

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
  }, [
    tenants,
    activeTenantId,
    optionsById,
    taxById,
    stayTimesById,
    hostnameTenant,
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
  ])

  return (
    <FeaturesContext.Provider value={value}>
      {children}
    </FeaturesContext.Provider>
  )
}
