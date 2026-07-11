import { RedisService } from '@nestjs-labs/nestjs-ioredis';
export declare class CollabHistoryService {
    private readonly redisService;
    private readonly redis;
    constructor(redisService: RedisService);
    addContributors(pageId: string, userIds: string[]): Promise<void>;
    popContributors(pageId: string): Promise<string[]>;
    clearContributors(pageId: string): Promise<void>;
}
