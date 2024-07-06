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
import { FastifyReply, FastifyRequest } from 'fastify';
import { Issuer } from 'openid-client';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { z } from 'zod';
import { UserRole } from 'src/common/helpers/types/permission';
import { User } from '@docmost/db/types/entity.types';
import { repl } from '@nestjs/core';
import { WorkspaceService } from 'src/core/workspace/services/workspace.service';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { EnvironmentService } from 'src/integrations/environment/environment.service';

@Injectable()
export class AuthService {
  constructor(
    private signupService: SignupService,
    private tokenService: TokenService,
    private userRepo: UserRepo,
    private mailService: MailService,
    private workspaceRepo: WorkspaceRepo,
    private groupUserRepo: GroupUserRepo,
    private workspaceService: WorkspaceService,
    private environmentService: EnvironmentService,
  ) {}

  async oidcLogin(req: FastifyRequest) {
    const querySchema = z.object({
      code: z.string(),
      state: z.string(),
    });

    const { data: query } = querySchema.safeParse(req.query);

    if (!query) {
      throw new UnauthorizedException();
    }

    const workspace = await this.workspaceRepo.findById(query.state);

    if (
      !workspace ||
      !workspace.oidcIssuerUrl ||
      !workspace.oidcClientId ||
      !workspace.oidcClientSecret
    ) {
      throw new UnauthorizedException();
    }

    const issuer = await Issuer.discover(workspace.oidcIssuerUrl);
    const client = new issuer.Client({
      client_id: workspace.oidcClientId,
      client_secret: workspace.oidcClientSecret,
    });

    const redirectUri = `${this.environmentService.getAppUrl()}/api/auth/cb`;

    const params = client.callbackParams(req.raw);
    const tokenSet = await client.callback(redirectUri, params, {
      state: workspace.id,
    });

    const name = tokenSet.claims().name;
    const email = tokenSet.claims().email;

    if (!email) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepo.findByEmail(email, workspace.id);

    if (!user) {
      if (
        workspace.oidcJITEnabled &&
        workspace.oidcDomains.includes(email.split('@')[1])
      ) {
        const user = await this.userRepo.insertUser({
          name,
          email,
          role: UserRole.MEMBER,
          workspaceId: workspace.id,
          emailVerifiedAt: new Date(),
        });

        // TODO: This should really all happen in one function under the UserService
        await this.workspaceService.addUserToWorkspace(user.id, workspace.id);
        await this.groupUserRepo.addUserToDefaultGroup(user.id, workspace.id);

        return this.tokenService.generateAccessToken(user);
      }

      throw new UnauthorizedException();
    }

    return this.tokenService.generateAccessToken(user);
  }

  async login(loginDto: LoginDto, workspaceId: string): Promise<string> {
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

    return this.tokenService.generateAccessToken(user);
    return this.tokenService.generateAccessToken(user);
  }

  async register(createUserDto: CreateUserDto, workspaceId: string) {
    const user = await this.signupService.signup(createUserDto, workspaceId);

    return this.tokenService.generateAccessToken(user);
  }

  async setup(createAdminUserDto: CreateAdminUserDto) {
    const user = await this.signupService.initialSetup(createAdminUserDto);

    return this.tokenService.generateAccessToken(user);
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
