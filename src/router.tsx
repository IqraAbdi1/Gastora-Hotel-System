import { createBrowserRouter } from 'react-router-dom'
import AppShell from './components/AppShell'
import FeatureGate from './components/FeatureGate'
import Landing from './components/Landing'
import PagePlaceholder from './components/PagePlaceholder'
import Root from './components/Root'
import HotelSettingsPage from './features/admin/HotelSettingsPage'
import TaxSettingsPage from './features/admin/TaxSettingsPage'
import RatesPoliciesPage from './features/admin/RatesPoliciesPage'
import NightAuditPage from './features/frontdesk/NightAuditPage'
import GuestDocumentsPage from './features/frontdesk/GuestDocumentsPage'
import LostFoundPage from './features/lostfound/LostFoundPage'
import ApprovalsPage from './features/approvals/ApprovalsPage'
import LoginPage from './features/auth/LoginPage'
import DashboardPage from './features/dashboard/DashboardPage'
import TodayPage from './features/frontdesk/TodayPage'
import ReservationsPage from './features/frontdesk/ReservationsPage'
import RoomsPage from './features/frontdesk/RoomsPage'
import NewReservationPage from './features/frontdesk/NewReservationPage'
import FoliosPage from './features/frontdesk/FoliosPage'
import CompaniesPage from './features/corporate/CompaniesPage'
import HousekeepingPage from './features/housekeeping/HousekeepingPage'
import TasksPage from './features/housekeeping/TasksPage'
import MyRoomsPage from './features/housekeeping/MyRoomsPage'
import InspectionsPage from './features/housekeeping/InspectionsPage'
import IssuesPage from './features/housekeeping/IssuesPage'
import RoomsOutOfOrderPage from './features/maintenance/RoomsOutOfOrderPage'
import WorkOrdersPage from './features/maintenance/WorkOrdersPage'
import PlatformPage from './features/platform/PlatformPage'
import RequestsPage from './features/procurement/RequestsPage'
import PurchaseOrdersPage from './features/procurement/PurchaseOrdersPage'
import AuditLogPage from './features/procurement/AuditLogPage'
import SuppliersPage from './features/procurement/SuppliersPage'
import StockPage from './features/inventory/StockPage'
import MovementsPage from './features/inventory/MovementsPage'
import ReceiptsPage from './features/inventory/ReceiptsPage'
import StockCountPage from './features/inventory/StockCountPage'
import LossesPage from './features/inventory/LossesPage'
import PosPage from './features/pos/PosPage'

const page = (title: string) => <PagePlaceholder title={title} />

export const router = createBrowserRouter([
  {
    // Sign-in state, features and housekeeping data live here, above both the login page and the app.
    element: <Root />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Landing /> },

          // Overview
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'manager', element: page('Manager: Dashboard') },

          // Front desk
          { path: 'desk', element: <TodayPage /> },
          { path: 'desk/reservations', element: <ReservationsPage /> },
          { path: 'desk/rooms', element: <RoomsPage /> },
          { path: 'desk/new-reservation', element: <NewReservationPage /> },
          { path: 'desk/folios', element: <FoliosPage /> },
          { path: 'desk/companies', element: <CompaniesPage /> },
          { path: 'desk/documents', element: <GuestDocumentsPage /> },
          { path: 'desk/lost-found', element: <LostFoundPage /> },
          { path: 'housekeeping/lost-found', element: <LostFoundPage /> },
          { path: 'desk/night-audit', element: <NightAuditPage /> },

          // Housekeeping
          { path: 'housekeeping', element: <HousekeepingPage /> },
          { path: 'housekeeping/tasks', element: <TasksPage /> },
          { path: 'housekeeping/my-rooms', element: <MyRoomsPage /> },
          {
            path: 'housekeeping/inspections',
            element: (
              <FeatureGate feature="inspections">
                <InspectionsPage />
              </FeatureGate>
            ),
          },
          { path: 'housekeeping/issues', element: <IssuesPage /> },
          {
            path: 'housekeeping/supplies',
            element: (
              <FeatureGate feature="requests">
                <RequestsPage key="hk" department="Housekeeping" />
              </FeatureGate>
            ),
          },

          // Maintenance
          { path: 'maintenance', element: <WorkOrdersPage /> },
          {
            path: 'maintenance/out-of-order',
            element: (
              <FeatureGate feature="maintenanceFull">
                <RoomsOutOfOrderPage />
              </FeatureGate>
            ),
          },
          {
            path: 'maintenance/supplies',
            element: (
              <FeatureGate feature="requests">
                <RequestsPage key="mt" department="Maintenance" />
              </FeatureGate>
            ),
          },

          // POS
          { path: 'pos', element: <PosPage /> },
          { path: 'pos/orders', element: <PosPage /> },

                    // Inventory
          {
            path: 'inventory/requests',
            element: (
              <FeatureGate feature="supplyChain">
                <RequestsPage key="store" scope="store" />
              </FeatureGate>
            ),
          },
          {
            path: 'inventory',
            element: (
              <FeatureGate feature="stockControl">
                <StockPage />
              </FeatureGate>
            ),
          },
          {
            path: 'inventory/receipts',
            element: (
              <FeatureGate feature="stockControl">
                <ReceiptsPage />
              </FeatureGate>
            ),
          },
          {
            path: 'inventory/counts',
            element: (
              <FeatureGate feature="stockControl">
                <StockCountPage />
              </FeatureGate>
            ),
          },
                    {
            path: 'inventory/losses',
           element: (
  <FeatureGate feature="lossReports">
    <LossesPage />
  </FeatureGate>
),
          },
          {
            path: 'inventory/movements',
            element: (
              <FeatureGate feature="stockControl">
                <MovementsPage />
              </FeatureGate>
            ),
          },

          // Procurement
          {
            path: 'procurement/requests',
            element: (
              <FeatureGate feature="requests">
                <RequestsPage key="purchasing" scope="purchasing" />
              </FeatureGate>
            ),
          },
          {
            path: 'procurement',
            element: (
              <FeatureGate feature="supplyChain">
                <PurchaseOrdersPage />
              </FeatureGate>
            ),
          },
          {
            path: 'procurement/audit',
            element: (
              <FeatureGate feature="supplyChain">
                <AuditLogPage />
              </FeatureGate>
            ),
          },
          {
            path: 'procurement/suppliers',
            element: (
              <FeatureGate feature="supplyChain">
                <SuppliersPage />
              </FeatureGate>
            ),
          },

          // HR and Accounting (Trademate)
          { path: 'hr', element: page('HR: Staff') },
          { path: 'hr/payroll', element: page('HR: Payroll') },
          { path: 'hr/ledger', element: page('Accounting: Ledger') },
          {
            path: 'finance',
            element: (
              <FeatureGate feature="budgetApproval">
                <RequestsPage key="finance" scope="finance" />
              </FeatureGate>
            ),
          },

          // Admin
          { path: 'admin', element: <HotelSettingsPage /> },
          { path: 'admin/taxes', element: <TaxSettingsPage /> },
          { path: 'admin/approvals', element: <ApprovalsPage /> },
          { path: 'admin/policies', element: <RatesPoliciesPage /> },

          // Other apps
          { path: 'guest', element: page('Guest: Find a room') },
          { path: 'platform', element: <PlatformPage /> },

          { path: '*', element: page('Page not found') },
        ],
      },
    ],
  },
])