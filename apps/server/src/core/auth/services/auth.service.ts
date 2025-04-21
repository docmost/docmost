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
import { User, UserToken, Workspace } from '@docmost/db/types/entity.types';
import { UserTokenType } from '../auth.constants';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { executeTx } from '@docmost/db/utils';
import { VerifyUserTokenDto } from '../dto/verify-user-token.dto';
import { DomainService } from '../../../integrations/environment/domain.service';
import {
  type AuthenticationResponseJSON,
    generateAuthenticationOptions,
    GenerateAuthenticationOptionsOpts,
    generateRegistrationOptions,
    GenerateRegistrationOptionsOpts,
    type RegistrationResponseJSON,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
  } from '@simplewebauthn/server';

import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { UserPasskeyRepo } from '@docmost/db/repos/user-passkey/user-passkey.repo';
import { PasskeyLoginDto } from '../dto/passkey-login.dto';
import { EnvironmentService } from '../../../integrations/environment/environment.service';

@Injectable()
export class AuthService {
  constructor(
    private signupService: SignupService,
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private userTokenRepo: UserTokenRepo,
    private userPasskeyRepo: UserPasskeyRepo,
    private mailService: MailService,
    private domainService: DomainService,
    private environmentService: EnvironmentService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

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

  async registerChallenge(user: User, workspace: Workspace) {
    const passkeyList = await this.userPasskeyRepo.findByUserId(user.id);

    if (passkeyList.length) {
      throw new BadRequestException('Passkey already exists');
    }

    const opts: GenerateRegistrationOptionsOpts = {
      rpName: 'docmost',
      rpID: this.environmentService.getClientHost(),
      userID: isoUint8Array.fromUTF8String(user.id),
      userName: user.email,
      userDisplayName: user.email,
      timeout: 60000,
    };

    return await generateRegistrationOptions(opts);
  }

  async verifyPasskeyChallenge(
    challenge: string,
    dto: RegistrationResponseJSON,
    user: User,
    workspace: Workspace,
  ) {
    const verification = await verifyRegistrationResponse({
      expectedChallenge: challenge,
      response: dto,
      expectedOrigin: this.environmentService.getClientURL(),
      expectedRPID: this.environmentService.getClientHost(),
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException(
        'Passkey registration failed because the verification response is invalid',
      );
    }

    const registrationInfo = verification.registrationInfo;
    const publicKey = Buffer.from(
      registrationInfo.credential.publicKey,
    ).toString('base64url');
    const credentialId = registrationInfo.credential.id;

    await this.userPasskeyRepo.insertPasskey({
      userId: user.id,
      credentialId,
      publicKey
    });

    return {
      verified: true,
      message: 'Successfully registered passkey',
    };
  }

  async initiatePasskeyAuthentication(
    loginDto: PasskeyLoginDto,
    workspaceId: string,
  ) {
    const user = await this.userRepo.findByEmail(
      loginDto.email,
      workspaceId
    );

    if (!user) {
      throw new UnauthorizedException('email or passkey does not match');
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: this.environmentService.getClientHost(),
      userVerification: 'preferred',
      timeout: 60000,
    };

    return await generateAuthenticationOptions(opts);
  }

  async authenticateWithPasskey(
    loginDto: AuthenticationResponseJSON,
    email: string,
    workspaceId: string,
    expectedChallenge: string,
  ) {
    const user = await this.userRepo.findByEmail(email, workspaceId);

    const passkeyList = await this.userPasskeyRepo.findByUserId(user.id);

    if (!passkeyList || passkeyList.length == 0 || passkeyList.length > 1) {
      throw new UnauthorizedException('email or passkey does not match');
    }

    const passkey = passkeyList[0];

    const authVerify = await verifyAuthenticationResponse({
      response: loginDto,
      expectedChallenge: expectedChallenge,
      expectedOrigin: this.environmentService.getClientURL(),
      expectedRPID: this.environmentService.getClientHost(),
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64')),
        counter: 0
      },
      requireUserVerification: false,
    });

    if (!authVerify.verified) {
      throw new UnauthorizedException('email or passkey does not match');
    }

    user.lastLoginAt = new Date();
    await this.userRepo.updateLastLogin(user.id, workspaceId);

    return this.tokenService.generateAccessToken(user);
  }

  async removePasskey(user: User) {
    return this.userPasskeyRepo.removePasskey(user);
  }

}
