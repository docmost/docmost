import { SessionService } from './session.service';
import { User, Workspace } from "../../database/types/entity.types";
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { FastifyRequest } from 'fastify';
export declare class SessionController {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    listSessions(user: User, workspace: Workspace, req: FastifyRequest): Promise<{
        sessions: {
            id: string;
            deviceName: string;
            geoLocation: string;
            lastActiveAt: Date;
            createdAt: Date;
            isCurrentDevice: boolean;
        }[];
    }>;
    revokeSession(dto: RevokeSessionDto, user: User, workspace: Workspace, req: FastifyRequest): Promise<void>;
    revokeAllSessions(user: User, workspace: Workspace, req: FastifyRequest): Promise<void>;
}
