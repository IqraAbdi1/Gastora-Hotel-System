import { Navigate } from 'react-router-dom'
import FeatureGate from '../../components/FeatureGate'
import { visibleModules } from '../../lib/nav'
import { useAuth } from '../auth/authContext'
import { useFeatures } from '../platform/featuresContext'

/** /automation opens the first Automation page this hotel has and this person may open. */
export default function AutomationIndex() {
  const { features } = useFeatures()
  const { canOpen } = useAuth()
  const mod = visibleModules(features, canOpen).find((m) => m.id === 'automation')
  if (mod) return <Navigate to={mod.to} replace />
  return <FeatureGate feature="aiConcierge">{null}</FeatureGate>
}
