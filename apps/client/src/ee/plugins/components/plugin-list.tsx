import { useState } from 'react'

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean
  configured: boolean
}

interface PluginListProps {
  plugins: Plugin[]
  loading: boolean
  onSelect: (id: string) => void
  onToggle: () => void
}

export function PluginList({
  plugins,
  loading,
  onSelect,
  onToggle,
}: PluginListProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    setTogglingId(pluginId)
    try {
      const response = await fetch(`/api/plugins/${pluginId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })

      if (!response.ok) throw new Error('Failed to toggle plugin')
      onToggle()
    } catch (error) {
      console.error('Toggle error:', error)
      alert('Failed to toggle plugin')
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Loading plugins...</p>
      </div>
    )
  }

  if (plugins.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No plugins available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plugins.map((plugin) => (
        <div
          key={plugin.id}
          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{plugin.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{plugin.description}</p>
              <p className="text-xs text-gray-500 mb-2">
                v{plugin.version} by {plugin.author}
              </p>

              <div className="flex gap-2 flex-wrap">
                {plugin.enabled && (
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Enabled
                  </span>
                )}
                {!plugin.enabled && (
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    Disabled
                  </span>
                )}
                {plugin.configured && (
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Configured
                  </span>
                )}
                {!plugin.configured && plugin.enabled && (
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Needs Configuration
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() => handleToggle(plugin.id, plugin.enabled)}
                disabled={togglingId === plugin.id}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  plugin.enabled
                    ? 'bg-green-600'
                    : 'bg-gray-300'
                } ${togglingId === plugin.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    plugin.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>

              <button
                onClick={() => onSelect(plugin.id)}
                className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
              >
                Configure
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
