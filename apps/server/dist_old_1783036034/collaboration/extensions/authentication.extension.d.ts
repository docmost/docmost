import { Extension, onAuthenticatePayload } from '@hocuspocus/server';
import { TokenService } from '../../core/auth/services/token.service';
import { UserRepo } from "../../database/repos/user/user.repo";
import { PageRepo } from "../../database/repos/page/page.repo";
import { SpaceMemberRepo } from "../../database/repos/space/space-member.repo";
import { PagePermissionRepo } from "../../database/repos/page/page-permission.repo";
export declare class AuthenticationExtension implements Extension {
    private tokenService;
    private userRepo;
    private pageRepo;
    private readonly spaceMemberRepo;
    private readonly pagePermissionRepo;
    private readonly logger;
    constructor(tokenService: TokenService, userRepo: UserRepo, pageRepo: PageRepo, spaceMemberRepo: SpaceMemberRepo, pagePermissionRepo: PagePermissionRepo);
    onAuthenticate(data: onAuthenticatePayload): Promise<{
        user: {
            password: string;
            id: string;
            workspaceId: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date;
            role: string;
            name: string;
            settings: import("../../database/types/db").JsonValue;
            email: string;
            invitedById: string;
            avatarUrl: string;
            deactivatedAt: Date;
            emailVerifiedAt: Date;
            lastActiveAt: Date;
            lastLoginAt: Date;
            locale: string;
            hasGeneratedPassword: boolean;
            scimExternalId: string;
            timezone: string;
        };
    }>;
}
