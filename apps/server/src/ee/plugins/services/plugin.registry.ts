import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'

export interface PluginMetadata {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  configSchema?: Record<string, any>
  hooks?: string[]
}

@Injectable()
export class PluginRegistry {
  private readonly logger = new Logger(PluginRegistry.name)
  private plugins: Map<string, PluginMetadata> = new Map()

  constructor() {
    this.loadPlugins()
  }

  private loadPlugins(): void {
    const pluginsDir = path.join(process.cwd(), 'plugins')

    if (!fs.existsSync(pluginsDir)) {
      this.logger.debug('Plugins directory not found')
      return
    }

    try {
      const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const configPath = path.join(pluginsDir, entry.name, 'plugin.config.json')
        if (!fs.existsSync(configPath)) continue

        try {
          const configContent = fs.readFileSync(configPath, 'utf-8')
          const config: PluginMetadata = JSON.parse(configContent)

          // Validate config
          if (!config.id || !config.name || !config.version) {
            this.logger.warn(
              `Invalid plugin config in ${entry.name}: missing required fields`,
            )
            continue
          }

          this.plugins.set(config.id, config)
          this.logger.log(`Plugin loaded: ${config.id} v${config.version}`)
        } catch (error) {
          this.logger.error(
            `Failed to parse plugin config from ${configPath}:`,
            error,
          )
        }
      }
    } catch (error) {
      this.logger.error('Failed to load plugins directory:', error)
    }
  }

  getPlugin(id: string): PluginMetadata | undefined {
    return this.plugins.get(id)
  }

  getAllPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values())
  }

  hasPlugin(id: string): boolean {
    return this.plugins.has(id)
  }

  reloadPlugins(): void {
    this.plugins.clear()
    this.loadPlugins()
  }
}
