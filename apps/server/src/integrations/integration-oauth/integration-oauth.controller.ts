import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../environment/environment.service';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';

interface IntegrationListItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  scopes: string[];
  connected: boolean;
  needsReconnect: boolean;
  connectedAt?: string;
  expiresAt?: string;
}

// Mounts under the app's global `/api` prefix → `/api/integrations/oauth/*`.
@Controller('integrations/oauth')
@UseGuards(JwtAuthGuard)
export class IntegrationOAuthController {
  private readonly logger = new Logger(IntegrationOAuthController.name);

  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly oauthService: IntegrationOAuthService,
    private readonly tokenRepo: IntegrationOAuthTokenRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  /** GET /api/integrations/oauth — list manifests + per-user connection state. */
  @Get()
  async list(@AuthUser() user: User): Promise<IntegrationListItem[]> {
    const tokens = await this.tokenRepo.listByUser(user.id);
    const tokensByIntegration = new Map(tokens.map((t) => [t.integrationId, t]));
    return this.registry.list().map((m) => {
      const t = tokensByIntegration.get(m.id);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        icon: m.icon,
        scopes: m.scopes,
        connected: !!t,
        needsReconnect: t?.needsReconnect ?? false,
        connectedAt: t?.createdAt instanceof Date ? t.createdAt.toISOString() : undefined,
        expiresAt: t?.expiresAt instanceof Date ? t.expiresAt.toISOString() : undefined,
      };
    });
  }

  /** GET /api/integrations/oauth/:integrationId/authorize — start the flow. */
  @Get(':integrationId/authorize')
  async authorize(
    @AuthUser() user: User,
    @Param('integrationId') integrationId: string,
    @Query('returnTo') returnTo: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!this.registry.get(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    // Only accept relative paths for returnTo to avoid open-redirect.
    const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : undefined;
    const { url } = await this.oauthService.startAuthorize({
      integrationId,
      userId: user.id,
      returnTo: safeReturnTo,
    });
    reply.redirect(url);
  }

  /** GET /api/integrations/oauth/:integrationId/callback — finish the flow. */
  @Get(':integrationId/callback')
  async callback(
    @Param('integrationId') integrationId: string,
    @Query('code') code: string,
    @Query('state') stateToken: string,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!this.registry.get(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    if (error) {
      // Provider denied or errored — bounce back to settings with the reason.
      const reason = encodeURIComponent(errorDescription ?? error);
      reply.redirect(
        `${this.environmentService.getAppUrl()}/settings/integrations/${integrationId}?error=${reason}`,
      );
      return;
    }
    if (!code || !stateToken) {
      throw new BadRequestException('Missing code or state');
    }
    try {
      const { returnTo } = await this.oauthService.completeCallback({
        integrationId,
        code,
        stateToken,
      });
      const dest =
        returnTo ?? `/settings/integrations/${integrationId}?connected=true`;
      reply.redirect(`${this.environmentService.getAppUrl()}${dest}`);
    } catch (err) {
      this.logger.warn(
        `OAuth callback failed for integration=${integrationId}: ${(err as Error).message}`,
      );
      reply.redirect(
        `${this.environmentService.getAppUrl()}/settings/integrations/${integrationId}?error=callback_failed`,
      );
    }
  }

  /** DELETE /api/integrations/oauth/:integrationId/connection — disconnect. */
  @Delete(':integrationId/connection')
  async disconnect(
    @AuthUser() user: User,
    @Param('integrationId') integrationId: string,
  ): Promise<{ disconnected: boolean }> {
    if (!this.registry.get(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    await this.oauthService.disconnect(user.id, integrationId);
    return { disconnected: true };
  }
}
