import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from './constants';
import { BacklinksProcessor } from './processors/backlinks.processor';
import { RedisConfigService } from '../redis/redis-config.service';
import { RedisConfigModule } from '../redis/redis-config-module';

@Global()
@Module({
  imports: [
    RedisConfigModule,
    BullModule.forRootAsync({
      imports: [RedisConfigModule],
      inject: [RedisConfigService],
      useFactory: (redisConfigService: RedisConfigService) => {
        return {
          connection: redisConfigService.getOptions(),
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
      }
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
  ],
  exports: [BullModule],
  providers: [BacklinksProcessor],
})
export class QueueModule {}
