import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import { InjectKysely } from 'nestjs-kysely'
import { Kysely, sql } from 'kysely'
import { PluginRegistry } from './plugin.registry'

export interface PluginConfigData {
  id: string | null
  workspaceId: string
  pluginId: string
  enabled: boolean
  config: Record<string, any>
  version: number
  createdAt?: Date
  updatedAt?: Date
}

@Injectable()
export class PluginConfigService {
  private readonly logger = new Logger(PluginConfigService.name)

  constructor(
    @InjectKysely() private db: Kysely<any>,
    private registry: PluginRegistry,
  ) {}

  async getConfig(
    workspaceId: string,
    pluginId: string,
  ): Promise<PluginConfigData> {
    const plugin = this.registry.getPlugin(pluginId)
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`)
    }

    const config = await this.db
      .selectFrom('plugin_configurations')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('plugin_id', '=', pluginId)
      .executeTakeFirst()

    if (!config) {
      return {
        id: null,
        workspaceId,
        pluginId,
        enabled: false,
        config: {},
        version: 0,
      }
    }

    return {
      id: config.id,
      workspaceId: config.workspace_id,
      pluginId: config.plugin_id,
      enabled: config.enabled,
      config: config.config || {},
      version: config.version,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    }
  }

  async updateConfig(
    workspaceId: string,
    pluginId: string,
    updates: {
      enabled?: boolean
      config?: Record<string, any>
    },
    userId?: string,
  ): Promise<PluginConfigData> {
    const plugin = this.registry.getPlugin(pluginId)
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`)
    }

    // Validate config if provided
    if (updates.config && plugin.configSchema) {
      const validation = this.validateConfig(
        updates.config,
        plugin.configSchema,
      )
      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Invalid configuration',
          errors: validation.errors,
        })
      }
    }

    const existing = await this.db
      .selectFrom('plugin_configurations')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .where('plugin_id', '=', pluginId)
      .executeTakeFirst()

    let result

    if (existing) {
      // Update existing
      result = await this.db
        .updateTable('plugin_configurations')
        .set({
          enabled:
            updates.enabled !== undefined ? updates.enabled : existing.enabled,
          config: updates.config || existing.config,
          updated_at: new Date(),
          updated_by: userId || existing.updated_by,
          version: existing.version + 1,
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow()
    } else {
      // Create new
      result = await this.db
        .insertInto('plugin_configurations')
        .values({
          workspace_id: workspaceId,
          plugin_id: pluginId,
          enabled: updates.enabled ?? false,
          config: updates.config || {},
          created_by: userId,
          updated_by: userId,
          version: 1,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
    }

    this.logger.log(
      `Plugin ${pluginId} config updated in workspace ${workspaceId}`,
    )

    return {
      id: result.id,
      workspaceId: result.workspace_id,
      pluginId: result.plugin_id,
      enabled: result.enabled,
      config: result.config || {},
      version: result.version,
      updatedAt: result.updated_at,
    }
  }

  async togglePlugin(
    workspaceId: string,
    pluginId: string,
    enabled: boolean,
    userId?: string,
  ): Promise<PluginConfigData> {
    return this.updateConfig(workspaceId, pluginId, { enabled }, userId)
  }

  async listConfigs(workspaceId: string): Promise<PluginConfigData[]> {
    const configs = await this.db
      .selectFrom('plugin_configurations')
      .selectAll()
      .where('workspace_id', '=', workspaceId)
      .orderBy('created_at', 'desc')
      .execute()

    return configs.map((cfg) => ({
      id: cfg.id,
      workspaceId: cfg.workspace_id,
      pluginId: cfg.plugin_id,
      enabled: cfg.enabled,
      config: cfg.config || {},
      version: cfg.version,
      createdAt: cfg.created_at,
      updatedAt: cfg.updated_at,
    }))
  }

  private validateConfig(
    config: Record<string, any>,
    schema: Record<string, any>,
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (!schema.properties) {
      return { valid: true }
    }

    for (const [key, propDef] of Object.entries(schema.properties)) {
      const prop = propDef as any
      const value = config[key]

      // Check required
      if (prop.required && value === undefined) {
        errors.push(`Missing required field: ${key}`)
      }

      // Check type
      if (value !== undefined) {
        if (prop.type === 'string' && typeof value !== 'string') {
          errors.push(`Field ${key} must be string`)
        } else if (prop.type === 'number' && typeof value !== 'number') {
          errors.push(`Field ${key} must be number`)
        } else if (prop.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Field ${key} must be boolean`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }
}
