import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, NotFoundException } from '@nestjs/common';
import { IntegrationConnection } from '@docmost/db/types/entity.types';
import { TokenInvalidError } from './registry/integration-provider.interface';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants/queue.constants';
import { IntegrationRegistry } from './registry/integration-registry';
import { IntegrationRepo } from './repos/integration.repo';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { OAuthService } from './oauth/oauth.service';

const TOKEN_REFRESH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

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
      case QueueJob.INTEGRATION_TOKEN_REFRESH:
        await this.handleTokenRefresh();
        break;
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  // Route worker-level errors (e.g. lock renewal after laptop sleep) through
  // the logger instead of bullmq's raw console.error fallback.
  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error(`Worker error: ${err.message}`);
  }

  private async handleTokenRefresh(): Promise<void> {
    const connections = await this.connectionRepo.findExpiringTokens(
      TOKEN_REFRESH_WINDOW_MS,
    );

    if (connections.length === 0) {
      return;
    }

    this.logger.log(
      `Refreshing tokens for ${connections.length} connection(s)`,
    );

    for (const connection of connections) {
      try {
        await this.oauthService.getValidAccessToken(connection);
      } catch (err) {
        this.logger.error(
          `Token refresh failed for connection ${connection.id}: ${(err as Error).message}`,
        );
        // Dead credential or orphaned row: retire it so findExpiringTokens stops selecting it.
        if (
          err instanceof NotFoundException ||
          err instanceof TokenInvalidError
        ) {
          await this.connectionRepo
            .invalidate(connection.id)
            .catch(() => undefined);
        }
      }
    }
  }

  private async handleIntegrationEvent(job: Job): Promise<void> {
    const { eventName, workspaceId, ...payload } = job.data;

    if (!workspaceId) {
      return;
    }

    const integrations =
      await this.integrationRepo.findAllByWorkspace(workspaceId);

    for (const integration of integrations) {
      const provider = this.registry.getProvider(integration.type);
      if (!provider?.handleEvent) {
        continue;
      }

      let connection: IntegrationConnection | undefined;
      try {
        const connections = await this.connectionRepo.findByIntegration(
          integration.id,
        );

        connection = connections[0];
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
        if (err instanceof TokenInvalidError && connection) {
          await this.connectionRepo
            .invalidate(connection.id)
            .catch(() => undefined);
        }
      }
    }
  }
}
