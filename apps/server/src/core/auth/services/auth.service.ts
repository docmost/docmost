import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { TokenService } from './token.service';
import { SignupService } from './signup.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import {
  comparePasswordHash,
  hashPassword,
  nanoIdGen,
} from '../../../common/helpers';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { MailService } from '../../../integrations/mail/mail.service';
import ChangePasswordEmail from '@docmost/transactional/emails/change-password-email';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import ForgotPasswordEmail from '@docmost/transactional/emails/forgot-password-email';
import { UserTokenRepo } from '@docmost/db/repos/user-token/user-token.repo';
import { PasswordResetDto } from '../dto/password-reset.dto';
import { UserToken, Workspace } from '@docmost/db/types/entity.types';
import { UserTokenType } from '../auth.constants';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { executeTx } from '@docmost/db/utils';
import { VerifyUserTokenDto } from '../dto/verify-user-token.dto';
import { DomainService } from '../../../integrations/environment/domain.service';
import { TotpService } from './totp.service';
import { EnableTotpDto, DisableTotpDto, VerifyTotpDto } from '../dto/totp.dto';

@Injectable()
export class AuthService {
  constructor(
    private signupService: SignupService,
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private userTokenRepo: UserTokenRepo,
    private mailService: MailService,
    private domainService: DomainService,
    private totpService: TotpService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  private async parseBackupCodes(
    backupCodesData: any,
    userId: string,
    workspaceId: string,
  ): Promise<string[] | null> {
    if (!backupCodesData) {
      return null;
    }

    try {
      if (Array.isArray(backupCodesData)) {
        return backupCodesData;
      }
      
      if (typeof backupCodesData === 'string') {
        const parsed = JSON.parse(backupCodesData);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      
      console.warn(`Invalid backup codes format for user ${userId}, resetting...`);
      await this.userRepo.updateUser(
        {
          totpBackupCodes: null,
        },
        userId,
        workspaceId,
      );
      return null;
    } catch (error) {
      console.warn(`Corrupted backup codes data for user ${userId}, resetting...`);
      await this.userRepo.updateUser(
        {
          totpBackupCodes: null,
        },
        userId,
        workspaceId,
      );
      return null;
    }
  }

  private async verifyTotpOrBackupCode(
    token: string,
    userId: string,
    workspaceId: string,
  ): Promise<{ isValid: boolean; usedBackupCodeIndex?: number }> {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includePassword: true
    });
    
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('TOTP is not enabled for this user');
    }

    const secret = this.totpService.decrypt(user.totpSecret);
    if (this.totpService.verifyToken(token, secret)) {
      return { isValid: true };
    }

    const backupCodes = await this.parseBackupCodes(user.totpBackupCodes, userId, workspaceId);
    if (backupCodes) {
      const backupResult = await this.totpService.verifyBackupCode(token, backupCodes);
      
      if (backupResult.isValid) {
        return { 
          isValid: true, 
          usedBackupCodeIndex: backupResult.codeIndex 
        };
      }
    }

    return { isValid: false };
  }

  async login(loginDto: LoginDto, workspaceId: string) {
    const user = await this.userRepo.findByEmail(loginDto.email, workspaceId, {
      includePassword: true,
    });

    const errorMessage = 'email or password does not match';
    if (!user || user?.deletedAt) {
      throw new UnauthorizedException(errorMessage);
    }

    const isPasswordMatch = await comparePasswordHash(
      loginDto.password,
      user.password,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException(errorMessage);
    }

    if (user.totpEnabled) {
      if (!loginDto.totpToken) {
        return { requiresTotp: true };
      }

      const totpValid = await this.verifyTotpForLogin(
        { token: loginDto.totpToken },
        user.id,
        workspaceId,
      );

      if (!totpValid) {
        throw new UnauthorizedException('Invalid TOTP token');
      }
    }

    user.lastLoginAt = new Date();
    await this.userRepo.updateLastLogin(user.id, workspaceId);

    return this.tokenService.generateAccessToken(user);
  }

  async register(createUserDto: CreateUserDto, workspaceId: string) {
    const user = await this.signupService.signup(createUserDto, workspaceId);
    return this.tokenService.generateAccessToken(user);
  }

  async setup(createAdminUserDto: CreateAdminUserDto) {
    const { workspace, user } =
      await this.signupService.initialSetup(createAdminUserDto);

    const authToken = await this.tokenService.generateAccessToken(user);
    return { workspace, authToken };
  }

  async changePassword(
    dto: ChangePasswordDto,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includePassword: true,
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const comparePasswords = await comparePasswordHash(
      dto.oldPassword,
      user.password,
    );

    if (!comparePasswords) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(dto.newPassword);
    await this.userRepo.updateUser(
      {
        password: newPasswordHash,
      },
      userId,
      workspaceId,
    );

    const emailTemplate = ChangePasswordEmail({ username: user.name });
    await this.mailService.sendToQueue({
      to: user.email,
      subject: 'Your password has been changed',
      template: emailTemplate,
    });
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
    workspace: Workspace,
  ): Promise<void> {
    const user = await this.userRepo.findByEmail(
      forgotPasswordDto.email,
      workspace.id,
    );

    if (!user || user.deletedAt) {
      return;
    }

    const token = nanoIdGen(16);

    const resetLink = `${this.domainService.getUrl(workspace.hostname)}/password-reset?token=${token}`;

    await this.userTokenRepo.insertUserToken({
      token: token,
      userId: user.id,
      workspaceId: user.workspaceId,
      expiresAt: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour
      type: UserTokenType.FORGOT_PASSWORD,
    });

    const emailTemplate = ForgotPasswordEmail({
      username: user.name,
      resetLink: resetLink,
    });

    await this.mailService.sendToQueue({
      to: user.email,
      subject: 'Reset your password',
      template: emailTemplate,
    });
  }

  async passwordReset(passwordResetDto: PasswordResetDto, workspaceId: string) {
    const userToken = await this.userTokenRepo.findById(
      passwordResetDto.token,
      workspaceId,
    );

    if (
      !userToken ||
      userToken.type !== UserTokenType.FORGOT_PASSWORD ||
      userToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.userRepo.findById(userToken.userId, workspaceId);
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const newPasswordHash = await hashPassword(passwordResetDto.newPassword);

    await executeTx(this.db, async (trx) => {
      await this.userRepo.updateUser(
        {
          password: newPasswordHash,
        },
        user.id,
        workspaceId,
        trx,
      );

      await trx
        .deleteFrom('userTokens')
        .where('userId', '=', user.id)
        .where('type', '=', UserTokenType.FORGOT_PASSWORD)
        .execute();
    });

    const emailTemplate = ChangePasswordEmail({ username: user.name });
    await this.mailService.sendToQueue({
      to: user.email,
      subject: 'Your password has been changed',
      template: emailTemplate,
    });

    return this.tokenService.generateAccessToken(user);
  }

  async verifyUserToken(
    userTokenDto: VerifyUserTokenDto,
    workspaceId: string,
  ): Promise<void> {
    const userToken: UserToken = await this.userTokenRepo.findById(
      userTokenDto.token,
      workspaceId,
    );

    if (
      !userToken ||
      userToken.type !== userTokenDto.type ||
      userToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async getCollabToken(userId: string, workspaceId: string) {
    const token = await this.tokenService.generateCollabToken(
      userId,
      workspaceId,
    );
    return { token };
  }

  async generateTotpSetup(userId: string, workspaceId: string) {
    const user = await this.userRepo.findById(userId, workspaceId);
    
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (user.totpEnabled) {
      throw new BadRequestException('TOTP is already enabled for this user');
    }

    const totpSetup = await this.totpService.generateTotpSetup(user.email);
    
    return {
      qrCodeDataUrl: totpSetup.qrCodeDataUrl,
      secret: totpSetup.secret,
    };
  }

  async enableTotp(
    dto: EnableTotpDto,
    userId: string,
    workspaceId: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.userRepo.findById(userId, workspaceId);
    
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (user.totpEnabled) {
      throw new BadRequestException('TOTP is already enabled for this user');
    }

    if (!this.totpService.verifyToken(dto.token, dto.secret)) {
      throw new BadRequestException('Invalid TOTP token');
    }

    const backupCodes = this.totpService.generateBackupCodes();
    const hashedBackupCodes = await this.totpService.hashBackupCodes(backupCodes);

    const encryptedSecret = this.totpService.encrypt(dto.secret);

    await this.userRepo.updateUser(
      {
        totpEnabled: true,
        totpSecret: encryptedSecret,
        totpBackupCodes: JSON.stringify(hashedBackupCodes),
      },
      userId,
      workspaceId,
    );

    return { backupCodes };
  }

  async disableTotp(
    dto: DisableTotpDto,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includePassword: true,
    });
    
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (!user.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('TOTP is not enabled for this user');
    }

    const verificationResult = await this.verifyTotpOrBackupCode(
      dto.token,
      userId,
      workspaceId,
    );

    if (!verificationResult.isValid) {
      throw new BadRequestException('Invalid TOTP token or backup code');
    }

    await this.userRepo.updateUser(
      {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: null,
      },
      userId,
      workspaceId,
    );
  }

  async verifyTotpForLogin(
    dto: VerifyTotpDto,
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const verificationResult = await this.verifyTotpOrBackupCode(
      dto.token,
      userId,
      workspaceId,
    );

    if (!verificationResult.isValid) {
      return false;
    }

    if (verificationResult.usedBackupCodeIndex !== undefined) {
      const user = await this.userRepo.findById(userId, workspaceId);
      if (user?.totpBackupCodes) {
        const backupCodes = await this.parseBackupCodes(user.totpBackupCodes, userId, workspaceId);
        if (backupCodes) {
          const updatedCodes = this.totpService.removeUsedBackupCode(verificationResult.usedBackupCodeIndex, backupCodes);
          await this.userRepo.updateUser(
            {
              totpBackupCodes: JSON.stringify(updatedCodes),
            },
            userId,
            workspaceId,
          );
        }
      }
    }

    return true;
  }

  async regenerateBackupCodes(
    userId: string,
    workspaceId: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.userRepo.findById(userId, workspaceId);
    
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (!user.totpEnabled) {
      throw new BadRequestException('TOTP is not enabled for this user');
    }

    const backupCodes = this.totpService.generateBackupCodes();
    const hashedBackupCodes = await this.totpService.hashBackupCodes(backupCodes);

    await this.userRepo.updateUser(
      {
        totpBackupCodes: JSON.stringify(hashedBackupCodes),
      },
      userId,
      workspaceId,
    );

    return { backupCodes };
  }
}
