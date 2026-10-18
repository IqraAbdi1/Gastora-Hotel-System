import { Outlet } from 'react-router-dom'
import HotelProvider from './HotelProvider'
import AuthProvider from '../features/auth/AuthProvider'
import CorporateProvider from '../features/corporate/CorporateProvider'
import FrontDeskProvider from '../features/frontdesk/FrontDeskProvider'
import HousekeepingProvider from '../features/housekeeping/HousekeepingProvider'
import MessagesProvider from '../features/messages/MessagesProvider'
import WaitlistProvider from '../features/waitlist/WaitlistProvider'
import DayRunner from '../features/frontdesk/DayRunner'
import GroupsProvider from '../features/groups/GroupsProvider'
import ApprovalsProvider from '../features/approvals/ApprovalsProvider'
import LostFoundProvider from '../features/lostfound/LostFoundProvider'
import FeaturesProvider from '../features/platform/FeaturesProvider'
import RequestsProvider from '../features/procurement/RequestsProvider'

// These live above both the sign-in page and the app, so signing out and in as someone else keeps
// the hotel's tasks, defects, requests, front desk to-dos and notifications, and your platform settings.
export default function Root() {
  return (
    <FeaturesProvider>
      <HotelProvider>
        <AuthProvider>
          <HousekeepingProvider>
            <RequestsProvider>
              <CorporateProvider>
                <FrontDeskProvider>
                  <ApprovalsProvider>
                    <LostFoundProvider>
                      <MessagesProvider>
                        <WaitlistProvider>
                          <GroupsProvider>
                            <DayRunner />
                            <Outlet />
                          </GroupsProvider>
                        </WaitlistProvider>
                      </MessagesProvider>
                    </LostFoundProvider>
                  </ApprovalsProvider>
                </FrontDeskProvider>
              </CorporateProvider>
            </RequestsProvider>
          </HousekeepingProvider>
        </AuthProvider>
      </HotelProvider>
    </FeaturesProvider>
  )
}