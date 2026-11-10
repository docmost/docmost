import { Module, OnModuleInit } from '@nestjs/common';
import { GitHubProvider } from './github.provider';
import { GitHubService } from './github.service';
import { IntegrationRegistry } from '../../registry/integration-registry';
import { IntegrationModule } from '../../integration.module';

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
