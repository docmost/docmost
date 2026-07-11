import { AcceptInviteDto, InviteUserDto } from '../dto/invitation.dto';
import { UserRepo } from "../../../database/repos/user/user.repo";
import { KyselyDB } from "../../../database/types/kysely.types";
import { User, Workspace } from "../../../database/types/entity.types";
import { MailService } from '../../../integrations/mail/mail.service';
import { GroupUserRepo } from "../../../database/repos/group/group-user.repo";
import { TokenService } from '../../auth/services/token.service';
import { SessionService } from '../../session/session.service';
import { PaginationOptions } from "../../../database/pagination/pagination-options";
import { DomainService } from "../../../integrations/environment/domain.service";
import { Queue } from 'bullmq';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { IAuditService } from '../../../integrations/audit/audit.service';
export declare class WorkspaceInvitationService {
    private userRepo;
    private groupUserRepo;
    private mailService;
    private domainService;
    private tokenService;
    private sessionService;
    private readonly db;
    private billingQueue;
    private readonly environmentService;
    private readonly auditService;
    private readonly logger;
    constructor(userRepo: UserRepo, groupUserRepo: GroupUserRepo, mailService: MailService, domainService: DomainService, tokenService: TokenService, sessionService: SessionService, db: KyselyDB, billingQueue: Queue, environmentService: EnvironmentService, auditService: IAuditService);
    getInvitations(workspaceId: string, pagination: PaginationOptions): Promise<import("@docmost/db/pagination/cursor-pagination").CursorPaginationResult<{
        id: string;
        workspaceId: string;
        createdAt: Date;
        role: string;
        email: string;
    }, undefined>>;
    getInvitationById(invitationId: string, workspace: Workspace): Promise<{
        enforceSso: boolean;
        id: string;
        createdAt: Date;
        email: string;
    }>;
    getInvitationTokenById(invitationId: string, workspaceId: string): Promise<{
        token: string;
    }>;
    createInvitation(inviteUserDto: InviteUserDto, workspace: Workspace, authUser: User): Promise<void>;
    acceptInvitation(dto: AcceptInviteDto, workspace: Workspace): Promise<{
        authToken?: string;
        requiresLogin?: boolean;
        message?: string;
    }>;
    resendInvitation(invitationId: string, workspace: Workspace): Promise<void>;
    revokeInvitation(invitationId: string, workspaceId: string): Promise<void>;
    getInvitationLinkById(invitationId: string, workspace: Workspace): Promise<string>;
    buildInviteLink(opts: {
        invitationId: string;
        inviteToken: string;
        hostname?: string;
    }): Promise<string>;
    sendInvitationMail(invitationId: string, inviteeEmail: string, inviteToken: string, invitedByName: string, hostname?: string): Promise<void>;
}
