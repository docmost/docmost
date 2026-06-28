import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator'
import { User, Workspace } from '@docmost/db/types/entity.types'
import { PluginConfigService } from './services/plugin-config.service'
import { PluginRegistry } from './services/plugin.registry'

@Controller('plugins')
export class PluginsController {
  private readonly logger = new Logger(PluginsController.name)

  constructor(
    private readonly configService: PluginConfigService,
    private readonly registry: PluginRegistry,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async listPlugins(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    try {
      const plugins = this.registry.getAllPlugins()
      const configs = await this.configService.listConfigs(workspace.id)

      const configMap = new Map(configs.map((c) => [c.pluginId, c]))

      const enriched = plugins.map((plugin) => {
        const config = configMap.get(plugin.id)
        return {
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          description: plugin.description || '',
          author: plugin.author || 'Unknown',
          enabled: config?.enabled || false,
          configured: !!config?.id,
          hooks: plugin.hooks || [],
        }
      })

      return { data: enriched }
    } catch (error) {
      this.logger.error('Failed to list plugins:', error)
      throw error
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':pluginId')
  async getPlugin(
    @AuthWorkspace() workspace: Workspace,
    @Param('pluginId') pluginId: string,
  ) {
    const plugin = this.registry.getPlugin(pluginId)
    if (!plugin) {
      throw new NotFoundException(`Plugin ${pluginId} not found`)
    }

    const config = await this.configService.getConfig(workspace.id, pluginId)

    return {
      data: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        configSchema: plugin.configSchema,
        hooks: plugin.hooks,
        ...config,
      },
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':pluginId/config')
  async getConfig(
    @AuthWorkspace() workspace: Workspace,
    @Param('pluginId') pluginId: string,
  ) {
    const config = await this.configService.getConfig(workspace.id, pluginId)
    return { data: this.redactSecrets(config) }
  }

  @UseGuards(JwtAuthGuard)
  @Put(':pluginId/config')
  async updateConfig(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('pluginId') pluginId: string,
    @Body() body: { config?: Record<string, any>; enabled?: boolean },
  ) {
    if (!body.config && body.enabled === undefined) {
      throw new BadRequestException('Must provide config or enabled field')
    }

    const updated = await this.configService.updateConfig(
      workspace.id,
      pluginId,
      body,
      user.id,
    )

    this.logger.log(
      `Plugin ${pluginId} config updated by user ${user.id} in workspace ${workspace.id}`,
    )

    return { data: this.redactSecrets(updated) }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':pluginId/toggle')
  async togglePlugin(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('pluginId') pluginId: string,
    @Body() body: { enabled: boolean },
  ) {
    if (body.enabled === undefined) {
      throw new BadRequestException('enabled field is required')
    }

    await this.configService.togglePlugin(
      workspace.id,
      pluginId,
      body.enabled,
      user.id,
    )

    this.logger.log(
      `Plugin ${pluginId} toggled to ${body.enabled} by user ${user.id}`,
    )

    return { data: { success: true, enabled: body.enabled } }
  }

  private redactSecrets(data: any): any {
    if (!data?.config) return data

    const secretFields = [
      'secretKey',
      'secret',
      'password',
      'apiKey',
      'token',
      'key',
    ]

    const redacted = { ...data }
    redacted.config = { ...data.config }

    for (const field of secretFields) {
      if (field in redacted.config && redacted.config[field]) {
        redacted.config[field] = '***REDACTED***'
      }
    }

    return redacted
  }
}
