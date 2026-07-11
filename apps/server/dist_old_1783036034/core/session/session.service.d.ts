import { TokenService } from '../auth/services/token.service';
import { UserSessionRepo } from "../../database/repos/session/user-session.repo";
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { User } from "../../database/types/entity.types";
import { ClsService } from 'nestjs-cls';
export declare class SessionService {
    private readonly tokenService;
    private readonly userSessionRepo;
    private readonly environmentService;
    private readonly cls;
    private readonly logger;
    constructor(tokenService: TokenService, userSessionRepo: UserSessionRepo, environmentService: EnvironmentService, cls: ClsService);
    cleanupSessions(): Promise<void>;
    createSessionAndToken(user: User): Promise<string>;
    getActiveSessions(userId: string, workspaceId: string, currentSessionId: string | null): Promise<{
        id: string;
        deviceName: string;
        geoLocation: string;
        lastActiveAt: Date;
        createdAt: Date;
        isCurrentDevice: boolean;
    }[]>;
    revokeSession(sessionId: string, userId: string, workspaceId: string): Promise<void>;
    revokeAllOtherSessions(currentSessionId: string, userId: string, workspaceId: string): Promise<void>;
    private parseDeviceName;
}
