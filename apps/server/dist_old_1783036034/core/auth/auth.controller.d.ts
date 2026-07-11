import { LoginDto } from './dto/login.dto';
import { AuthService } from './services/auth.service';
import { SessionService } from '../session/session.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User, Workspace } from "../../database/types/entity.types";
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { VerifyUserTokenDto } from './dto/verify-user-token.dto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ModuleRef } from '@nestjs/core';
import { IAuditService } from '../../integrations/audit/audit.service';
export declare class AuthController {
    private authService;
    private sessionService;
    private environmentService;
    private moduleRef;
    private readonly auditService;
    private readonly logger;
    constructor(authService: AuthService, sessionService: SessionService, environmentService: EnvironmentService, moduleRef: ModuleRef, auditService: IAuditService);
    login(workspace: Workspace, res: FastifyReply, loginInput: LoginDto): Promise<{
        userHasMfa: any;
        requiresMfaSetup: any;
        isMfaEnforced: any;
    }>;
    setupWorkspace(res: FastifyReply, createAdminUserDto: CreateAdminUserDto): Promise<{
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
        settings: import("../../database/types/db").JsonValue;
        status: string;
        stripeCustomerId: string;
        trialEndAt: Date;
    }>;
    changePassword(dto: ChangePasswordDto, user: User, workspace: Workspace, req: FastifyRequest): Promise<void>;
    forgotPassword(forgotPasswordDto: ForgotPasswordDto, workspace: Workspace): Promise<void>;
    passwordReset(res: FastifyReply, passwordResetDto: PasswordResetDto, workspace: Workspace): Promise<{
        requiresLogin: boolean;
    }>;
    verifyResetToken(verifyUserTokenDto: VerifyUserTokenDto, workspace: Workspace): Promise<void>;
    collabToken(user: User, workspace: Workspace): Promise<{
        token: string;
    }>;
    logout(user: User, req: FastifyRequest, res: FastifyReply): Promise<void>;
    setAuthCookie(res: FastifyReply, token: string): void;
}
