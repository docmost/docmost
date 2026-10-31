import { Module, OnModuleInit } from '@nestjs/common';
import { GitHubProvider } from './github.provider.js';
import { GitHubService } from './github.service.js';
import { IntegrationRegistry } from '../../registry/integration-registry.js';
import { IntegrationModule } from '../../integration.module.js';

@Module({
  imports: [IntegrationModule],
  providers: [GitHubProvider, GitHubService],
  exports: [GitHubProvider],
})
export class GitHubModule implements OnModuleInit {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly githubProvider: GitHubProvider,
  ) {}

  onModuleInit() {
    this.registry.register(this.githubProvider);
  }
}
