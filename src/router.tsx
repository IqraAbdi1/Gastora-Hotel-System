import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import FeatureGate from './components/FeatureGate'
import Landing from './components/Landing'
import PagePlaceholder from './components/PagePlaceholder'
import Root from './components/Root'
import HotelSettingsPage from './features/admin/HotelSettingsPage'
import RevenuePage from './features/revenue/RevenuePage'
import BookPage from './features/book/BookPage'
import StayPage from './features/portal/StayPage'
import ChannelsPage from './features/channels/ChannelsPage'
import FeedbackPage from './features/feedback/FeedbackPage'
import GuestsPage from './features/guests/GuestsPage'
import GuestProfilePage from './features/guests/GuestProfilePage'
import TaxSettingsPage from './features/admin/TaxSettingsPage'
import RatesPoliciesPage from './features/admin/RatesPoliciesPage'
// Area M: compliance, security and controls
import RolesPage from './features/security/RolesPage'
import SignInPage from './features/security/SignInPage'
import AuditTrailPage from './features/security/AuditTrailPage'
import PaymentsSecurityPage from './features/security/PaymentsSecurityPage'
import PrivacyPage from './features/security/PrivacyPage'
import FiscalPage from './features/security/FiscalPage'
import NightAuditPage from './features/frontdesk/NightAuditPage'
import WaitingPage from './features/dashboard/WaitingPage'
import RosterPage from './features/housekeeping/RosterPage'
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
import TravelAgentsPage from './features/frontdesk/TravelAgentsPage'
import MessagesPage from './features/messages/MessagesPage'
import ArrivePage from './features/prearrival/ArrivePage'
import BillPage from './features/prearrival/BillPage'
import WaitlistPage from './features/waitlist/WaitlistPage'
import GroupsPage from './features/groups/GroupsPage'
import CrsPage from './features/crs/CrsPage'
import CompaniesPage from './features/corporate/CompaniesPage'
import HousekeepingPage from './features/housekeeping/HousekeepingPage'
import TasksPage from './features/housekeeping/TasksPage'
import MyTasksPage from './features/housekeeping/MyTasksPage'
import InspectionsPage from './features/housekeeping/InspectionsPage'
import IssuesPage from './features/housekeeping/IssuesPage'
import RoomsOutOfOrderPage from './features/maintenance/RoomsOutOfOrderPage'
import AssetsPage from './features/assets/AssetsPage'
import PlannedWorkPage from './features/assets/PlannedWorkPage'
import EngineeringPage from './features/maintenance/EngineeringPage'
import RoomCheckPage from './features/housekeeping/RoomCheckPage'
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
// Area I: procurement, inventory and cost control
import RfqPage from './features/procurement/RfqPage'
import InvoicesPage from './features/procurement/InvoicesPage'
import SupplierContractsPage from './features/procurement/SupplierContractsPage'
import TransfersPage from './features/inventory/TransfersPage'
import CostAnalyticsPage from './features/inventory/CostAnalyticsPage'
import PosPage from './features/pos/PosPage'
import KitchenDisplayPage from './features/pos/KitchenDisplayPage'
// J. Workforce and service management
import StaffPage from './features/workforce/StaffPage'
import RostersPage from './features/workforce/RostersPage'
import AttendancePage from './features/workforce/AttendancePage'
import WorkTasksPage from './features/workforce/WorkTasksPage'
import ServiceCasesPage from './features/workforce/ServiceCasesPage'
import PayrollHandoffPage from './features/workforce/PayrollHandoffPage'
// Area K: management reports
import ExecutivePage from './features/reports/ExecutivePage'
import DepartmentsPage from './features/reports/DepartmentsPage'
import LibraryPage from './features/reports/LibraryPage'
import PortfolioPage from './features/reports/PortfolioPage'
import AskPage from './features/reports/AskPage'
// Area G: events, banqueting and sales
import EventsHome from './features/events/PipelinePage'
import DiaryPage from './features/events/DiaryPage'
import EventsListPage from './features/events/EventsListPage'
import EventDetailPage from './features/events/EventDetailPage'
import QuotesPage from './features/events/QuotesPage'
import EventBillingPage from './features/events/BillingPage'
import EventSetupPage from './features/events/SetupPage'
import BeoPrintPage from './features/events/BeoPrintPage'
// Area H: Finance and hotel accounting
import AccountingOverviewPage from './features/accounting/AccountingOverviewPage'
import AccountingNightAuditPage from './features/accounting/AccountingNightAuditPage'
import PostingRulesPage from './features/accounting/PostingRulesPage'
import JournalsPage from './features/accounting/JournalsPage'
import CityLedgerPage from './features/accounting/CityLedgerPage'
import CurrenciesPage from './features/accounting/CurrenciesPage'
import BudgetsPage from './features/accounting/BudgetsPage'
// Area L: AI and automation layer.
import AutomationIndex from './features/automation/AutomationIndex'
import InsightsPage from './features/automation/InsightsPage'
import ConciergePage from './features/automation/ConciergePage'
import GuestInsightsPage from './features/automation/GuestInsightsPage'
import OperationsPage from './features/automation/OperationsPage'
import WorkflowsPage from './features/automation/WorkflowsPage'
// Area F: POS, F&B and kitchen
import FloorPlanPage from './features/pos/FloorPlanPage'
import OutletsPage from './features/pos/OutletsPage'
import FoodCostPage from './features/pos/FoodCostPage'

const page = (title: string) => <PagePlaceholder title={title} />

export const router = createBrowserRouter([
  {
    // Sign-in state, features and housekeeping data live here, above both the login page and the app.
    element: <Root />,
    children: [
      { path: '/login', element: <LoginPage /> },
      // The guest's own page. No sign-in, outside the app shell: it is opened from a link on a phone.
      { path: '/arrive/:token', element: <ArrivePage /> },
      { path: '/bill/:token', element: <BillPage /> },
      // One page for the whole stay: the bill, the form before arrival, what they can ask for.
      { path: '/stay/:token', element: <StayPage /> },
      // The hotel's own booking page, which a guest opens from the hotel's website.
      { path: '/book', element: <BookPage /> },
      { path: '/book/:slug', element: <BookPage /> },
      // Area G: the printable BEO, outside the app shell so it prints clean.
      {
        path: '/events/beo/:id',
        element: (
          <FeatureGate feature="eventsBasic">
            <BeoPrintPage />
          </FeatureGate>
        ),
      },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <Landing /> },

          // Overview
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'waiting', element: <WaitingPage /> },

          // Front desk
          { path: 'desk', element: <TodayPage /> },
          { path: 'desk/reservations', element: <ReservationsPage /> },
          { path: 'desk/rooms', element: <RoomsPage /> },
          { path: 'desk/new-reservation', element: <NewReservationPage /> },
          { path: 'desk/folios', element: <FoliosPage /> },
          { path: 'desk/messages', element: <MessagesPage /> },
          { path: 'desk/waiting-list', element: <WaitlistPage /> },
          { path: 'desk/groups', element: <GroupsPage /> },
          { path: 'desk/sister-properties', element: <CrsPage /> },
          { path: 'desk/companies', element: <CompaniesPage /> },
          { path: 'desk/agents', element: <TravelAgentsPage /> },
          { path: 'desk/documents', element: <GuestDocumentsPage /> },
          { path: 'desk/guests', element: <GuestsPage /> },
          { path: 'desk/feedback', element: <FeedbackPage /> },
          { path: 'desk/guests/:guestId', element: <GuestProfilePage /> },
          { path: 'desk/lost-found', element: <LostFoundPage /> },
          { path: 'housekeeping/lost-found', element: <LostFoundPage /> },
          { path: 'desk/night-audit', element: <NightAuditPage /> },

          // Area G: events, banqueting and sales
          {
            path: 'events',
            element: (
              <FeatureGate feature="eventsBasic">
                <EventsHome />
              </FeatureGate>
            ),
          },
          {
            path: 'events/diary',
            element: (
              <FeatureGate feature="eventsBasic">
                <DiaryPage />
              </FeatureGate>
            ),
          },
          {
            path: 'events/bookings',
            element: (
              <FeatureGate feature="eventsBasic">
                <EventsListPage />
              </FeatureGate>
            ),
          },
          {
            path: 'events/bookings/:id',
            element: (
              <FeatureGate feature="eventsBasic">
                <EventDetailPage />
              </FeatureGate>
            ),
          },
          {
            path: 'events/quotes',
            element: (
              <FeatureGate feature="eventsSales">
                <QuotesPage />
              </FeatureGate>
            ),
          },
          {
            path: 'events/billing',
            element: (
              <FeatureGate feature="eventsBasic">
                <EventBillingPage />
              </FeatureGate>
            ),
          },
          {
            path: 'events/setup',
            element: (
              <FeatureGate feature="eventsBasic">
                <EventSetupPage />
              </FeatureGate>
            ),
          },

          // Housekeeping
          { path: 'housekeeping', element: <HousekeepingPage /> },
          { path: 'housekeeping/tasks', element: <TasksPage /> },
          { path: 'housekeeping/my-tasks', element: <MyTasksPage /> },
          { path: 'housekeeping/roster', element: <RosterPage /> },
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
            path: 'housekeeping/room-check',
            element: (
              <FeatureGate feature="roomCheck">
                <RoomCheckPage />
              </FeatureGate>
            ),
          },
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
            path: 'maintenance/assets',
            element: (
              <FeatureGate feature="assetRegister">
                <AssetsPage />
              </FeatureGate>
            ),
          },
          {
            path: 'maintenance/planned',
            element: (
              <FeatureGate feature="preventiveMaintenance">
                <PlannedWorkPage />
              </FeatureGate>
            ),
          },
          {
            path: 'maintenance/engineering',
            element: (
              <FeatureGate feature="engineeringDashboard">
                <EngineeringPage />
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
          { path: 'pos/tables', element: <PosPage /> },
          { path: 'pos/menu', element: <PosPage /> },
          { path: 'pos/payments', element: <PosPage /> },
          { path: 'pos/recipes', element: <PosPage /> },
          { path: 'kitchen', element: <KitchenDisplayPage /> },
          // Area F: POS, F&B and kitchen
          { path: 'pos/floor', element: <FeatureGate feature="posFloorPlan"><FloorPlanPage /></FeatureGate> },
          { path: 'pos/outlets', element: <OutletsPage /> },
          { path: 'pos/food-cost', element: <FeatureGate feature="foodCost"><FoodCostPage /></FeatureGate> },

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

          // Area K: management reports
          { path: 'reports', element: <FeatureGate feature="reportsBasic"><ExecutivePage /></FeatureGate> },
          { path: 'reports/departments', element: <FeatureGate feature="departmentDashboards"><DepartmentsPage /></FeatureGate> },
          { path: 'reports/library', element: <FeatureGate feature="reportsBasic"><LibraryPage /></FeatureGate> },
          { path: 'reports/portfolio', element: <FeatureGate feature="reportsBasic"><PortfolioPage /></FeatureGate> },
          { path: 'reports/ask', element: <FeatureGate feature="analyticsAssistant"><AskPage /></FeatureGate> },
          // Area I: procurement, inventory and cost control
          { path: 'procurement/rfqs', element: <FeatureGate feature="rfq"><RfqPage /></FeatureGate> },
          { path: 'procurement/invoices', element: <FeatureGate feature="invoiceMatching"><InvoicesPage /></FeatureGate> },
          { path: 'procurement/contracts', element: <FeatureGate feature="supplierContracts"><SupplierContractsPage /></FeatureGate> },
          { path: 'inventory/transfers', element: <FeatureGate feature="storeTransfers"><TransfersPage /></FeatureGate> },
          { path: 'inventory/analytics', element: <FeatureGate feature="costAnalytics"><CostAnalyticsPage /></FeatureGate> },

          // HR and Accounting (Trademate)
          // J. Workforce and service management (People)
          { path: 'hr', element: <FeatureGate feature="staffRoster"><StaffPage /></FeatureGate> },
          { path: 'hr/rosters', element: <FeatureGate feature="staffRoster"><RostersPage /></FeatureGate> },
          { path: 'hr/attendance', element: <FeatureGate feature="attendance"><AttendancePage /></FeatureGate> },
          { path: 'hr/tasks', element: <FeatureGate feature="taskSla"><WorkTasksPage /></FeatureGate> },
          { path: 'hr/cases', element: <FeatureGate feature="staffRoster"><ServiceCasesPage /></FeatureGate> },
          { path: 'hr/payroll', element: <FeatureGate feature="payrollHandoff"><PayrollHandoffPage /></FeatureGate> },
          // Area H: the ledger is now the Accounting module
          { path: 'hr/ledger', element: <Navigate to="/accounting" replace /> },
          {
            path: 'finance',
            element: (
              <FeatureGate feature="budgetApproval">
                <RequestsPage key="finance" scope="finance" />
              </FeatureGate>
            ),
          },

          // Area H: Finance and hotel accounting (Trademate link)
          { path: 'accounting', element: <FeatureGate feature="accountingLink"><AccountingOverviewPage /></FeatureGate> },
          { path: 'accounting/night-audit', element: <FeatureGate feature="accountingLink"><AccountingNightAuditPage /></FeatureGate> },
          { path: 'accounting/posting-rules', element: <FeatureGate feature="accountingLink"><PostingRulesPage /></FeatureGate> },
          { path: 'accounting/journals', element: <FeatureGate feature="accountingLink"><JournalsPage /></FeatureGate> },
          { path: 'accounting/city-ledger', element: <FeatureGate feature="accountingLink"><CityLedgerPage /></FeatureGate> },
          { path: 'accounting/currencies', element: <FeatureGate feature="multiCurrency"><CurrenciesPage /></FeatureGate> },
          { path: 'accounting/budgets', element: <FeatureGate feature="budgetsCentres"><BudgetsPage /></FeatureGate> },

          // Admin
          { path: 'admin', element: <HotelSettingsPage /> },
          { path: 'admin/taxes', element: <TaxSettingsPage /> },
          { path: 'admin/approvals', element: <ApprovalsPage /> },
          { path: 'admin/policies', element: <RatesPoliciesPage /> },
          {
            path: 'admin/channels',
            element: (
              <FeatureGate feature="channels">
                <ChannelsPage />
              </FeatureGate>
            ),
          },
          {
            path: 'admin/revenue',
            element: (
              <FeatureGate feature="revenue">
                <RevenuePage />
              </FeatureGate>
            ),
          },

          // Area M: compliance, security and controls
          { path: 'admin/security', element: <Navigate to="/admin/security/roles" replace /> },
          { path: 'admin/security/roles', element: <FeatureGate feature="securityBasic"><RolesPage /></FeatureGate> },
          { path: 'admin/security/sign-in', element: <FeatureGate feature="securityBasic"><SignInPage /></FeatureGate> },
          { path: 'admin/security/audit', element: <FeatureGate feature="securityBasic"><AuditTrailPage /></FeatureGate> },
          { path: 'admin/security/payments', element: <FeatureGate feature="securityBasic"><PaymentsSecurityPage /></FeatureGate> },
          { path: 'admin/security/privacy', element: <FeatureGate feature="securityBasic"><PrivacyPage /></FeatureGate> },
          { path: 'admin/security/fiscal', element: <FeatureGate feature="securityBasic"><FiscalPage /></FeatureGate> },
          // Area L: AI and automation layer
          { path: 'automation', element: <AutomationIndex /> },
          { path: 'automation/insights', element: <FeatureGate feature="anomalyDetection"><InsightsPage /></FeatureGate> },
          { path: 'automation/concierge', element: <FeatureGate feature="aiConcierge"><ConciergePage /></FeatureGate> },
          { path: 'automation/guests', element: <FeatureGate feature="guestSegments"><GuestInsightsPage /></FeatureGate> },
          { path: 'automation/operations', element: <FeatureGate feature="opsPrioritization"><OperationsPage /></FeatureGate> },
          { path: 'automation/workflows', element: <FeatureGate feature="workflowAutomation"><WorkflowsPage /></FeatureGate> },

          // Other apps
          { path: 'guest', element: page('Guest: Find a room') },
          { path: 'platform', element: <PlatformPage /> },

          { path: '*', element: page('Page not found') },
        ],
      },
    ],
  },
])