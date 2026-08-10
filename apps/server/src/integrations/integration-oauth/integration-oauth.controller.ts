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
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../environment/environment.service';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';
import { IntegrationOAuthConnectionService } from './integration-oauth-connection.service';
import {
  PublicIntegrationResourceManifest,
  toPublicResourceManifest,
} from './resource.types';

/**
 * Explicit 302 + Location + send. NestJS+Fastify's `reply.redirect(url)`
 * alone gets ignored in some configurations (the response goes out as a 200
 * with empty body instead) — being explicit avoids the framework guessing.
 */
function sendRedirect(reply: FastifyReply, url: string): void {
  reply.code(302).header('location', url).send();
}

interface IntegrationListItem {
  id: string;
  providerId: string;
  name: string;
  description?: string;
  icon?: string;
  /** Connection base URL — lets the editor match pasted provider links. */
  baseUrl: string;
  scopes: string[];
  connected: boolean;
  needsReconnect: boolean;
  connectedAt?: string;
  expiresAt?: string;
  resources: PublicIntegrationResourceManifest[];
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
    private readonly connectionService: IntegrationOAuthConnectionService,
    private readonly environmentService: EnvironmentService,
  ) {}

  /** Manifests + per-user connection state for the settings UI. */
  @Get()
  async list(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<IntegrationListItem[]> {
    const tokens = await this.tokenRepo.listByUserWorkspace(
      user.id,
      workspace.id,
    );
    const configured = await this.connectionService.listConfigured(
      workspace.id,
    );
    const tokensByIntegration = new Map(
      tokens.map((t) => [t.integrationId, t]),
    );
    return [...configured.values()].map((connection) => {
      const manifest = this.registry.require(connection.providerId);
      const token = tokensByIntegration.get(connection.integrationId);
      return {
        id: connection.integrationId,
        providerId: connection.providerId,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        baseUrl: connection.baseUrl,
        scopes: manifest.scopes,
        connected: !!token,
        needsReconnect: token?.needsReconnect ?? false,
        connectedAt:
          token?.createdAt instanceof Date
            ? token.createdAt.toISOString()
            : undefined,
        expiresAt:
          token?.expiresAt instanceof Date
            ? token.expiresAt.toISOString()
            : undefined,
        resources: (manifest.resources ?? []).map(toPublicResourceManifest),
      };
    });
  }

  /** Starts the OAuth flow. */
  @Get(':integrationId/authorize')
  async authorize(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('integrationId') integrationId: string,
    @Query('returnTo') returnTo: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!this.registry.getForIntegrationId(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    // Relative paths only — guards against open-redirect via returnTo.
    const safeReturnTo =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : undefined;
    const { url } = await this.oauthService.startAuthorize({
      integrationId,
      workspaceId: workspace.id,
      userId: user.id,
      returnTo: safeReturnTo,
    });
    sendRedirect(reply, url);
  }

  /** Provider redirects here after the user approves or denies. */
  @Get(':integrationId/callback')
  async callback(
    @Param('integrationId') integrationId: string,
    @Query('code') code: string,
    @Query('state') stateToken: string,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!this.registry.getForIntegrationId(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    const settingsUrl = `${this.environmentService.getAppUrl()}/settings/account/integrations`;
    if (error) {
      const reason = encodeURIComponent(errorDescription ?? error);
      sendRedirect(
        reply,
        `${settingsUrl}?error=${reason}&integration=${integrationId}`,
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
      const dest = returnTo
        ? `${this.environmentService.getAppUrl()}${returnTo}`
        : `${settingsUrl}?connected=true&integration=${integrationId}`;
      sendRedirect(reply, dest);
    } catch (err) {
      this.logger.warn(
        `OAuth callback failed for integration=${integrationId}: ${(err as Error).message}`,
      );
      sendRedirect(
        reply,
        `${settingsUrl}?error=callback_failed&integration=${integrationId}`,
      );
    }
  }

  /** Revoke the user's workspace-scoped connection — deletes the token row. */
  @Delete(':integrationId/connection')
  async disconnect(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Param('integrationId') integrationId: string,
  ): Promise<{ disconnected: boolean }> {
    if (!this.registry.getForIntegrationId(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    await this.oauthService.disconnect(user.id, workspace.id, integrationId);
    return { disconnected: true };
  }
}
