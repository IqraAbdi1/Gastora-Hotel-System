import { useMemo } from 'react'
import { TODAY } from '../../data/sample'
import { useBrowserSyncedState } from '../../hooks/useBrowserSyncedState'
import { addDays } from '../../services/reports/analytics'
import { useHotel } from '../../lib/hotelContext'
import { slaOf } from '../../lib/sla'
import { waitingParts } from '../../lib/parts'
import { useNow } from '../../lib/useNow'
import { reportsService } from '../../services'
import type { FactSale, FactWorkOrder, ReportFacts } from '../../services/reports/facts'
import type { SampleSale } from '../../services/reports/reportsTypes'
import { useCorporate } from '../corporate/corporateContext'
import { useHousekeeping } from '../housekeeping/hkContext'
import { defectPriority } from '../housekeeping/hkModel'
import { useFeatures } from '../platform/featuresContext'
import { POS_STORAGE_KEYS } from '../pos/posTypes'
import type { Sale } from '../pos/posTypes'
import { useRequests } from '../procurement/requestsContext'
import { useServiceValue } from './useReports'

const WAITING = ['Submitted', 'With head', 'Endorsed', 'Requisition', 'Needs finance', 'Approved']
const TARGET_DAYS = { Urgent: 1, High: 1, Normal: 3 } as const
const NO_SALES: SampleSale[] = []

/** The hotel's own records, gathered from the existing hooks, in the shape every report reads. */
export function useReportFacts(): ReportFacts {
  const { reservations, rooms, guests } = useHotel()
  const { tenant, options } = useFeatures()
  const hk = useHousekeeping()
  const { stock, orders, requests, suppliers } = useRequests()
  const { accounts } = useCorporate()
  const [tillSales] = useBrowserSyncedState<Sale[]>(POS_STORAGE_KEYS.sales, [])
  const sample = useServiceValue(() => reportsService.listSampleSales(tenant.id, TODAY), NO_SALES, `sales:${tenant.id}:${TODAY}`).value
  const now = useNow(60000)

  const sales = useMemo<{ list: FactSale[]; sample: boolean }>(() => {
    if (tillSales.length > 0)
      return {
        sample: false,
        list: tillSales.map((s) => ({ id: s.id, createdAt: s.createdAt, outlet: s.outlet, payment: s.payment, total: s.total, items: s.items.reduce((n, i) => n + i.qty, 0), sample: false })),
      }
    return {
      sample: true,
      list: sample.map((s) => ({ id: s.id, createdAt: s.createdAt, outlet: s.outlet, payment: s.payment, total: s.total, items: s.items.reduce((n, i) => n + i.qty, 0), sample: true })),
    }
  }, [tillSales, sample])

  const workOrders = useMemo<FactWorkOrder[]>(
    () =>
      hk.allDefects
        .filter(({ defect }) => defect.status !== 'Open')
        .map(({ room, defect }) => {
          const priority = defectPriority(defect)
          const closed = defect.status === 'Resolved' || defect.status === 'Done'
          const reportedOn = defect.reportedOn ?? defect.reportedIso?.slice(0, 10) ?? TODAY
          let overdue = false
          if (!closed) {
            if (defect.reportedIso)
              overdue =
                slaOf({ priority, reportedIso: defect.reportedIso, startedIso: defect.startedIso, closedIso: defect.closedIso, waitingOnPart: waitingParts(defect.parts).length > 0 }, options.sla, now).fix.state ===
                'late'
            else overdue = addDays(reportedOn, TARGET_DAYS[priority]) < TODAY
          }
          return {
            id: `${room}-${defect.id}`,
            room,
            category: defect.category,
            description: defect.description,
            priority,
            status: defect.status,
            technician: defect.technician ?? '',
            reportedOn,
            closedOn: defect.closedIso?.slice(0, 10),
            overdue,
          }
        }),
    [hk.allDefects, options.sla, now],
  )

  return useMemo<ReportFacts>(
    () => ({
      propertyId: tenant.id,
      propertyName: tenant.name,
      today: TODAY,
      reservations,
      rooms,
      guests,
      sales: sales.list,
      salesAreSample: sales.sample,
      stock: stock.map((s) => ({ id: s.id, name: s.name, category: s.category ?? 'Other', unit: s.unit, onHand: s.onHand, reorderAt: s.reorderAt, unitCost: s.unitCost })),
      orders: orders.map((o) => ({ id: o.id, supplier: o.supplier, createdAt: o.createdAt, total: o.total, status: o.status })),
      requests: requests.map((r) => ({ id: r.id, department: r.department, status: WAITING.includes(r.status) ? 'Waiting' : r.status, createdAt: r.createdAt })),
      activeSuppliers: suppliers.filter((s) => s.active).length,
      workOrders,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, status: a.status, creditLimit: a.creditLimit, outstandingBalance: a.outstandingBalance })),
      housekeeping: {
        toClean: hk.counts.toClean,
        openTasks: hk.counts.openTasks,
        toInspect: hk.counts.toInspect,
        issues: hk.counts.issues,
        tasksDoneToday: hk.tasks.filter((t) => t.status === 'Completed' && (!t.day || t.day === TODAY)).length,
      },
    }),
    [tenant.id, tenant.name, reservations, rooms, guests, sales, stock, orders, requests, suppliers, workOrders, accounts, hk.counts, hk.tasks],
  )
}
