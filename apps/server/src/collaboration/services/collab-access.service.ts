import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import { COLLAB_ACCESS_RECHECK_CHANNEL } from '../constants';

export type CollabAccessRecheck = {
  userIds?: string[];
  pageIds?: string[];
};

@Injectable()
export class CollabAccessService {
  private readonly logger = new Logger(CollabAccessService.name);

  constructor(private readonly redisService: RedisService) {}

  async recheckAccess(recheck: CollabAccessRecheck): Promise<void> {
    if (!recheck.userIds?.length && !recheck.pageIds?.length) return;
    try {
      await this.redisService
        .getOrThrow()
        .publish(COLLAB_ACCESS_RECHECK_CHANNEL, JSON.stringify(recheck));
    } catch (err) {
      this.logger.error({ err }, 'Failed to publish collab access recheck');
    }
  }
}
