import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentService } from '../environment/environment.service';
import { createRetryStrategy, parseRedisUrl } from '../../common/helpers';
import { QueueName } from './constants';
import { GeneralQueueProcessor } from './processors/general-queue.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (environmentService: EnvironmentService) => {
        const redisConfig = parseRedisUrl(environmentService.getRedisUrl());
        return {
          connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            username: redisConfig.username,
            password: redisConfig.password,
            db: redisConfig.db,
            family: redisConfig.family,
            tls: redisConfig.tls,
            retryStrategy: createRetryStrategy(),
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 20 * 1000,
            },
            removeOnComplete: {
              count: 200,
            },
            removeOnFail: {
              count: 100,
            },
          },
        };
      },
      inject: [EnvironmentService],
    }),
    BullModule.registerQueue({
      name: QueueName.EMAIL_QUEUE,
    }),
    BullModule.registerQueue({
      name: QueueName.ATTACHMENT_QUEUE,
    }),
    BullModule.registerQueue({
      name: QueueName.GENERAL_QUEUE,
    }),
    BullModule.registerQueue({
      name: QueueName.BILLING_QUEUE,
    }),
    BullModule.registerQueue({
      name: QueueName.FILE_TASK_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 1,
      },
    }),
    BullModule.registerQueue({
      name: QueueName.SEARCH_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 2,
      },
    }),
    BullModule.registerQueue({
      name: QueueName.AI_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 1,
      },
    }),
    BullModule.registerQueue({
      name: QueueName.HISTORY_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 2,
      },
    }),
    BullModule.registerQueue({
      name: QueueName.NOTIFICATION_QUEUE,
    }),
    BullModule.registerQueue({
      name: QueueName.AUDIT_QUEUE,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
      },
    }),
    BullModule.registerQueue({
      name: QueueName.BASE_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    }),
    BullModule.registerQueue({
      name: QueueName.WEBHOOK_QUEUE,
      defaultJobOptions: {
        // Retry immediate failures for several hours instead of exhausting
        // every attempt during a short receiver restart.
        attempts: 12,
        backoff: { type: 'exponential', delay: 10_000, jitter: 0.5 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    }),
  ],
  exports: [BullModule],
  providers: [GeneralQueueProcessor],
})
export class QueueModule {}
