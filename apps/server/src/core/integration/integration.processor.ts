import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants/queue.constants';
import { IntegrationRegistry } from './registry/integration-registry';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { OAuthService } from './oauth/oauth.service';

@Processor(QueueName.INTEGRATION_QUEUE)
export class IntegrationProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationProcessor.name);

  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly integrationRepo: IntegrationRepo,
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly oauthService: OAuthService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QueueJob.INTEGRATION_EVENT:
        await this.handleIntegrationEvent(job);
        break;
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private async handleIntegrationEvent(job: Job): Promise<void> {
    const { eventName, workspaceId, ...payload } = job.data;

    if (!workspaceId) {
      return;
    }

    const integrations =
      await this.integrationRepo.findEnabledByWorkspace(workspaceId);

    for (const integration of integrations) {
      const provider = this.registry.getProvider(integration.type);
      if (!provider?.handleEvent) {
        continue;
      }

      try {
        const connections = await this.connectionRepo.findByIntegration(
          integration.id,
        );

        const connection = connections[0];
        let accessToken: string | undefined;

        if (connection) {
          accessToken = await this.oauthService.getValidAccessToken(connection);
        }

        await provider.handleEvent({
          eventName,
          payload,
          integration: {
            id: integration.id,
            type: integration.type,
            settings: integration.settings as Record<string, any> | null,
          },
          connection: connection
            ? { accessToken, userId: connection.userId }
            : undefined,
        });
      } catch (err) {
        this.logger.error(
          `Integration event handler failed for ${integration.type}: ${(err as Error).message}`,
        );
      }
    }
  }
}
