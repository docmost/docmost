import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SsoService } from './services/sso.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { FastifyReply, FastifyRequest } from 'fastify';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import {
  CreateSsoProviderDto,
  DeleteSsoProviderDto,
  GetSsoProviderDto,
  UpdateSsoProviderDto,
} from './dto/sso.dto';

@Controller('sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private ssoService: SsoService,
    private environmentService: EnvironmentService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('providers')
  async getProviders(@AuthWorkspace() workspace: Workspace) {
    const providers = await this.ssoService.getProviders(workspace.id);
    return { items: providers, limit: providers.length, page: 1 };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getProviderById(
    @Body() dto: GetSsoProviderDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.getProviderById(dto, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createProvider(
    @Body() dto: CreateSsoProviderDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.createProvider(dto, user, workspace);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateProvider(
    @Body() dto: UpdateSsoProviderDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.updateProvider(dto, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async deleteProvider(
    @Body() dto: DeleteSsoProviderDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.ssoService.deleteProvider(dto, workspace.id);
  }

  // OIDC Login: redirects user to OIDC provider
  @Get('oidc/:providerId/login')
  @HttpCode(HttpStatus.TEMPORARY_REDIRECT)
  async oidcLogin(
    @Param('providerId') providerId: string,
    @Res() reply: FastifyReply,
  ) {
    try {
      const loginUrl = await this.ssoService.getOidcLoginUrl(providerId);
      return reply.redirect(loginUrl);
    } catch (err) {
      this.logger.error('OIDC login error', err);
      return reply.redirect(
        `${this.environmentService.getAppUrl()}/login`,
      );
    }
  }

  // OIDC Callback: handles the OIDC provider response
  @Get('oidc/:providerId/callback')
  @HttpCode(HttpStatus.TEMPORARY_REDIRECT)
  async oidcCallback(
    @Param('providerId') providerId: string,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const appUrl = this.environmentService.getAppUrl();

    try {
      const authToken = await this.ssoService.handleOidcCallback(
        providerId,
        req.raw,
      );

      reply.setCookie('authToken', authToken, {
        httpOnly: true,
        path: '/',
        expires: this.environmentService.getCookieExpiresIn(),
        secure: this.environmentService.isHttps(),
      });

      return reply.redirect(`${appUrl}/home`);
    } catch (err) {
      this.logger.error('OIDC callback error', err);
      return reply.redirect(`${appUrl}/login?error=oidc_failed`);
    }
  }
}
