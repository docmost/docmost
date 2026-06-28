import { Module, Global, OnModuleInit, Logger } from '@nestjs/common'
import { setHookRegistry } from '../../core/plugins/plugin-hooks'
import { PluginRegistry } from './services/plugin.registry'
import { PluginConfigService } from './services/plugin-config.service'
import { HookRegistry } from './services/hook.registry'
import { PluginsController } from './plugins.controller'

@Global()
@Module({
  providers: [PluginRegistry, PluginConfigService, HookRegistry],
  controllers: [PluginsController],
  exports: [PluginRegistry, PluginConfigService, HookRegistry],
})
export class PluginsModule implements OnModuleInit {
  private readonly logger = new Logger(PluginsModule.name)

  constructor(private readonly hookRegistry: HookRegistry) {}

  async onModuleInit() {
    this.logger.log('Initializing Plugins Module')

    // Set hook registry globally
    setHookRegistry(this.hookRegistry)

    this.logger.log('Hook registry initialized globally')
  }
}
