import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { IntegrationConnectionRepo } from './repos/integration-connection.repo';
import { OAuthService } from './oauth/oauth.service';

const TOKEN_REFRESH_WINDOW_MS = 15 * 60 * 1000;
// Even at 2 s per refresh, a full batch finishes inside JOB_TIMEOUT_MS.
const TOKEN_REFRESH_BATCH_SIZE = 500;
const TOKEN_REFRESH_CONCURRENCY = 5;
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

@Processor(QueueName.INTEGRATION_QUEUE)
export class IntegrationProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationProcessor.name);

  constructor(
    private readonly connectionRepo: IntegrationConnectionRepo,
    private readonly oauthService: OAuthService,
  ) {
    super();
  }

  async process(job: Job, token?: string, signal?: AbortSignal): Promise<void> {
    const timeout = AbortSignal.timeout(JOB_TIMEOUT_MS);
    const jobSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    // a hung db query can't be cancelled, so stop waiting on it and free the worker
    return Promise.race([
      this.runJob(job, jobSignal),
      new Promise<never>((_, reject) => {
        jobSignal.addEventListener(
          'abort',
          () =>
            reject(new Error(`Job ${job.id} aborted: ${jobSignal.reason}`)),
          { once: true },
        );
      }),
    ]);
  }

  private async runJob(job: Job, signal: AbortSignal): Promise<void> {
    switch (job.name) {
      case QueueJob.INTEGRATION_TOKEN_REFRESH:
        await this.handleTokenRefresh(signal);
        break;
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  @OnWorkerEvent('error')
  onError(err: Error): void {
    this.logger.error(`Worker error: ${err.message}`);
  }

  @OnWorkerEvent('lockRenewalFailed')
  onLockRenewalFailed(jobIds: string[]): void {
    for (const jobId of jobIds) {
      this.worker.cancelJob(jobId, 'lock lost');
    }
  }

  private async handleTokenRefresh(signal: AbortSignal): Promise<void> {
    const inFlight = new Set<string>();
    const logAbort = () => {
      const step =
        inFlight.size > 0
          ? `refreshing connections ${[...inFlight].join(', ')}`
          : 'loading expiring tokens';
      this.logger.warn(`Token refresh aborted while ${step}: ${signal.reason}`);
    };
    signal.addEventListener('abort', logAbort, { once: true });

    try {
      const connections = await this.connectionRepo.findExpiringTokens(
        TOKEN_REFRESH_WINDOW_MS,
        TOKEN_REFRESH_BATCH_SIZE,
      );

      if (connections.length === 0) {
        return;
      }

      let next = 0;
      let refreshed = 0;
      // Each connection is taken once, and refreshes of different rows never conflict.
      const refreshRemaining = async () => {
        while (next < connections.length) {
          signal.throwIfAborted();
          const connection = connections[next++];
          inFlight.add(connection.id);
          try {
            await this.oauthService.refreshAccessToken(connection);
            refreshed += 1;
          } catch (err) {
            this.logger.error(
              `Token refresh failed for connection ${connection.id}: ${(err as Error).message}`,
            );
          } finally {
            inFlight.delete(connection.id);
          }
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(TOKEN_REFRESH_CONCURRENCY, connections.length) },
          () => refreshRemaining(),
        ),
      );

      this.logger.debug(
        `Refreshed ${refreshed} of ${connections.length} expiring token(s)`,
      );
    } finally {
      signal.removeEventListener('abort', logAbort);
    }
  }
}
