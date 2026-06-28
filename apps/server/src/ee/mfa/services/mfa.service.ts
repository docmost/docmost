import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UserMfaRepo } from '../repos/user-mfa.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { TokenService } from '../../../core/auth/services/token.service';
import { SessionService } from '../../../core/session/session.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { LoginDto } from '../../../core/auth/dto/login.dto';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { comparePasswordHash, isUserDisabled } from '../../../common/helpers';
import { FastifyReply } from 'fastify';
import { JwtMfaTokenPayload, JwtType } from '../../../core/auth/dto/jwt-payload';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import { throwIfEmailNotVerified } from '../../../core/auth/auth.util';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';

@Injectable()
export class MfaService {
  constructor(
    private readonly userMfaRepo: UserMfaRepo,
    private readonly userRepo: UserRepo,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly environmentService: EnvironmentService,
    private readonly workspaceRepo: WorkspaceRepo,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getStatus(userId: string) {
    const mfa = await this.userMfaRepo.findByUserId(userId);
    return {
      isEnabled: mfa?.isEnabled === true,
      method: mfa?.method ?? null,
      backupCodesCount: mfa?.backupCodes?.length ?? 0,
    };
  }

  async setup(user: User, workspace: Workspace) {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: workspace.name || 'Docmost',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    await this.userMfaRepo.upsert({
      userId: user.id,
      workspaceId: workspace.id,
      method: 'totp',
      secret: secret.base32,
      isEnabled: false,
      backupCodes: null,
    });

    return {
      method: 'totp',
      qrCode: '',
      manualKey: secret.base32,
      otpauthUrl: totp.toString(),
    };
  }

  async enable(userId: string, verificationCode: string) {
    const mfa = await this.userMfaRepo.findByUserId(userId);
    if (!mfa?.secret) {
      throw new BadRequestException('MFA setup required');
    }

    if (!this.verifyTotp(mfa.secret, verificationCode)) {
      throw new BadRequestException('Invalid verification code');
    }

    const backupCodes = await this.generateBackupCodesPlain();
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    await this.userMfaRepo.update(userId, {
      isEnabled: true,
      backupCodes: hashedCodes,
    });

    this.auditService.log({
      event: AuditEvent.USER_MFA_ENABLED,
      resourceType: AuditResource.USER,
      resourceId: userId,
    });

    return { success: true, backupCodes };
  }

  async disable(userId: string, workspaceId: string, password?: string) {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includePassword: true,
    });

    if (password && user?.password) {
      const match = await comparePasswordHash(password, user.password);
      if (!match) {
        throw new ForbiddenException('Invalid password');
      }
    }

    await this.userMfaRepo.update(userId, {
      isEnabled: false,
      secret: null,
      backupCodes: null,
    });

    this.auditService.log({
      event: AuditEvent.USER_MFA_DISABLED,
      resourceType: AuditResource.USER,
      resourceId: userId,
    });

    return { success: true };
  }

  async regenerateBackupCodes(
    userId: string,
    workspaceId: string,
    password?: string,
  ) {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includePassword: true,
    });

    if (password && user?.password) {
      const match = await comparePasswordHash(password, user.password);
      if (!match) {
        throw new ForbiddenException('Invalid password');
      }
    }

    const mfa = await this.userMfaRepo.findByUserId(userId);
    if (!mfa?.isEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const backupCodes = await this.generateBackupCodesPlain();
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    await this.userMfaRepo.update(userId, { backupCodes: hashedCodes });

    this.auditService.log({
      event: AuditEvent.USER_MFA_BACKUP_CODE_GENERATED,
      resourceType: AuditResource.USER,
      resourceId: userId,
    });

    return { backupCodes };
  }

  async checkMfaRequirements(
    loginInput: LoginDto,
    workspace: Workspace,
    res: FastifyReply,
  ) {
    const user = await this.userRepo.findByEmail(loginInput.email, workspace.id, {
      includePassword: true,
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

    const mfa = await this.userMfaRepo.findByUserId(user.id);
    const userHasMfa = mfa?.isEnabled === true;
    const isMfaEnforced = workspace.enforceMfa === true;

    if (userHasMfa || isMfaEnforced) {
      const mfaToken = await this.tokenService.generateMfaToken(
        user,
        workspace.id,
      );
      this.setMfaCookie(res, mfaToken);

      return {
        userHasMfa,
        requiresMfaSetup: isMfaEnforced && !userHasMfa,
        isMfaEnforced,
      };
    }

    user.lastLoginAt = new Date();
    await this.userRepo.updateLastLogin(user.id, workspace.id);

    const authToken = await this.sessionService.createSessionAndToken(user);
    return { authToken };
  }

  async validateMfaAccess(req: any) {
    const token = req.cookies?.mfaToken;
    if (!token) {
      return { valid: false };
    }

    try {
      const payload = (await this.tokenService.verifyJwt(
        token,
        JwtType.MFA_TOKEN,
      )) as JwtMfaTokenPayload;

      const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
      if (!user || isUserDisabled(user)) {
        return { valid: false };
      }

      const mfa = await this.userMfaRepo.findByUserId(user.id);
      const workspace = await this.workspaceRepo.findById(payload.workspaceId);

      return {
        valid: true,
        isTransferToken: true,
        userHasMfa: mfa?.isEnabled === true,
        requiresMfaSetup:
          !mfa?.isEnabled && workspace?.enforceMfa === true,
        isMfaEnforced: workspace?.enforceMfa === true,
      };
    } catch {
      return { valid: false };
    }
  }

  async verifyAndLogin(code: string, req: any, res: FastifyReply) {
    const token = req.cookies?.mfaToken;
    if (!token) {
      throw new UnauthorizedException('MFA session expired');
    }

    const payload = (await this.tokenService.verifyJwt(
      token,
      JwtType.MFA_TOKEN,
    )) as JwtMfaTokenPayload;

    const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    const mfa = await this.userMfaRepo.findByUserId(user.id);
    if (!mfa?.isEnabled) {
      throw new BadRequestException('MFA setup required');
    }

    const valid = await this.verifyCode(mfa, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    user.lastLoginAt = new Date();
    await this.userRepo.updateLastLogin(user.id, payload.workspaceId);

    const authToken = await this.sessionService.createSessionAndToken(user);
    res.clearCookie('mfaToken');
    this.setAuthCookie(res, authToken);

    this.auditService.log({
      event: AuditEvent.USER_LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      metadata: { source: 'mfa' },
    });

    return { success: true };
  }

  private async verifyCode(mfa: any, code: string): Promise<boolean> {
    if (code.length === 6 && /^\d+$/.test(code)) {
      return this.verifyTotp(mfa.secret, code);
    }

    if (mfa.backupCodes?.length) {
      for (let i = 0; i < mfa.backupCodes.length; i++) {
        const match = await bcrypt.compare(code, mfa.backupCodes[i]);
        if (match) {
          const remaining = [...mfa.backupCodes];
          remaining.splice(i, 1);
          await this.userMfaRepo.update(mfa.userId, {
            backupCodes: remaining,
          });
          return true;
        }
      }
    }

    return false;
  }

  private verifyTotp(secret: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  private async generateBackupCodesPlain(): Promise<string[]> {
    return Array.from({ length: 10 }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );
  }

  private setMfaCookie(res: FastifyReply, token: string) {
    res.setCookie('mfaToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(Date.now() + 5 * 60 * 1000),
      secure: this.environmentService.isHttps(),
    });
  }

  private setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }
}
