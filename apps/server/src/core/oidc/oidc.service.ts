import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import {
  AuthProvider,
  User,
  Workspace,
} from '@docmost/db/types/entity.types';
import { OidcProviderRepo } from '@docmost/db/repos/oidc/oidc-provider.repo';
import { OidcAccountRepo } from '@docmost/db/repos/oidc/oidc-account.repo';
import { CreateOidcProviderDto } from './dto/create-oidc-provider.dto';
import { UpdateOidcProviderDto } from './dto/update-oidc-provider.dto';
import { DomainService } from '../../integrations/environment/domain.service';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { executeTx } from '@docmost/db/utils';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { SessionService } from '../session/session.service';
import { nanoIdGen, isUserDisabled } from '../../common/helpers';
import { validateAllowedEmail } from '../auth/auth.util';
import { OidcProviderService } from './providers/oidc-provider.service';
import { UserRole } from '../../common/helpers/types/permission';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

type OidcStatePayload = {
  providerId: string;
  codeVerifier: string;
  expectedState: string;
  redirectTo: string;
};

type OidcUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

@Injectable()
export class OidcService {
  private readonly redis: Redis;

  constructor(
    private readonly oidcProviderRepo: OidcProviderRepo,
    private readonly oidcAccountRepo: OidcAccountRepo,
    private readonly oidcProviderService: OidcProviderService,
    private readonly userRepo: UserRepo,
    private readonly groupUserRepo: GroupUserRepo,
    private readonly sessionService: SessionService,
    private readonly domainService: DomainService,
    private readonly environmentService: EnvironmentService,
    private readonly redisService: RedisService,
    @InjectKysely() private readonly db: KyselyDB,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {
    this.redis = this.redisService.getOrThrow();
  }

  async listProviders(workspaceId: string) {
    const providers = await this.oidcProviderRepo.listByWorkspace(workspaceId);
    return providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      type: provider.type,
      oidcIssuer: provider.oidcIssuer,
      oidcClientId: provider.oidcClientId,
      oidcRedirectUri: provider.oidcRedirectUri,
      domains: provider.domains ?? [],
      autoJoinByEmail: provider.autoJoinByEmail,
      autoCreateUsers: provider.autoCreateUsers,
      isEnabled: provider.isEnabled,
      hasClientSecret: !!provider.oidcClientSecret,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    }));
  }

  async listPublicProviders(workspaceId: string) {
    return this.oidcProviderRepo.listEnabledPublicByWorkspace(workspaceId);
  }

  async createProvider(
    dto: CreateOidcProviderDto,
    workspace: Workspace,
    creatorId: string,
  ) {
    const slug = this.normalizeSlug(dto.slug);
    const provider = await this.oidcProviderRepo.insertProvider({
      workspaceId: workspace.id,
      creatorId,
      slug,
      name: dto.name.trim(),
      type: 'oidc',
      oidcIssuer: this.normalizeIssuer(dto.oidcIssuer),
      oidcClientId: dto.oidcClientId.trim(),
      oidcClientSecret: dto.oidcClientSecret.trim(),
      oidcRedirectUri: this.getRedirectUri(workspace, slug),
      scopes: ['openid', 'email', 'profile'],
      domains: this.normalizeDomains(dto.domains),
      autoJoinByEmail: dto.autoJoinByEmail ?? true,
      autoCreateUsers: dto.autoCreateUsers ?? false,
      isEnabled: false,
    });

    return this.toAdminProvider(provider);
  }

  async updateProvider(
    providerId: string,
    dto: UpdateOidcProviderDto,
    workspace: Workspace,
  ) {
    const provider = await this.oidcProviderRepo.findById(
      providerId,
      workspace.id,
    );
    if (!provider) {
      throw new NotFoundException('OIDC provider not found');
    }

    const slug = dto.slug ? this.normalizeSlug(dto.slug) : provider.slug;
    const updatedProvider = await this.oidcProviderRepo.updateProvider(
      provider.id,
      workspace.id,
      {
        name: dto.name?.trim() ?? provider.name,
        slug,
        oidcIssuer: dto.oidcIssuer
          ? this.normalizeIssuer(dto.oidcIssuer)
          : provider.oidcIssuer,
        oidcClientId: dto.oidcClientId?.trim() ?? provider.oidcClientId,
        oidcClientSecret:
          dto.oidcClientSecret?.trim() || provider.oidcClientSecret,
        oidcRedirectUri: this.getRedirectUri(workspace, slug),
        domains:
          typeof dto.domains === 'undefined'
            ? provider.domains
            : this.normalizeDomains(dto.domains),
        autoJoinByEmail:
          dto.autoJoinByEmail ?? provider.autoJoinByEmail,
        autoCreateUsers:
          dto.autoCreateUsers ?? provider.autoCreateUsers,
      },
    );

    return this.toAdminProvider(updatedProvider);
  }

  async enableProvider(providerId: string, workspaceId: string) {
    const provider = await this.oidcProviderRepo.findById(providerId, workspaceId);
    if (!provider) {
      throw new NotFoundException('OIDC provider not found');
    }

    return this.toAdminProvider(
      await this.oidcProviderRepo.updateProvider(provider.id, workspaceId, {
        isEnabled: true,
      }),
    );
  }

  async disableProvider(providerId: string, workspaceId: string) {
    const provider = await this.oidcProviderRepo.findById(providerId, workspaceId);
    if (!provider) {
      throw new NotFoundException('OIDC provider not found');
    }

    return this.toAdminProvider(
      await this.oidcProviderRepo.updateProvider(provider.id, workspaceId, {
        isEnabled: false,
      }),
    );
  }

  async buildAuthorizationUrl(
    workspace: Workspace,
    slug: string,
    redirectTo?: string,
  ) {
    const provider = await this.getEnabledProviderBySlug(slug, workspace.id);
    const codeVerifier = this.oidcProviderService.randomCodeVerifier();
    const expectedState = this.oidcProviderService.randomState();
    const safeRedirect = this.normalizeRedirectTo(redirectTo);

    const { url } = await this.oidcProviderService.buildAuthorizationUrl(
      provider,
      {
        redirectUri: provider.oidcRedirectUri,
        codeVerifier,
        state: expectedState,
      },
    );

    await this.redis.set(
      this.getStateKey(expectedState),
      JSON.stringify({
        providerId: provider.id,
        codeVerifier,
        expectedState,
        redirectTo: safeRedirect,
      } satisfies OidcStatePayload),
      'EX',
      this.environmentService.getOidcStateTtlSeconds(),
    );

    return url.toString();
  }

  async handleCallback(workspace: Workspace, slug: string, currentUrl: URL) {
    const provider = await this.getEnabledProviderBySlug(slug, workspace.id);
    const state = currentUrl.searchParams.get('state');
    if (!state) {
      throw new BadRequestException('Missing OIDC state');
    }

    const payload = await this.readStatePayload(state, provider.id);
    const { userInfo } = await this.oidcProviderService.exchangeCode(
      provider,
      currentUrl,
      {
        codeVerifier: payload.codeVerifier,
        expectedState: payload.expectedState,
      },
    );

    const user = await this.resolveUserFromOidc(
      workspace,
      provider,
      userInfo as OidcUserInfo,
    );

    await this.userRepo.updateLastLogin(user.id, workspace.id);
    const authToken = await this.sessionService.createSessionAndToken(user);
    await this.oidcProviderRepo.updateProvider(provider.id, workspace.id, {
      lastUsedAt: new Date(),
    });

    this.auditService.log({
      event: AuditEvent.USER_LOGIN,
      resourceType: AuditResource.USER,
      resourceId: user.id,
      metadata: {
        source: 'oidc',
        providerId: provider.id,
      },
    });

    return { authToken, redirectTo: payload.redirectTo };
  }

  async countEnabledProviders(workspaceId: string): Promise<number> {
    return this.oidcProviderRepo.countEnabledByWorkspace(workspaceId);
  }

  private async resolveUserFromOidc(
    workspace: Workspace,
    provider: AuthProvider,
    userInfo: OidcUserInfo,
  ): Promise<User> {
    const providerUserId = userInfo.sub?.trim();
    if (!providerUserId) {
      throw new UnauthorizedException('OIDC provider did not return a subject');
    }

    const existingAccount = await this.oidcAccountRepo.findByProviderUserId(
      workspace.id,
      provider.id,
      providerUserId,
    );
    if (existingAccount) {
      const existingUser = await this.userRepo.findById(
        existingAccount.userId,
        workspace.id,
      );
      if (!existingUser || isUserDisabled(existingUser)) {
        throw new UnauthorizedException('User account is unavailable');
      }
      return existingUser;
    }

    const email = userInfo.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException('OIDC provider did not return an email');
    }

    if (
      this.environmentService.isOidcStrictEmailVerified() &&
      userInfo.email_verified !== true
    ) {
      throw new UnauthorizedException('OIDC email address is not verified');
    }

    validateAllowedEmail(email, workspace);
    this.validateProviderDomains(email, provider);

    const existingUser = await this.userRepo.findByEmail(email, workspace.id);
    if (existingUser) {
      if (isUserDisabled(existingUser)) {
        throw new UnauthorizedException('User account is unavailable');
      }

      if (!provider.autoJoinByEmail) {
        throw new UnauthorizedException(
          'This OIDC provider does not allow automatic account linking',
        );
      }

      await this.oidcAccountRepo.insertAccount({
        workspaceId: workspace.id,
        userId: existingUser.id,
        authProviderId: provider.id,
        providerUserId,
        providerEmail: email,
        metadata: {
          emailVerified: userInfo.email_verified === true,
          name: userInfo.name ?? null,
        },
      });

      return existingUser;
    }

    if (!provider.autoCreateUsers) {
      throw new UnauthorizedException(
        'This OIDC provider does not allow automatic account creation',
      );
    }

    return executeTx(this.db, async (trx) => {
      const createdUser = await this.userRepo.insertUser(
        {
          name: userInfo.name?.trim() || email.split('@')[0],
          email,
          password: nanoIdGen(32),
          role: workspace.defaultRole || UserRole.MEMBER,
          workspaceId: workspace.id,
          emailVerifiedAt: new Date(),
          hasGeneratedPassword: true,
        },
        trx,
      );

      await this.groupUserRepo.addUserToDefaultGroup(
        createdUser.id,
        workspace.id,
        trx,
      );

      await this.oidcAccountRepo.insertAccount(
        {
          workspaceId: workspace.id,
          userId: createdUser.id,
          authProviderId: provider.id,
          providerUserId,
          providerEmail: email,
          metadata: {
            emailVerified: userInfo.email_verified === true,
            name: userInfo.name ?? null,
          },
        },
        trx,
      );

      this.auditService.log({
        event: AuditEvent.USER_CREATED,
        resourceType: AuditResource.USER,
        resourceId: createdUser.id,
        changes: {
          after: {
            name: createdUser.name,
            email: createdUser.email,
            role: createdUser.role,
          },
        },
        metadata: {
          source: 'oidc',
          providerId: provider.id,
        },
      });

      return createdUser;
    });
  }

  private async getEnabledProviderBySlug(slug: string, workspaceId: string) {
    const provider = await this.oidcProviderRepo.findBySlug(slug, workspaceId);
    if (!provider || !provider.isEnabled) {
      throw new NotFoundException('OIDC provider not found');
    }
    return provider;
  }

  private async readStatePayload(state: string, providerId: string) {
    const payloadRaw = await this.redis.get(this.getStateKey(state));
    if (!payloadRaw) {
      throw new BadRequestException('OIDC state is invalid or expired');
    }

    await this.redis.del(this.getStateKey(state));

    const payload = JSON.parse(payloadRaw) as OidcStatePayload;
    if (payload.providerId !== providerId) {
      throw new BadRequestException('OIDC state is invalid');
    }

    return payload;
  }

  private toAdminProvider(provider: AuthProvider) {
    return {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      type: provider.type,
      oidcIssuer: provider.oidcIssuer,
      oidcClientId: provider.oidcClientId,
      oidcRedirectUri: provider.oidcRedirectUri,
      domains: provider.domains ?? [],
      autoJoinByEmail: provider.autoJoinByEmail,
      autoCreateUsers: provider.autoCreateUsers,
      isEnabled: provider.isEnabled,
      hasClientSecret: !!provider.oidcClientSecret,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  private getRedirectUri(workspace: Workspace, slug: string) {
    return `${this.domainService.getUrl(workspace.hostname)}/api/oidc/${slug}/callback`;
  }

  private getStateKey(state: string) {
    return `oidc:state:${state}`;
  }

  private normalizeSlug(rawSlug: string) {
    const slug = rawSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) {
      throw new BadRequestException('OIDC provider slug is invalid');
    }

    return slug;
  }

  private normalizeIssuer(rawIssuer: string) {
    const issuer = new URL(rawIssuer.trim()).toString();
    return issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;
  }

  private normalizeDomains(domains?: string[]) {
    if (!domains) return null;

    const regex =
      /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]/;

    const normalized = domains
      .map((domain) => domain.trim().toLowerCase())
      .map((domain) => regex.exec(domain)?.[0])
      .filter(Boolean);

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeRedirectTo(redirectTo?: string) {
    if (!redirectTo) {
      return this.environmentService.getOidcDefaultRedirectPath();
    }

    try {
      const resolved = new URL(redirectTo, this.environmentService.getAppUrl());
      if (resolved.origin === this.environmentService.getAppUrl()) {
        return resolved.pathname + resolved.search + resolved.hash;
      }
    } catch {
      // ignored
    }

    return this.environmentService.getOidcDefaultRedirectPath();
  }

  private validateProviderDomains(email: string, provider: AuthProvider) {
    if (!provider.domains || provider.domains.length === 0) {
      return;
    }

    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain || !provider.domains.includes(emailDomain)) {
      throw new UnauthorizedException(
        `The email domain "${emailDomain}" is not approved for this OIDC provider.`,
      );
    }
  }
}
