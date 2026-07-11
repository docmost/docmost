import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import { UserSessionRepo } from "../../database/repos/session/user-session.repo";
import { UserRepo } from "../../database/repos/user/user.repo";
export declare class SessionActivityService {
    private readonly redisService;
    private readonly userSessionRepo;
    private readonly userRepo;
    private readonly redis;
    constructor(redisService: RedisService, userSessionRepo: UserSessionRepo, userRepo: UserRepo);
    trackActivity(sessionId: string, userId: string, workspaceId: string): void;
}
