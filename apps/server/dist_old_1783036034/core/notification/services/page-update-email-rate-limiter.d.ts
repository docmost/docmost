import { RedisService } from '@nestjs-labs/nestjs-ioredis';
export declare class PageUpdateEmailRateLimiter {
    private readonly redisService;
    private readonly redis;
    constructor(redisService: RedisService);
    canSendEmail(userId: string): Promise<boolean>;
    addToDigest(userId: string, notificationId: string): Promise<boolean>;
    popDigest(userId: string): Promise<string[]>;
}
