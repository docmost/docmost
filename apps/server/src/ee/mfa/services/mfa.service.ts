import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { TokenService } from '../../../core/auth/services/token.service';
import { SessionService } from '../../../core/session/session.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import {
  comparePasswordHash,
  isUserDisabled,
  nanoIdGen,
} from '../../../common/helpers';
import { throwIfEmailNotVerified } from '../../../core/auth/auth.util';
import OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { FastifyReply, FastifyRequest } from 'fastify';
import { JwtType } from '../../../core/auth/dto/jwt-payload';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';

type UserWithMfa = User & {
  mfa?: {
    isEnabled?: boolean | null;
  } | null;
};

@Injectable()
export class MfaService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly environmentService: EnvironmentService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async checkMfaRequirements(
    loginInput: { email: string; password: string },
    workspace: Workspace,
    res: FastifyReply,
  ) {
    const user = await this.userRepo.findByEmail(loginInput.email, workspace.id, {
      includePassword: true,
      includeUserMfa: true,
    });

    const errorMessage = 'Email or password does not match';
    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException(errorMessage);
    }

    const isPasswordMatch = await comparePasswordHash(
      loginInput.password,
      user.password,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException(errorMessage);
    }

    throwIfEmailNotVerified({
      isCloud: this.environmentService.isCloud(),
      emailVerifiedAt: user.emailVerifiedAt,
      email: user.email,
      workspaceId: workspace.id,
      appSecret: this.environmentService.getAppSecret(),
    });

    const userHasMfa = this.hasMfaEnabled(user);
    const isMfaEnforced = workspace.enforceMfa === true;
    const requiresMfaSetup = isMfaEnforced && !userHasMfa;

    if (userHasMfa || requiresMfaSetup) {
      const mfaToken = await this.tokenService.generateMfaToken(user, workspace.id);
      this.setAuthCookie(res, mfaToken, 5 * 60 * 1000);

      return {
        userHasMfa,
        requiresMfaSetup,
        isMfaEnforced,
      };
    }

    const authToken = await this.sessionService.createSessionAndToken(user);
    await this.userRepo.updateLastLogin(user.id, workspace.id);

    this.auditService.log({
      event: AuditEvent.USER_LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      metadata: { source: 'password' },
    });

    return { authToken };
  }

  async getMfaStatus(userId: string, workspaceId: string) {
    const row = await this.db
      .selectFrom('userMfa')
      .select(['isEnabled', 'method', 'backupCodes'])
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    return {
      isEnabled: row?.isEnabled ?? false,
      method: row?.method ?? null,
      backupCodesCount: row?.backupCodes?.length ?? 0,
    };
  }

  async setupMfa(user: User) {
    const secret = new OTPAuth.Secret();
    const secretBase32 = secret.base32;
    const totp = new OTPAuth.TOTP({
      issuer: 'Docmost',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    const otpauth = totp.toString();
    const qrCode = await QRCode.toDataURL(otpauth);

    return {
      method: 'totp',
      qrCode,
      secret: secretBase32,
      manualKey: secretBase32,
    };
  }

  async enableMfa(
    user: User,
    workspaceId: string,
    dto: { secret: string; verificationCode: string },
  ) {
    if (!this.verifyTotp(dto.secret, dto.verificationCode)) {
      throw new BadRequestException('Invalid verification code');
    }

    const backupCodes = this.generateBackupCodes();
    const existing = await this.db
      .selectFrom('userMfa')
      .select('id')
      .where('userId', '=', user.id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (existing) {
      await this.db
        .updateTable('userMfa')
        .set({
          secret: dto.secret,
          method: 'totp',
          isEnabled: true,
          backupCodes,
          updatedAt: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();
    } else {
      await this.db
        .insertInto('userMfa')
        .values({
          userId: user.id,
          workspaceId,
          secret: dto.secret,
          method: 'totp',
          isEnabled: true,
          backupCodes,
        })
        .execute();
    }

    this.auditService.log({
      event: AuditEvent.USER_MFA_ENABLED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
    });

    return {
      success: true,
      backupCodes,
    };
  }

  async disableMfa(
    user: User,
    workspaceId: string,
    dto: { confirmPassword?: string },
  ) {
    const userWithPassword = await this.userRepo.findById(user.id, workspaceId, {
      includePassword: true,
    });

    if (!userWithPassword) {
      throw new NotFoundException('User not found');
    }

    if (userWithPassword.password) {
      if (!dto.confirmPassword) {
        throw new BadRequestException('confirmPassword is required');
      }

      const validPassword = await comparePasswordHash(
        dto.confirmPassword,
        userWithPassword.password,
      );
      if (!validPassword) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    await this.db
      .updateTable('userMfa')
      .set({
        isEnabled: false,
        secret: null,
        backupCodes: [],
        updatedAt: new Date(),
      })
      .where('userId', '=', user.id)
      .where('workspaceId', '=', workspaceId)
      .execute();

    this.auditService.log({
      event: AuditEvent.USER_MFA_DISABLED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
    });

    return { success: true };
  }

  async regenerateBackupCodes(
    user: User,
    workspaceId: string,
    dto: { confirmPassword?: string },
  ) {
    const status = await this.getMfaStatus(user.id, workspaceId);
    if (!status.isEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const userWithPassword = await this.userRepo.findById(user.id, workspaceId, {
      includePassword: true,
    });

    if (userWithPassword?.password) {
      if (!dto.confirmPassword) {
        throw new BadRequestException('confirmPassword is required');
      }
      const validPassword = await comparePasswordHash(
        dto.confirmPassword,
        userWithPassword.password,
      );
      if (!validPassword) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    const backupCodes = this.generateBackupCodes();
    await this.db
      .updateTable('userMfa')
      .set({ backupCodes, updatedAt: new Date() })
      .where('userId', '=', user.id)
      .where('workspaceId', '=', workspaceId)
      .execute();

    this.auditService.log({
      event: AuditEvent.USER_MFA_BACKUP_CODE_GENERATED,
      resourceType: AuditResource.USER,
      resourceId: user.id,
    });

    return { backupCodes };
  }

  async verifyMfaCode(req: FastifyRequest, res: FastifyReply, code: string) {
    const tokenUser = await this.requireTransferUser(req);
    const row = await this.db
      .selectFrom('userMfa')
      .selectAll()
      .where('userId', '=', tokenUser.user.id)
      .where('workspaceId', '=', tokenUser.workspace.id)
      .executeTakeFirst();

    if (!row || !row.isEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const isBackupCode = code.length === 8;
    let valid = false;

    if (isBackupCode) {
      const backupCodes = row.backupCodes ?? [];
      const index = backupCodes.findIndex(
        (value) => value.toLowerCase() === code.toLowerCase(),
      );
      valid = index >= 0;
      if (valid) {
        backupCodes.splice(index, 1);
        await this.db
          .updateTable('userMfa')
          .set({ backupCodes, updatedAt: new Date() })
          .where('id', '=', row.id)
          .execute();
      }
    } else {
      valid = this.verifyTotp(row.secret, code);
    }

    if (!valid) {
      throw new BadRequestException('Invalid verification code');
    }

    const authToken = await this.sessionService.createSessionAndToken(tokenUser.user);
    this.setAuthCookie(res, authToken);
    await this.userRepo.updateLastLogin(tokenUser.user.id, tokenUser.workspace.id);

    this.auditService.logWithContext(
      {
        event: AuditEvent.USER_LOGIN,
        resourceType: AuditResource.USER,
        resourceId: tokenUser.user.id,
        metadata: { source: 'mfa' },
      },
      {
        workspaceId: tokenUser.workspace.id,
        actorId: tokenUser.user.id,
        actorType: 'user',
      },
    );

    return { success: true };
  }

  async validateAccess(req: FastifyRequest) {
    const token = req.cookies?.authToken;
    if (!token) {
      return { valid: false };
    }

    try {
      const payload = await this.tokenService.verifyJwt(token, JwtType.ACCESS);
      return {
        valid: true,
        isTransferToken: false,
        requiresMfaSetup: false,
        userHasMfa: false,
        isMfaEnforced: false,
        workspaceId: payload.workspaceId,
      };
    } catch {
      // fall through
    }

    try {
      const payload = await this.tokenService.verifyJwt(token, JwtType.MFA_TOKEN);
      const user = await this.userRepo.findById(payload.sub, payload.workspaceId, {
        includeUserMfa: true,
      });
      const workspace = await this.workspaceRepo.findById(payload.workspaceId);

      if (!user || !workspace) {
        return { valid: false };
      }

      const userHasMfa = this.hasMfaEnabled(user);
      const requiresMfaSetup = workspace.enforceMfa === true && !userHasMfa;

      return {
        valid: true,
        isTransferToken: true,
        requiresMfaSetup,
        userHasMfa,
        isMfaEnforced: workspace.enforceMfa === true,
      };
    } catch {
      return { valid: false };
    }
  }

  async getUserForSetup(req: FastifyRequest) {
    const access = await this.validateAccess(req);
    if (!access.valid) {
      throw new UnauthorizedException();
    }

    const token = req.cookies?.authToken;
    const tokenType = access.isTransferToken ? JwtType.MFA_TOKEN : JwtType.ACCESS;
    const payload = await this.tokenService.verifyJwt(token, tokenType);
    const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
    const workspace = await this.workspaceRepo.findById(payload.workspaceId);

    if (!user || !workspace) {
      throw new UnauthorizedException();
    }

    return { user, workspace };
  }

  private async requireTransferUser(req: FastifyRequest) {
    const token = req.cookies?.authToken;
    if (!token) {
      throw new UnauthorizedException();
    }

    const payload = await this.tokenService.verifyJwt(token, JwtType.MFA_TOKEN);
    const [user, workspace] = await Promise.all([
      this.userRepo.findById(payload.sub, payload.workspaceId),
      this.workspaceRepo.findById(payload.workspaceId),
    ]);

    if (!user || !workspace) {
      throw new UnauthorizedException();
    }

    return { user, workspace };
  }

  private setAuthCookie(res: FastifyReply, token: string, ttlMs?: number) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: ttlMs
        ? new Date(Date.now() + ttlMs)
        : this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }

  private verifyTotp(secretBase32: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: 'Docmost',
      label: 'Docmost',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });

    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  private generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => nanoIdGen().slice(0, 8).toUpperCase());
  }

  private hasMfaEnabled(user: User | null | undefined): boolean {
    return Boolean((user as UserWithMfa | null | undefined)?.mfa?.isEnabled);
  }
}
