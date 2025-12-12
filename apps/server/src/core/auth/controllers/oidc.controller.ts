import { Controller, Get, Post, Query, Body, Res, HttpCode, HttpStatus, BadRequestException, Req, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { OidcService, OidcAuthSession } from '../services/oidc.service';
import { OidcConfigService } from '../services/oidc-config.service';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import Redis from 'ioredis';

const OIDC_SESSION_TTL_SECONDS = 300;
const OIDC_SESSION_PREFIX = 'oidc:session:';

const inMemoryStore = new Map<string, OidcAuthSession>();

setInterval(() => {
  const now = Date.now();
  for (const [state, session] of inMemoryStore.entries()) {
    if (now - session.timestamp > OIDC_SESSION_TTL_SECONDS * 1000) {
      inMemoryStore.delete(state);
    }
  }
}, 60_000);

@Controller('auth/oidc')
export class OidcController implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OidcController.name);
  private readonly allowedOrigins: string[];
  private redis: Redis | null = null;

  constructor(
    private readonly oidcService: OidcService,
    private readonly oidcConfigService: OidcConfigService,
    private readonly environmentService: EnvironmentService,
  ) {
    this.allowedOrigins = [this.environmentService.getAppUrl()];
  }

  async onModuleInit() {
    try {
      const redisUrl = this.environmentService.getRedisUrl();
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
        await this.redis.connect();
      }
    } catch (error) {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private async storeSession(state: string, session: OidcAuthSession): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.setex(
          `${OIDC_SESSION_PREFIX}${state}`,
          OIDC_SESSION_TTL_SECONDS,
          JSON.stringify(session),
        );
        return;
      } catch (error) {
        this.logger.warn('Redis write failed, using in-memory fallback');
      }
    }
    inMemoryStore.set(state, session);
  }

  private async getAndDeleteSession(state: string): Promise<OidcAuthSession | null> {
    if (this.redis) {
      try {
        const key = `${OIDC_SESSION_PREFIX}${state}`;
        const data = await this.redis.get(key);
        if (data) {
          await this.redis.del(key);
          return JSON.parse(data) as OidcAuthSession;
        }
      } catch (error) {
        this.logger.warn('Redis read failed, checking in-memory fallback');
      }
    }
    const session = inMemoryStore.get(state);
    if (session) {
      inMemoryStore.delete(state);
      if (Date.now() - session.timestamp > OIDC_SESSION_TTL_SECONDS * 1000) {
        return null;
      }
      return session;
    }
    return null;
  }

  private validateRedirectUri(redirectUri: string): boolean {
    try {
      const url = new URL(redirectUri);
      return this.allowedOrigins.some(origin => redirectUri.startsWith(origin));
    } catch {
      return false;
    }
  }

  @Get('authorize')
  async authorize(
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const redirectUri = `${this.environmentService.getAppUrl()}/auth/oidc/callback`;

    if (!this.validateRedirectUri(redirectUri)) {
      throw new BadRequestException('Invalid redirect URI');
    }

    const { url, state, codeVerifier, nonce, expectedIssuer } =
      await this.oidcService.getAuthorizationUrl(workspace.id, redirectUri);

    const session: OidcAuthSession = {
      workspaceId: workspace.id,
      codeVerifier,
      nonce,
      expectedIssuer,
      timestamp: Date.now(),
    };

    await this.storeSession(state, session);

    return { url };
  }

  @Post('callback')
  async callback(
    @AuthWorkspace() workspace: Workspace,
    @Body('code') code: string,
    @Body('state') state: string,
    @Body('iss') iss: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing required parameters');
    }

    if (code.length < 10 || code.length > 2048) {
      throw new BadRequestException('Invalid request');
    }

    if (state.length < 20 || state.length > 512) {
      throw new BadRequestException('Invalid request');
    }

    const session = await this.getAndDeleteSession(state);
    if (!session) {
      this.logger.warn('OIDC callback with invalid or expired state');
      throw new BadRequestException('Invalid or expired session');
    }

    if (session.workspaceId !== workspace.id) {
      this.logger.warn('OIDC callback workspace mismatch');
      throw new BadRequestException('Invalid session');
    }

    try {
      const redirectUri = `${this.environmentService.getAppUrl()}/auth/oidc/callback`;

      if (!this.validateRedirectUri(redirectUri)) {
        throw new BadRequestException('Invalid redirect URI');
      }

      const { token } = await this.oidcService.handleCallback(
        workspace.id,
        code,
        state,
        iss,
        redirectUri,
        session.codeVerifier,
        session.nonce,
        session.expectedIssuer,
      );

      this.setAuthCookie(res, token);

      return { success: true };
    } catch (error) {
      this.logger.error('OIDC callback error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  @Get('config')
  async getConfig(@AuthWorkspace() workspace: Workspace) {
    return {
      buttonText: this.oidcConfigService.getOidcButtonText(),
      autoRedirect: this.oidcConfigService.getOidcAutoRedirect(),
    };
  }

  private setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
      sameSite: 'lax',
    });
  }
}
