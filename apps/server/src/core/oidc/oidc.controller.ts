import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OidcService } from './oidc.service';
import { CreateOidcProviderDto } from './dto/create-oidc-provider.dto';
import { UpdateOidcProviderDto } from './dto/update-oidc-provider.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../casl/interfaces/workspace-ability.type';
import { FastifyReply, FastifyRequest } from 'fastify';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { DomainService } from '../../integrations/environment/domain.service';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';

@Controller('oidc')
export class OidcController {
  private readonly logger = new Logger(OidcController.name);

  constructor(
    private readonly oidcService: OidcService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly environmentService: EnvironmentService,
    private readonly domainService: DomainService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('providers')
  async listProviders(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertManageSettings(user, workspace);
    return this.oidcService.listProviders(workspace.id);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Get('providers/public')
  async listPublicProviders(@AuthWorkspace() workspace: Workspace) {
    return this.oidcService.listPublicProviders(workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('providers')
  async createProvider(
    @Body() dto: CreateOidcProviderDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertManageSettings(user, workspace);
    return this.oidcService.createProvider(dto, workspace, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('providers/:id')
  async updateProvider(
    @Param('id') providerId: string,
    @Body() dto: UpdateOidcProviderDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertManageSettings(user, workspace);
    return this.oidcService.updateProvider(providerId, dto, workspace);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('providers/:id/enable')
  async enableProvider(
    @Param('id') providerId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertManageSettings(user, workspace);
    return this.oidcService.enableProvider(providerId, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('providers/:id/disable')
  async disableProvider(
    @Param('id') providerId: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertManageSettings(user, workspace);
    return this.oidcService.disableProvider(providerId, workspace.id);
  }

  @Public()
  @SkipTransform()
  @Get(':slug/start')
  async startLogin(
    @Param('slug') slug: string,
    @Query('redirect') redirect: string,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: false }) res: FastifyReply,
  ) {
    const url = await this.oidcService.buildAuthorizationUrl(
      workspace,
      slug,
      redirect,
    );

    res.redirect(url, 302);
  }

  @Public()
  @SkipTransform()
  @Get(':slug/callback')
  async handleCallback(
    @Param('slug') slug: string,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res({ passthrough: false }) res: FastifyReply,
  ) {
    try {
      const currentUrl = new URL(
        req.raw.url,
        this.domainService.getUrl(workspace.hostname),
      );
      const { authToken, redirectTo } = await this.oidcService.handleCallback(
        workspace,
        slug,
        currentUrl,
      );

      this.setAuthCookie(res, authToken);
      res.redirect(redirectTo, 302);
    } catch (err) {
      this.logger.error(
        `OIDC callback failed for workspace=${workspace.id} slug=${slug}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      res.redirect('/login?error=oidc_failed', 302);
    }
  }

  private assertManageSettings(user: User, workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
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
