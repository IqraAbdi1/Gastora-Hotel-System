import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from './components/AppShell'
import PagePlaceholder from './components/PagePlaceholder'
import LoginPage from './features/auth/LoginPage'
import DashboardPage from './features/dashboard/DashboardPage'
import TodayPage from './features/frontdesk/TodayPage'
import ReservationsPage from './features/frontdesk/ReservationsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      { path: 'desk', element: <TodayPage /> },
      { path: 'desk/reservations', element: <ReservationsPage /> },
      { path: 'desk/rooms', element: <PagePlaceholder title="Rooms board" /> },
      { path: 'desk/folios', element: <PagePlaceholder title="Folios" /> },

      {
        path: 'housekeeping',
        element: <PagePlaceholder title="Housekeeping: My rooms" />,
      },
      {
        path: 'pos',
        element: <PagePlaceholder title="POS: Tables and new order" />,
      },
      {
        path: 'inventory',
        element: <PagePlaceholder title="Inventory: Stock list" />,
      },
      {
        path: 'finance',
        element: <PagePlaceholder title="Finance: Daily revenue" />,
      },
      {
        path: 'manager',
        element: <PagePlaceholder title="Manager: Dashboard" />,
      },
      {
        path: 'guest',
        element: <PagePlaceholder title="Guest: Find a room" />,
      },
      {
        path: 'admin',
        element: <PagePlaceholder title="Admin: Hotels" />,
      },
      {
        path: '*',
        element: <PagePlaceholder title="Page not found" />,
      },
    ],
  },
])