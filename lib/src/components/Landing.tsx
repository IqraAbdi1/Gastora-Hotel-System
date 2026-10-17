import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'

// "/" sends each role to its own first page.
export default function Landing() {
  const { role } = useAuth()
  return <Navigate to={role?.landing ?? '/login'} replace />
}