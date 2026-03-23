import { SettingsView } from '@/components/settings/SettingsView'
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary'

export default function SettingsPage() {
  return (
    <FeatureErrorBoundary name="Settings">
      <SettingsView />
    </FeatureErrorBoundary>
  )
}
