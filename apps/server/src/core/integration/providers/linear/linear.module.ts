import { Module, OnModuleInit } from '@nestjs/common';
import { LinearProvider } from './linear.provider.js';
import { LinearService } from './linear.service.js';
import { IntegrationRegistry } from '../../registry/integration-registry.js';
import { IntegrationModule } from '../../integration.module.js';

@Module({
  imports: [IntegrationModule],
  providers: [LinearProvider, LinearService],
  exports: [LinearProvider],
})
export class LinearModule implements OnModuleInit {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly linearProvider: LinearProvider,
  ) {}

  onModuleInit() {
    this.registry.register(this.linearProvider);
  }
}
