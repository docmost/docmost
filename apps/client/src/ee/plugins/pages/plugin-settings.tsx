import { useState, useEffect } from 'react'
import { useWorkspace } from '@/features/workspace/hooks/use-workspace'
import { PluginList } from '../components/plugin-list'
import { PluginConfigPanel } from '../components/plugin-config-panel'

export function PluginSettingsPage() {
  const { workspace } = useWorkspace()
  const [plugins, setPlugins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)

  useEffect(() => {
    if (workspace?.id) {
      fetchPlugins()
    }
  }, [workspace?.id])

  const fetchPlugins = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/plugins')
      if (!response.ok) throw new Error('Failed to fetch plugins')
      const data = await response.json()
      setPlugins(data.plugins)
    } catch (err: any) {
      setError(err.message || 'Failed to load plugins')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Plugin Management</h1>
        <p className="text-gray-600">
          Manage and configure plugins for your workspace
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <PluginList
        plugins={plugins}
        loading={loading}
        onSelect={setSelectedPlugin}
        onToggle={fetchPlugins}
      />

      {selectedPlugin && (
        <PluginConfigPanel
          pluginId={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          onSave={fetchPlugins}
        />
      )}
    </div>
  )
}
