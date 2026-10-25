import { Module, OnModuleInit } from '@nestjs/common';
import { LinearProvider } from './linear.provider';
import { LinearService } from './linear.service';
import { IntegrationRegistry } from '../../registry/integration-registry';
import { IntegrationModule } from '../../integration.module';

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
