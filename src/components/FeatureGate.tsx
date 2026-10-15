import type { ReactNode } from 'react'
import { FEATURES } from '../lib/features'
import type { FeatureKey } from '../lib/features'
import { useFeatures } from '../features/platform/featuresContext'

export default function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureKey
  children: ReactNode
}) {
  const { features, tenant } = useFeatures()

  if (features[feature]) return <>{children}</>

  const label = FEATURES.find((f) => f.key === feature)?.label ?? 'This feature'
  const suspended = tenant.status === 'suspended'

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-ink-200 bg-surface p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-ink-900">
        {suspended ? 'Account suspended' : `${label} is not on your plan`}
      </h1>
      <p className="mt-2 text-sm text-ink-600">
        {suspended
          ? 'Please contact Gastora to restore access.'
          : `Ask your Gastora administrator to switch it on for ${tenant.name}.`}
      </p>
    </div>
  )
}