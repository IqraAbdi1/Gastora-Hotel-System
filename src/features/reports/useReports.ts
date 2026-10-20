import { useEffect, useState } from 'react'
import { reportsService } from '../../services'
import type {
  AssistantQuestion,
  CostProfile,
  DepartmentKpi,
  ReportDefinition,
  ReportExport,
  ReportSchedule,
} from '../../services/reports/reportsTypes'
import { useFeatures } from '../platform/featuresContext'

type Loaded<T> = { value: T; loading: boolean; error: string | null }

/** Loads from the reports service and loads again whenever the service says its data changed. */
export function useServiceValue<T>(load: () => Promise<T>, fallback: T, key: string): Loaded<T> {
  const [state, setState] = useState<Loaded<T> & { key: string }>({ value: fallback, loading: true, error: null, key })
  useEffect(() => {
    let alive = true
    const run = () =>
      load()
        .then((value) => alive && setState({ value, loading: false, error: null, key }))
        .catch((e: unknown) => alive && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Could not load', key })))
    run()
    const stop = reportsService.subscribe(run)
    return () => {
      alive = false
      stop()
    }
    // The key names everything the loader depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state.key === key ? state : { value: fallback, loading: true, error: null }
}

const NO_DEFS: ReportDefinition[] = []
const NO_SCHEDULES: ReportSchedule[] = []
const NO_EXPORTS: ReportExport[] = []
const NO_QUESTIONS: AssistantQuestion[] = []
const NO_TARGETS: DepartmentKpi[] = []

/** Saved and built-in reports, schedules and the export history of the hotel being shown. */
export function useReports() {
  const { tenant } = useFeatures()
  const id = tenant.id
  const definitions = useServiceValue(() => reportsService.listDefinitions(id), NO_DEFS, `defs:${id}`)
  const schedules = useServiceValue(() => reportsService.listSchedules(id), NO_SCHEDULES, `sch:${id}`)
  const exports = useServiceValue(() => reportsService.listExports(id), NO_EXPORTS, `exp:${id}`)
  return {
    definitions: definitions.value,
    schedules: schedules.value,
    exports: exports.value,
    loading: definitions.loading,
    error: definitions.error ?? schedules.error ?? exports.error,
  }
}

export function useQuestions() {
  const { tenant } = useFeatures()
  return useServiceValue(() => reportsService.listQuestions(tenant.id), NO_QUESTIONS, `q:${tenant.id}`).value
}

export function useCostProfile(): CostProfile | null {
  const { tenant } = useFeatures()
  return useServiceValue<CostProfile | null>(() => reportsService.getCostProfile(tenant.id), null, `cost:${tenant.id}`).value
}

export function useDepartmentTargets(): DepartmentKpi[] {
  const { tenant } = useFeatures()
  return useServiceValue(() => reportsService.listDepartmentKpis(tenant.id), NO_TARGETS, `dk:${tenant.id}`).value
}
