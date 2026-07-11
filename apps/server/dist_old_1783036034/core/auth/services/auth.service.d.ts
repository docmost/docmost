import { LoginDto } from '../dto/login.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { TokenService } from './token.service';
import { SessionService } from '../../session/session.service';
import { UserSessionRepo } from "../../../database/repos/session/user-session.repo";
import { SignupService } from './signup.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UserRepo } from "../../../database/repos/user/user.repo";
import { ChangePasswordDto } from '../dto/change-password.dto';
import { MailService } from '../../../integrations/mail/mail.service';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { UserTokenRepo } from "../../../database/repos/user-token/user-token.repo";
import { PasswordResetDto } from '../dto/password-reset.dto';
import { User, Workspace } from "../../../database/types/entity.types";
import { KyselyDB } from "../../../database/types/kysely.types";
import { VerifyUserTokenDto } from '../dto/verify-user-token.dto';
import { DomainService } from '../../../integrations/environment/domain.service';
import { IAuditService } from '../../../integrations/audit/audit.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
export declare class AuthService {
    private signupService;
    private tokenService;
    private sessionService;
    private userSessionRepo;
    private userRepo;
    private userTokenRepo;
    private mailService;
    private domainService;
    private environmentService;
    private readonly db;
    private readonly auditService;
    constructor(signupService: SignupService, tokenService: TokenService, sessionService: SessionService, userSessionRepo: UserSessionRepo, userRepo: UserRepo, userTokenRepo: UserTokenRepo, mailService: MailService, domainService: DomainService, environmentService: EnvironmentService, db: KyselyDB, auditService: IAuditService);
    login(loginDto: LoginDto, workspaceId: string): Promise<string>;
    register(createUserDto: CreateUserDto, workspaceId: string): Promise<string>;
    setup(createAdminUserDto: CreateAdminUserDto): Promise<{
        workspace: {
            hostname: string;
            description: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date;
            auditRetentionDays: number;
            trashRetentionDays: number;
            billingEmail: string;
            customDomain: string;
            defaultRole: string;
            defaultSpaceId: string;
            emailDomains: string[];
            enforceMfa: boolean;
            enforceSso: boolean;
            isScimEnabled: boolean;
            licenseKey: string;
            logo: string;
            name: string;
            plan: string;
            settings: import("../../../database/types/db").JsonValue;
            status: string;
            stripeCustomerId: string;
            trialEndAt: Date;
        };
        authToken: string;
    }>;
    changePassword(dto: ChangePasswordDto, userId: string, workspaceId: string, currentSessionId?: string): Promise<void>;
    forgotPassword(forgotPasswordDto: ForgotPasswordDto, workspace: Workspace): Promise<void>;
    passwordReset(passwordResetDto: PasswordResetDto, workspace: Workspace): Promise<{
        requiresLogin: boolean;
        authToken?: undefined;
    } | {
        authToken: string;
        requiresLogin?: undefined;
    }>;
    verifyUserToken(userTokenDto: VerifyUserTokenDto, workspaceId: string): Promise<void>;
    getCollabToken(user: User, workspaceId: string): Promise<{
        token: string;
    }>;
}
