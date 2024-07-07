import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './services/auth.service';
import { SetupGuard } from './guards/setup.guard';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Issuer } from 'openid-client';
import { AppRequest } from 'src/common/helpers/types/request';
import { UserRole } from 'src/common/helpers/types/permission';
import { UpdateOidcConfigDto } from './dto/update-oidc.dto';
import { OidcConfigDto } from './dto/oidc-config.dto';
import { UpdateDomainsDto } from './dto/update-domains.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private environmentService: EnvironmentService,
  ) {}

  @Get('cb')
  @HttpCode(HttpStatus.TEMPORARY_REDIRECT)
  async callback(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const token = await this.authService.oidcLogin(req);

    this.setCookieOnReply(reply, token);

    return reply.redirect(`${this.environmentService.getAppUrl()}/home`);
  }

  @Get('oauth-redirect')
  @HttpCode(HttpStatus.TEMPORARY_REDIRECT)
  async oauthRedirect(
    @AuthWorkspace() workspace: Workspace,
    @Res() reply: FastifyReply,
  ) {
    const redirectUri = `${this.environmentService.getAppUrl()}/api/auth/cb`;

    if (!workspace.oidcIssuerUrl) {
      return reply.redirect(`${this.environmentService.getAppUrl()}/login`);
    }

    const issuer = await Issuer.discover(workspace.oidcIssuerUrl);

    if (!issuer.metadata.authorization_endpoint || !workspace.oidcClientId) {
      return reply.redirect(`${this.environmentService.getAppUrl()}/login`);
    }

    const authRedirect =
      `${issuer.metadata.authorization_endpoint}` +
      `?response_type=code` +
      `&client_id=${workspace.oidcClientId}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=openid profile email` +
      `&state=${workspace.id}`;

    return reply.redirect(authRedirect);
  }

  @Get('oidc-public-config')
  @HttpCode(HttpStatus.OK)
  async oidcPublicConfig(@AuthWorkspace() workspace: Workspace) {
    return {
      enabled: workspace.oidcEnabled,
      buttonName: workspace.oidcButtonName,
    };
  }

  @Get('oidc-config')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async oauthConfig(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<OidcConfigDto> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
      throw new UnauthorizedException();
    }

    return {
      enabled: workspace.oidcEnabled,
      issuerUrl: workspace.oidcIssuerUrl,
      clientId: workspace.oidcClientId,
      buttonName: workspace.oidcButtonName,
      jitEnabled: workspace.oidcJitEnabled,
    };
  }

  @Patch('oidc-config')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async updateOidcConfig(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: UpdateOidcConfigDto,
  ): Promise<OidcConfigDto> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
      throw new UnauthorizedException();
    }

    return this.authService.updateOidcConfig(dto, workspace.id);
  }

  @Get('approved-domains')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getApprovedDomains(@AuthWorkspace() workspace: Workspace) {
    return { domains: workspace.approvedDomains };
  }

  @Patch('approved-domains')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async updateApprovedDomains(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() dto: UpdateDomainsDto,
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
      throw new UnauthorizedException();
    }

    const domains = await this.authService.updateApprovedDomains(
      dto.domains,
      workspace.id,
    );

    return { domains };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Req() req: AppRequest,
    @Res() reply: FastifyReply,
    @Body() loginInput: LoginDto,
  ) {
    const token = await this.authService.login(loginInput, req.raw.workspaceId);

    this.setCookieOnReply(reply, token);

    return reply.send();
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res() reply: FastifyReply) {
    reply.clearCookie('token');
    return reply.send();
  }

  /* @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(@Req() req, @Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto, req.raw.workspaceId);
  }
  */

  @UseGuards(SetupGuard)
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async setupWorkspace(
    @Req() req,
    @Body() createAdminUserDto: CreateAdminUserDto,
  ) {
    if (this.environmentService.isCloud()) throw new NotFoundException();
    return this.authService.setup(createAdminUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.changePassword(dto, user.id, workspace.id);
  }

  private setCookieOnReply(reply: FastifyReply, token: string) {
    reply.setCookie('token', token, {
      httpOnly: true,
      path: '/',
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      secure: this.environmentService.getNodeEnv() === 'production',
    });
  }
}
