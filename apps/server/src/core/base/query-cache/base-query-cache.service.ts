import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { QueryCacheConfigProvider } from './query-cache.config';

@Injectable()
export class BaseQueryCacheService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BaseQueryCacheService.name);

  constructor(private readonly configProvider: QueryCacheConfigProvider) {}

  async onApplicationBootstrap(): Promise<void> {
    const { enabled } = this.configProvider.config;
    this.logger.log(
      `BaseQueryCacheService bootstrapped (enabled=${enabled}).`,
    );
    // Real warm-up is added in task 9.
  }

  async onModuleDestroy(): Promise<void> {
    // Real cleanup is added in task 5.
  }
}
