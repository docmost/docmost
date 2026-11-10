import { Module, OnModuleInit } from '@nestjs/common';
import { FigmaProvider } from './figma.provider';
import { FigmaService } from './figma.service';
import { IntegrationRegistry } from '../../registry/integration-registry';
import { IntegrationModule } from '../../integration.module';

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
