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
import { comparePasswordHash, hashPassword } from '../../../common/helpers';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { MailService } from '../../../integrations/mail/mail.service';
import ChangePasswordEmail from '@docmost/transactional/emails/change-password-email';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { TemporaryCodeRepo } from '@docmost/db/repos/temporary-code/temporary-code.repo';
import { randomBytes } from 'crypto';
import ForgotPasswordEmail from '@docmost/transactional/emails/forgot-password-email';

@Injectable()
export class AuthService {
  constructor(
    private signupService: SignupService,
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private temporaryCodeRepo: TemporaryCodeRepo,
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
      forgotPasswordDto.code == null ||
      forgotPasswordDto.newPassword == null
    ) {
      // Generate 5-character temporary code
      const code = randomBytes(8).toString('hex').slice(0, 5).toUpperCase();
      const hashedCode = await hashPassword(code);
      await this.temporaryCodeRepo.insertTemporaryCode({
        code: hashedCode,
        user_id: user.id,
        workspace_id: user.workspaceId,
        expires_at: new Date(new Date().getTime() + 5 * 60 * 1000), // should expires in 5 minute
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

    // Get all temporary codes that are not expired
    const temporaryCodes = await this.temporaryCodeRepo.findByUserId(
      user.id,
      user.workspaceId,
    );
    // Limit to the last 3 codes, so we have a total time window of 15 minutes
    const validTemporaryCodes = temporaryCodes
      .filter((code) => code.expires_at > new Date() && code.used_at == null)
      .slice(0, 3);

    for (const code of validTemporaryCodes) {
      const validated = await comparePasswordHash(
        forgotPasswordDto.code,
        code.code,
      );
      if (validated) {
        // Update the used_at field to the current time
        await this.temporaryCodeRepo.updateTemporaryCode(
          {
            used_at: new Date(),
          },
          code.id,
        );

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
