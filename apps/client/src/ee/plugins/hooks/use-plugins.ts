import { useState, useEffect } from 'react'

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  enabled: boolean
  configured: boolean
  configSchema?: Record<string, any>
  hooks?: string[]
}

export function usePlugins(workspaceId?: string) {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlugins = async () => {
    if (!workspaceId) return

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

  useEffect(() => {
    if (workspaceId) {
      fetchPlugins()
    }
  }, [workspaceId])

  return { plugins, loading, error, refetch: fetchPlugins }
}
