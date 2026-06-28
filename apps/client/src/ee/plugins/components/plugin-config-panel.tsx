import { useState, useEffect } from 'react'

interface ConfigPanelProps {
  pluginId: string
  onClose: () => void
  onSave: () => void
}

export function PluginConfigPanel({
  pluginId,
  onClose,
  onSave,
}: ConfigPanelProps) {
  const [plugin, setPlugin] = useState<any>(null)
  const [config, setConfig] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPluginDetails()
  }, [pluginId])

  const fetchPluginDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const [detailsRes, configRes] = await Promise.all([
        fetch(`/api/plugins/${pluginId}`),
        fetch(`/api/plugins/${pluginId}/config`),
      ])

      if (!detailsRes.ok || !configRes.ok) {
        throw new Error('Failed to fetch plugin details')
      }

      const details = await detailsRes.json()
      const pluginConfig = await configRes.json()

      setPlugin(details)
      setConfig(pluginConfig.config || {})
    } catch (err: any) {
      setError(err.message || 'Failed to load plugin details')
    } finally {
      setLoading(false)
    }
  }

  const handleConfigChange = (key: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/plugins/${pluginId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.message || 'Failed to save plugin configuration',
        )
      }

      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            Configure {plugin?.name || pluginId}
          </h2>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <p>Loading configuration...</p>
            </div>
          ) : plugin?.configSchema ? (
            <div className="space-y-4">
              {Object.entries(plugin.configSchema.properties || {}).map(
                ([key, schema]: [string, any]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {schema.title || key}
                      {schema.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>

                    {schema.description && (
                      <p className="text-xs text-gray-600 mb-2">
                        {schema.description}
                      </p>
                    )}

                    {schema.type === 'string' && !schema.enum ? (
                      schema.type === 'password' || key.includes('secret') ? (
                        <input
                          type="password"
                          value={config[key] || ''}
                          onChange={(e) =>
                            handleConfigChange(key, e.target.value)
                          }
                          placeholder={schema.placeholder || ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={config[key] || ''}
                          onChange={(e) =>
                            handleConfigChange(key, e.target.value)
                          }
                          placeholder={schema.placeholder || ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )
                    ) : schema.type === 'number' ? (
                      <input
                        type="number"
                        value={config[key] || ''}
                        onChange={(e) =>
                          handleConfigChange(key, parseFloat(e.target.value))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : schema.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={config[key] || false}
                        onChange={(e) =>
                          handleConfigChange(key, e.target.checked)
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    ) : schema.enum ? (
                      <select
                        value={config[key] || ''}
                        onChange={(e) =>
                          handleConfigChange(key, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select an option</option>
                        {schema.enum.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No configuration available for this plugin</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}
