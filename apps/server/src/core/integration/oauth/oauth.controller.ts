import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { addMinutes } from 'date-fns';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { RequireSessionAuth } from '../../../common/decorators/require-session-auth.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { OAuthService } from './oauth.service';
import {
  OAuthAuthorizeDto,
  OAuthDisconnectDto,
  OAuthInstallDto,
} from '../dto/integration.dto';
import { IntegrationConnectionService } from '../integration-connection.service';
import { IntegrationRegistry } from '../registry/integration-registry';
import WorkspaceAbilityFactory from '../../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../casl/interfaces/workspace-ability.type';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service';
import {
  IdentityEmailMismatchError,
  IdentityTenantMismatchError,
  IntegrationTenantInUseError,
} from '../registry/integration-provider.interface';
import {
  EncryptionPurpose,
  EncryptionService,
} from '../../../integrations/encryption/encryption.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { COMPLETION_FALLBACK_REDIRECT, nonceCookieName } from './oauth.utils';
import { OAuthCompleteAuthFilter } from './oauth-complete-auth.filter';

const OAUTH_ROUTE_PREFIX = '/api/integrations/oauth';
const COMPLETION_TICKET_PURPOSE = 'oauth-completion';
const COMPLETION_TICKET_TTL_MS = 60_000;

type CompletionTicket = {
  purpose: typeof COMPLETION_TICKET_PURPOSE;
  state: string;
  code: string;
  exp: number;
};

@Controller('integrations/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly connectionService: IntegrationConnectionService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly licenseCheckService: LicenseCheckService,
    private readonly registry: IntegrationRegistry,
    private readonly encryptionService: EncryptionService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @RequireSessionAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('authorize')
  async authorize(
    @Body() dto: OAuthAuthorizeDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { authorizationUrl, type, nonce } =
      await this.oauthService.getAuthorizationUrl(
        dto.integrationId,
        workspace.id,
        user.id,
        dto.returnPath,
      );

    this.setNonceCookie(res, type, nonce);
    return { authorizationUrl };
  }

  @RequireSessionAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('install')
  async installAndAuthorize(
    @Body() dto: OAuthInstallDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }

    const requiredFeature =
      this.registry.getProvider(dto.type)?.definition.requiresFeature;
    if (
      requiredFeature &&
      !this.licenseCheckService.hasFeature(
        workspace.licenseKey,
        requiredFeature,
        workspace.plan,
      )
    ) {
      throw new ForbiddenException('This feature requires a valid license');
    }

    const { authorizationUrl, nonce } =
      await this.oauthService.getInstallAuthorizationUrl(
        dto.type,
        workspace.id,
        user.id,
      );

    this.setNonceCookie(res, dto.type, nonce);
    return { authorizationUrl };
  }

  @Get(':type/callback')
  async callback(
    @Param('type') type: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: FastifyReply,
    @Query('error') providerError?: string,
    @Query('error_description') providerErrorDescription?: string,
  ) {
    if (!state) {
      throw new BadRequestException('Missing state parameter');
    }

    const statePayload = this.oauthService.verifySignedState(state);
    if (!statePayload) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    // Built server-side and signed into the state, never user input.
    const returnUrl = statePayload.returnUrl;
    const returnPath = statePayload.returnPath;

    // No code means the provider refused or the user cancelled.
    if (!code) {
      const errorCode = /^[a-z_]{1,40}$/.test(providerError ?? '')
        ? providerError
        : 'none';
      const reason =
        typeof providerErrorDescription === 'string'
          ? providerErrorDescription
              .split(/[\r\n]/)[0]
              .replace(/[^\x20-\x7e]/g, '')
              .slice(0, 200)
          : '';
      this.logger.warn(
        `OAuth callback for ${statePayload.type} returned no code: error=${errorCode}${reason ? ` ${reason}` : ''}`,
      );
      return res.redirect(`${returnUrl}${returnPath}?error=oauth_failed`, 302);
    }

    if (statePayload.type !== type) {
      this.logger.error(
        `OAuth callback error for ${type}: OAuth state does not match this provider`,
      );
      return res.redirect(`${returnUrl}${returnPath}?error=oauth_failed`, 302);
    }

    // A customDomain is tenant-controlled DNS, so the ticket only goes to hosts Docmost serves.
    let returnHost: string | undefined;
    try {
      returnHost = new URL(returnUrl).host;
    } catch {
      returnHost = undefined;
    }
    const subdomainHost = this.environmentService.getSubdomainHost();
    const isDocmostHost =
      returnHost === new URL(this.environmentService.getAppUrl()).host ||
      (this.environmentService.isCloud() &&
        !!subdomainHost &&
        !!returnHost?.endsWith(`.${subdomainHost}`));

    if (!isDocmostHost) {
      this.logger.warn(
        `OAuth callback refused for ${type}: ${returnUrl} is not a Docmost host`,
      );
      return res.redirect(`${returnUrl}${returnPath}?error=oauth_failed`, 302);
    }

    // The code is redeemed on the workspace host, where the session and nonce cookie prove who started the flow.
    const ticket = this.encryptionService.encrypt(
      JSON.stringify({
        purpose: COMPLETION_TICKET_PURPOSE,
        state,
        code,
        exp: Date.now() + COMPLETION_TICKET_TTL_MS,
      } satisfies CompletionTicket),
      EncryptionPurpose.OAUTH_COMPLETION,
    );

    return res.redirect(
      `${returnUrl}${OAUTH_ROUTE_PREFIX}/complete?ticket=${encodeURIComponent(ticket)}`,
      302,
    );
  }

  @RequireSessionAuth()
  @UseGuards(JwtAuthGuard)
  @UseFilters(OAuthCompleteAuthFilter)
  @Get('complete')
  async complete(
    @Query('ticket') ticket: string,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    let completion: Partial<CompletionTicket> | null;
    try {
      completion = JSON.parse(
        this.encryptionService.decrypt(ticket, EncryptionPurpose.OAUTH_COMPLETION),
      );
    } catch {
      completion = null;
    }

    const { purpose, state, code, exp } = completion ?? {};
    const statePayload =
      purpose === COMPLETION_TICKET_PURPOSE &&
      typeof state === 'string' &&
      typeof code === 'string' &&
      typeof exp === 'number' &&
      exp >= Date.now()
        ? this.oauthService.verifySignedState(state)
        : null;

    if (!statePayload) {
      this.logger.warn('OAuth completion refused: invalid or expired ticket');
      return res.redirect(COMPLETION_FALLBACK_REDIRECT, 302);
    }

    const returnPath = statePayload.returnPath;
    const cookieName = nonceCookieName(statePayload.type);
    const cookieBuf = Buffer.from(req.cookies?.[cookieName] ?? '');
    const nonceBuf = Buffer.from(statePayload.nonce ?? '');
    const nonceMatches =
      nonceBuf.length > 0 &&
      cookieBuf.length === nonceBuf.length &&
      crypto.timingSafeEqual(cookieBuf, nonceBuf);

    if (
      statePayload.userId !== user.id ||
      statePayload.workspaceId !== workspace.id ||
      !nonceMatches
    ) {
      this.logger.warn(
        `OAuth completion refused for ${statePayload.type}: the session did not start this flow`,
      );
      return res.redirect(`${returnPath}?error=oauth_failed`, 302);
    }

    res.clearCookie(cookieName, { path: OAUTH_ROUTE_PREFIX });

    try {
      await this.oauthService.exchangeCodeForTokens(
        statePayload.type,
        code,
        statePayload,
      );

      return res.redirect(returnPath, 302);
    } catch (err) {
      this.logger.error(
        `OAuth completion error for ${statePayload.type}: ${(err as Error).message}`,
      );
      let errorCode = 'oauth_failed';
      if (err instanceof IdentityTenantMismatchError) {
        errorCode = 'tenant_mismatch';
      } else if (err instanceof IdentityEmailMismatchError) {
        errorCode = 'identity_mismatch';
      } else if (err instanceof IntegrationTenantInUseError) {
        errorCode = 'tenant_in_use';
      }
      return res.redirect(`${returnPath}?error=${errorCode}`, 302);
    }
  }

  @RequireSessionAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('disconnect')
  async disconnect(
    @Body() dto: OAuthDisconnectDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.connectionService.disconnect(
      dto.integrationId,
      user.id,
      workspace.id,
    );
    return { success: true };
  }

  private setNonceCookie(res: FastifyReply, type: string, nonce: string) {
    res.setCookie(nonceCookieName(type), nonce, {
      httpOnly: true,
      path: OAUTH_ROUTE_PREFIX,
      secure: this.environmentService.isHttps(),
      sameSite: 'lax',
      expires: addMinutes(new Date(), 10),
    });
  }
}
