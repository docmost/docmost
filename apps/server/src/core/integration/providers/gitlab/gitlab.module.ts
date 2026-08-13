import { Module, OnModuleInit } from '@nestjs/common';
import { GitLabProvider } from './gitlab.provider';
import { GitLabService } from './gitlab.service';
import { IntegrationRegistry } from '../../registry/integration-registry';
import { IntegrationModule } from '../../integration.module';

@Module({
  imports: [IntegrationModule],
  providers: [GitLabProvider, GitLabService],
  exports: [GitLabProvider],
})
export class GitLabModule implements OnModuleInit {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly gitlabProvider: GitLabProvider,
  ) {}

  onModuleInit() {
    this.registry.register(this.gitlabProvider);
  }
}
