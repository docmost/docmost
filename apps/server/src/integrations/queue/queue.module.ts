import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentService } from '../environment/environment.service';
import { parseRedisUrl } from '../../helpers';
import { QueueName } from './constants';

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
            password: redisConfig.password,
            retryStrategy: function (times: number) {
              return Math.max(Math.min(Math.exp(times), 20000), 1000);
            },
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 10000,
            },
          },
        };
      },
      inject: [EnvironmentService],
    }),
    BullModule.registerQueue({
      name: QueueName.EMAIL_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
