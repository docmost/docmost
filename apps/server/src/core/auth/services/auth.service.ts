import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { TokenService } from './token.service';
import { TokensDto } from '../dto/tokens.dto';
import { SignupService } from './signup.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { comparePasswordHash, hashPassword, nanoIdGen } from '../../../common/helpers';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { MailService } from '../../../integrations/mail/mail.service';
import ChangePasswordEmail from '@docmost/transactional/emails/change-password-email';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import ForgotPasswordEmail from '@docmost/transactional/emails/forgot-password-email';
import { UserTokensRepo } from '@docmost/db/repos/user-tokens/user-tokens.repo';

@Injectable()
export class AuthService {
  constructor(
    private signupService: SignupService,
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private userTokensRepo: UserTokensRepo,
    private mailService: MailService,
  ) {}

  async login(loginDto: LoginDto, workspaceId: string) {
    const user = await this.userRepo.findByEmail(
      loginDto.email,
      workspaceId,
      true,
    );

    if (
      !user ||
      !(await comparePasswordHash(loginDto.password, user.password))
    ) {
      throw new UnauthorizedException('email or password does not match');
    }

    user.lastLoginAt = new Date();
    await this.userRepo.updateLastLogin(user.id, workspaceId);

    const tokens: TokensDto = await this.tokenService.generateTokens(user);
    return { tokens };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
    workspaceId: string,
  ) {
    const user = await this.userRepo.findByEmail(
      forgotPasswordDto.email,
      workspaceId,
      true,
    );
    if (!user) {
      return;
    }

    if (
      forgotPasswordDto.token == null ||
      forgotPasswordDto.newPassword == null
    ) {
      // Generate 5-character user token
      const code = nanoIdGen(5).toUpperCase();
      const hashedToken = await hashPassword(code);
      await this.userTokensRepo.insertUserToken({
        token: hashedToken,
        user_id: user.id,
        workspace_id: user.workspaceId,
        expires_at: new Date(new Date().getTime() + 3_600_000), // should expires in 1 hour
        type: "forgot-password",
      });

      const emailTemplate = ForgotPasswordEmail({
        username: user.name,
        code: code,
      });
      await this.mailService.sendToQueue({
        to: user.email,
        subject: 'Reset your password',
        template: emailTemplate,
      });

      return;
    }

    // Get all user tokens that are not expired
    const userTokens = await this.userTokensRepo.findByUserId(
      user.id,
      user.workspaceId,
      "forgot-password"
    );
    // Limit to the last 3 token, so we have a total time window of 15 minutes
    const validUserTokens = userTokens
      .filter((token) => token.expires_at > new Date() && token.used_at == null)
      .slice(0, 3);

    for (const token of validUserTokens) {
      const validated = await comparePasswordHash(
        forgotPasswordDto.token,
        token.token,
      );
      if (validated) {
        await Promise.all([
          this.userTokensRepo.deleteUserToken(user.id, user.workspaceId, "forgot-password"),
          this.userTokensRepo.deleteExpiredUserTokens(),
        ]);

        const newPasswordHash = await hashPassword(
          forgotPasswordDto.newPassword,
        );
        await this.userRepo.updateUser(
          {
            password: newPasswordHash,
          },
          user.id,
          workspaceId,
        );

        const emailTemplate = ChangePasswordEmail({ username: user.name });
        await this.mailService.sendToQueue({
          to: user.email,
          subject: 'Your password has been changed',
          template: emailTemplate,
        });

        return;
      }
    }

    throw new BadRequestException('Incorrect code');
  }

  async register(createUserDto: CreateUserDto, workspaceId: string) {
    const user = await this.signupService.signup(createUserDto, workspaceId);

    const tokens: TokensDto = await this.tokenService.generateTokens(user);

    return { tokens };
  }

  async setup(createAdminUserDto: CreateAdminUserDto) {
    const user = await this.signupService.initialSetup(createAdminUserDto);

    const tokens: TokensDto = await this.tokenService.generateTokens(user);

    return { tokens };
  }

  async changePassword(
    dto: ChangePasswordDto,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includePassword: true,
    });

    if (!user) {
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
}
