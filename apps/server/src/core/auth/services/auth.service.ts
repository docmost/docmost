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
import { comparePasswordHash, hashPassword } from '../../../helpers';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { MailService } from '../../../integrations/mail/mail.service';
import ChangePasswordEmail from '@docmost/transactional/emails/change-password-email';

@Injectable()
export class AuthService {
  constructor(
    private signupService: SignupService,
    private tokenService: TokenService,
    private userRepo: UserRepo,
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
