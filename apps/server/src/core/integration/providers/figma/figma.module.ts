import { Module, OnModuleInit } from '@nestjs/common';
import { FigmaProvider } from './figma.provider.js';
import { FigmaService } from './figma.service.js';
import { IntegrationRegistry } from '../../registry/integration-registry.js';
import { IntegrationModule } from '../../integration.module.js';

@Module({
  imports: [IntegrationModule],
  providers: [FigmaProvider, FigmaService],
  exports: [FigmaProvider],
})
export class FigmaModule implements OnModuleInit {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly figmaProvider: FigmaProvider,
  ) {}

  onModuleInit() {
    this.registry.register(this.figmaProvider);
  }
}
