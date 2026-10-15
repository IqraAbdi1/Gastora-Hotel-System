
import { createBrowserRouter, Navigate } from 'react-router-dom'

import AppShell from './components/AppShell'
import PagePlaceholder from './components/PagePlaceholder'

import LoginPage from './features/auth/LoginPage'
import DashboardPage from './features/dashboard/DashboardPage'

import TodayPage from './features/frontdesk/TodayPage'
import ReservationsPage from './features/frontdesk/ReservationsPage'
import RoomsPage from './features/frontdesk/RoomsPage'
import NewReservationPage from './features/frontdesk/NewReservationPage'

import HousekeepingPage from './features/housekeeping/HousekeepingPage'

import GuestsPage from './features/guests/GuestsPage'
import GuestProfilePage from './features/guests/GuestProfilePage'

export const router = createBrowserRouter([
  // Authentication
  {
    path: '/login',
    element: <LoginPage />,
  },

  // Public guest portal
  {
    path: '/guest',
    element: <PagePlaceholder title="Guest Portal" />,
  },
  {
    path: '/guest/rooms',
    element: <PagePlaceholder title="Available Rooms" />,
  },
  {
    path: '/guest/stay',
    element: <PagePlaceholder title="My Stay" />,
  },

  // Hotel staff application
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },

      // Front desk
      {
        path: 'desk',
        element: <TodayPage />,
      },
      {
        path: 'desk/reservations',
        element: <ReservationsPage />,
      },
      {
        path: 'desk/rooms',
        element: <RoomsPage />,
      },
      {
        path: 'desk/new-reservation',
        element: <NewReservationPage />,
      },
      {
        path: 'desk/folios',
        element: <PagePlaceholder title="Folios" />,
      },

      // Guests
      {
        path: 'guests',
        element: <GuestsPage />,
      },
      {
        path: 'guests/:guestId',
        element: <GuestProfilePage />,
      },

      // Hotel operations
      {
        path: 'housekeeping',
        element: <HousekeepingPage />,
      },
      {
        path: 'pos',
        element: <PagePlaceholder title="POS: Tables and New Order" />,
      },
      {
        path: 'inventory',
        element: <PagePlaceholder title="Inventory: Stock List" />,
      },
      {
        path: 'finance',
        element: <PagePlaceholder title="Finance: Daily Revenue" />,
      },
      {
        path: 'manager',
        element: <PagePlaceholder title="Manager: Dashboard" />,
      },
      {
        path: 'admin',
        element: <PagePlaceholder title="Admin: Hotels" />,
      },

      // Unknown staff routes
      {
        path: '*',
        element: <PagePlaceholder title="Page Not Found" />,
      },
    ],
  },
])
