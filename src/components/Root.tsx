import { Outlet } from 'react-router-dom'
import AuthProvider from '../features/auth/AuthProvider'
import CorporateProvider from '../features/corporate/CorporateProvider'
import FrontDeskProvider from '../features/frontdesk/FrontDeskProvider'
import HousekeepingProvider from '../features/housekeeping/HousekeepingProvider'
import FeaturesProvider from '../features/platform/FeaturesProvider'
import RequestsProvider from '../features/procurement/RequestsProvider'

// These live above both the sign-in page and the app, so signing out and in as someone else keeps
// the hotel's tasks, defects, requests, front desk to-dos and notifications, and your platform settings.
export default function Root() {
  return (
    <FeaturesProvider>
      <AuthProvider>
        <HousekeepingProvider>
          <RequestsProvider>
            <CorporateProvider>
              <FrontDeskProvider>
                <Outlet />
              </FrontDeskProvider>
            </CorporateProvider>
          </RequestsProvider>
        </HousekeepingProvider>
      </AuthProvider>
    </FeaturesProvider>
  )
}