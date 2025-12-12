import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import * as client from 'openid-client';
import { isEmail } from 'class-validator';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User, InsertableUser } from '@docmost/db/types/entity.types';
import { AuthProviderRepo } from '../../../database/repos/auth-provider/auth-provider.repo';
import { UserRepo } from '../../../database/repos/user/user.repo';
import { AuthAccountRepo } from '../../../database/repos/auth-account/auth-account.repo';
import { TokenService } from './token.service';
import { executeTx } from '@docmost/db/utils';
import { validateAllowedEmail } from '../auth.util';
import { UserRole } from '../../../common/helpers/types/permission';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { AttachmentType, MAX_AVATAR_SIZE_BYTES, validImageExtensions } from '../../attachment/attachment.constants';
import { AttachmentService } from '../../attachment/services/attachment.service';

interface CachedConfig {
  config: client.Configuration;
  expiresAt: number;
}

export interface OidcAuthSession {
  workspaceId: string;
  codeVerifier: string;
  nonce: string;
  expectedIssuer: string;
  timestamp: number;
}

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  private readonly configCache = new Map<string, CachedConfig>();
  private readonly CONFIG_CACHE_TTL_MS = 60 * 60 * 1000;

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly userRepo: UserRepo,
    private readonly authAccountRepo: AuthAccountRepo,
    private readonly tokenService: TokenService,
    private readonly groupUserRepo: GroupUserRepo,
    private readonly workspaceService: WorkspaceService,
    private readonly attachmentService: AttachmentService,
  ) { }

  private async getCachedConfig(
    issuerUrl: string,
    clientId: string,
    clientSecret: string,
  ): Promise<client.Configuration> {
    const cacheKey = `${issuerUrl}:${clientId}`;
    const cached = this.configCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.config;
    }

    try {
      const config = await client.discovery(
        new URL(issuerUrl),
        clientId,
        clientSecret,
        client.ClientSecretPost(clientSecret)
      );

      const serverMetadata = config.serverMetadata();
      if (!serverMetadata.issuer) {
        throw new BadRequestException('Invalid OIDC issuer metadata');
      }

      this.configCache.set(cacheKey, {
        config,
        expiresAt: now + this.CONFIG_CACHE_TTL_MS,
      });

      return config;
    } catch (error) {
      this.configCache.delete(cacheKey);
      throw error;
    }
  }

  clearConfigCache(issuerUrl?: string, clientId?: string): void {
    if (issuerUrl && clientId) {
      this.configCache.delete(`${issuerUrl}:${clientId}`);
    } else {
      this.configCache.clear();
    }
  }

  private sanitizeUserInfo(userinfo: any, avatarAttribute?: string) {
    if (!userinfo.email || !isEmail(userinfo.email)) {
      throw new BadRequestException('Invalid email from OIDC provider');
    }

    if (
      !userinfo.sub ||
      typeof userinfo.sub !== 'string' ||
      userinfo.sub.length > 255
    ) {
      throw new BadRequestException('Invalid subject from OIDC provider');
    }

    let avatarUrl: string | undefined;
    let avatarBase64: string | undefined;

    if (avatarAttribute) {
      const avatarValue = userinfo[avatarAttribute];
      if (avatarValue && typeof avatarValue === 'string') {
        if (avatarValue.startsWith('data:image/')) {
          avatarBase64 = avatarValue;
        } else {
          try {
            const url = new URL(avatarValue);
            if (url.protocol === 'https:' || url.protocol === 'http:') {
              avatarUrl = avatarValue;
            }
          } catch {
            // Not a valid URL, ignore
          }
        }
      }
    }

    return {
      email: userinfo.email.toLowerCase().trim(),
      sub: userinfo.sub,
      name: userinfo.name
        ? String(userinfo.name).substring(0, 100)
        : userinfo.preferred_username || userinfo.email.split('@')[0],
      avatarUrl,
      avatarBase64,
    };
  }

  private async processAvatarBase64(
    base64Data: string,
    userId: string,
    workspaceId: string,
  ): Promise<string | null> {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new BadRequestException('Invalid base64 image format');
    }

    const imageFormat = matches[1].toLowerCase();
    const base64Content = matches[2];

    if (!validImageExtensions.includes(`.${imageFormat}`)) {
      throw new BadRequestException('Unsupported image format');
    }

    const buffer = Buffer.from(base64Content, 'base64');

    if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
      throw new BadRequestException('Avatar image too large');
    }

    const fileExt = imageFormat === 'jpg' ? 'jpeg' : imageFormat;
    const fakeMultipartFile = {
      toBuffer: async () => buffer,
      filename: `avatar.${fileExt}`,
      mimetype: `image/${fileExt}`,
    };

    const attachment = await this.attachmentService.uploadImage(
      Promise.resolve(fakeMultipartFile) as any,
      AttachmentType.Avatar,
      userId,
      workspaceId,
    );

    return attachment?.fileName ?? null;
  }

  private async processAvatarUrl(
    avatarUrl: string,
    userId: string,
    workspaceId: string,
  ): Promise<string | null> {
    const response = await fetch(avatarUrl);
    if (!response.ok) {
      throw new BadRequestException('Failed to fetch avatar from URL');
    }

    const contentType = response.headers.get('content-type') || '';
    const mimeMatch = contentType.match(/^image\/(\w+)/);
    if (!mimeMatch) {
      throw new BadRequestException('URL does not point to a valid image');
    }

    const imageFormat = mimeMatch[1].toLowerCase();
    if (!validImageExtensions.includes(`.${imageFormat}`)) {
      throw new BadRequestException('Unsupported image format');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
      throw new BadRequestException('Avatar image too large');
    }

    const fileExt = imageFormat === 'jpg' ? 'jpeg' : imageFormat;
    const fakeMultipartFile = {
      toBuffer: async () => buffer,
      filename: `avatar.${fileExt}`,
      mimetype: `image/${fileExt}`,
    };

    const attachment = await this.attachmentService.uploadImage(
      Promise.resolve(fakeMultipartFile) as any,
      AttachmentType.Avatar,
      userId,
      workspaceId,
    );

    return attachment?.fileName ?? null;
  }

  async getAuthorizationUrl(
    workspaceId: string,
    redirectUri: string,
  ): Promise<{
    url: string;
    state: string;
    codeVerifier: string;
    nonce: string;
    expectedIssuer: string;
  }> {
    const authProvider =
      await this.authProviderRepo.findOidcProvider(workspaceId);

    if (!authProvider) {
      throw new BadRequestException('OIDC provider not found or not enabled');
    }

    const config = await this.getCachedConfig(
      authProvider.oidcIssuer,
      authProvider.oidcClientId,
      authProvider.oidcClientSecret,
    );

    const state = client.randomState();
    const nonce = client.randomNonce();

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    const authUrl = client.buildAuthorizationUrl(config, {
      scope: authProvider.scope,
      state,
      nonce,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: authUrl.href,
      state,
      codeVerifier,
      nonce,
      expectedIssuer: authProvider.oidcIssuer,
    };
  }

  async handleCallback(
    workspaceId: string,
    code: string,
    state: string,
    iss: string,
    redirectUri: string,
    codeVerifier: string,
    expectedNonce: string,
    expectedIssuer: string,
  ): Promise<{ token: string; user: User }> {
    const authProvider =
      await this.authProviderRepo.findOidcProvider(workspaceId);

    if (!authProvider) {
      throw new BadRequestException('OIDC provider not found or not enabled');
    }

    if (iss) {
      const normalizedIss = iss.replace(/\/+$/, '');
      const normalizedExpected = expectedIssuer.replace(/\/+$/, '');

      if (normalizedIss !== normalizedExpected) {
        this.logger.warn(
          `Issuer mismatch: received ${iss}, expected ${expectedIssuer}`,
        );
        throw new UnauthorizedException('Authentication failed');
      }
    }

    const config = await this.getCachedConfig(
      authProvider.oidcIssuer,
      authProvider.oidcClientId,
      authProvider.oidcClientSecret,
    );

    try {
      const callbackUrl = new URL(redirectUri);
      callbackUrl.searchParams.set('code', code);
      callbackUrl.searchParams.set('state', state);
      if (iss) {
        callbackUrl.searchParams.set('iss', iss);
      }

      const tokens = await client.authorizationCodeGrant(
        config,
        callbackUrl,
        {
          expectedState: state,
          expectedNonce: expectedNonce,
          pkceCodeVerifier: codeVerifier,
        },
      );

      const claims = tokens.claims();
      if (!claims?.sub) {
        throw new UnauthorizedException(
          'Missing sub claim in ID token from OIDC provider',
        );
      }

      let userinfo;
      try {
        userinfo = await client.fetchUserInfo(
          config,
          tokens.access_token,
          claims.sub,
        );
      } catch (userinfoError) {
        throw userinfoError;
      }

      if (authProvider.oidcAllowedGroups) {
        const allowedGroups = authProvider.oidcAllowedGroups
          .split(',')
          .map((g) => g.trim())
          .filter((g) => g.length > 0);

        if (allowedGroups.length > 0) {
          const userGroups = (userinfo.groups as string[]) || [];

          if (!Array.isArray(userGroups)) {
            throw new UnauthorizedException(
              'User has no groups or groups format is invalid from OIDC provider',
            );
          }

          const hasAllowedGroup = userGroups.some((group) =>
            allowedGroups.includes(group),
          );

          if (!hasAllowedGroup) {
            throw new UnauthorizedException(
              'User does not belong to any allowed group',
            );
          }
        }
      }

      const sanitizedUserinfo = this.sanitizeUserInfo(
        userinfo,
        authProvider.oidcAvatarAttribute,
      );

      if (!sanitizedUserinfo.email) {
        throw new BadRequestException('Email not provided by OIDC provider');
      }

      const workspace = await this.db
        .selectFrom('workspaces')
        .selectAll()
        .where('id', '=', workspaceId)
        .executeTakeFirst();

      if (!workspace) {
        throw new BadRequestException('Workspace not found');
      }

      validateAllowedEmail(sanitizedUserinfo.email as string, workspace);

      let user = await this.userRepo.findByEmail(
        sanitizedUserinfo.email as string,
        workspaceId,
      );

      if (user) {
        await this.linkAccountIfNeeded(
          user,
          sanitizedUserinfo.sub,
          authProvider.id,
        );
      } else {
        if (!authProvider.allowSignup) {
          throw new UnauthorizedException(
            'Account signup is not allowed for this OIDC provider',
          );
        }

        const existingAccount = await this.authAccountRepo.findByProviderUserId(
          sanitizedUserinfo.sub,
          authProvider.id,
          workspaceId,
        );

        if (existingAccount) {
          throw new BadRequestException(
            'Account already exists for this provider user ID',
          );
        }

        user = await this.createUserFromOidc(
          sanitizedUserinfo,
          authProvider,
          workspaceId,
        );
      }

      if (sanitizedUserinfo.avatarBase64) {
        try {
          const avatarFileName = await this.processAvatarBase64(
            sanitizedUserinfo.avatarBase64,
            user.id,
            workspaceId,
          );
          if (avatarFileName) {
            user.avatarUrl = avatarFileName;
          }
        } catch (err) {
          this.logger.warn(`Failed to process base64 avatar: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else if (sanitizedUserinfo.avatarUrl) {
        try {
          const avatarFileName = await this.processAvatarUrl(
            sanitizedUserinfo.avatarUrl,
            user.id,
            workspaceId,
          );
          if (avatarFileName) {
            user.avatarUrl = avatarFileName;
          }
        } catch (err) {
          this.logger.warn(`Failed to process avatar URL: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      const token = await this.tokenService.generateAccessToken(user);

      return { token, user };
    } catch (error) {
      this.logger.error(
        'OIDC authentication error',
        error instanceof Error ? error.stack : String(error),
      );

      throw new UnauthorizedException('Authentication failed');
    }
  }

  private async createUserFromOidc(
    userinfo: any,
    authProvider: any,
    workspaceId: string,
  ): Promise<User> {
    const userData: InsertableUser = {
      name: userinfo.name,
      email: userinfo.email,
      password: '', // Empty password new for OIDC users
      role: UserRole.MEMBER,
      emailVerifiedAt: new Date(),
      workspaceId,
      avatarUrl: userinfo.avatarUrl,
    };

    let user: User;

    await executeTx(this.db, async (trx) => {
      const existingUser = await this.userRepo.findByEmail(
        userinfo.email,
        workspaceId,
        { trx },
      );
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      user = await this.userRepo.insertUser(userData, trx);

      await this.authAccountRepo.create(
        {
          userId: user.id,
          providerUserId: userinfo.sub,
          authProviderId: authProvider.id,
          workspaceId,
        },
        trx,
      );

      // add user to workspace
      await this.workspaceService.addUserToWorkspace(
        user.id,
        workspaceId,
        undefined,
        trx,
      );

      // add user to default group
      await this.groupUserRepo.addUserToDefaultGroup(user.id, workspaceId, trx);
    });

    return user;
  }

  private async linkAccountIfNeeded(
    user: User,
    providerUserId: string,
    authProviderId: string,
  ): Promise<void> {
    const existingAccount = await this.authAccountRepo.findByUserAndProvider(
      user.id,
      authProviderId,
      user.workspaceId,
    );

    if (!existingAccount) {
      await this.authAccountRepo.create({
        userId: user.id,
        providerUserId,
        authProviderId,
        workspaceId: user.workspaceId,
      });
    }
  }
}
