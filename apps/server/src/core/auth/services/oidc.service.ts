import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Client, Issuer, generators } from 'openid-client';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User, InsertableUser } from '@docmost/db/types/entity.types';
import { AuthProviderRepo } from '../../../database/repos/auth-provider/auth-provider.repo';
import { UserRepo } from '../../../database/repos/user/user.repo';
import { AuthAccountRepo } from '../../../database/repos/auth-account/auth-account.repo';
import { TokenService } from './token.service';
import { executeTx } from '@docmost/db/utils';
import { validateAllowedEmail } from '../auth.util';
import { UserRole } from '../../../common/helpers/types/permission';

@Injectable()
export class OidcService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly userRepo: UserRepo,
    private readonly authAccountRepo: AuthAccountRepo,
    private readonly tokenService: TokenService,
  ) {}

  async getAuthorizationUrl(
    workspaceId: string,
    redirectUri: string,
  ): Promise<{ url: string; state: string }> {
    const authProvider = await this.authProviderRepo.findOidcProvider(
      workspaceId,
    );

    if (!authProvider) {
      throw new BadRequestException('OIDC provider not found or not enabled');
    }

    const client = await this.createClient(authProvider);
    const state = generators.state();

    const url = client.authorizationUrl({
      scope: 'openid email profile',
      state,
      redirect_uri: redirectUri,
    });

    return { url, state };
  }

  async handleCallback(
    workspaceId: string,
    code: string,
    redirectUri: string,
  ): Promise<{ token: string; user: User }> {
    const authProvider = await this.authProviderRepo.findOidcProvider(
      workspaceId,
    );

    if (!authProvider) {
      throw new BadRequestException('OIDC provider not found or not enabled');
    }

    const client = await this.createClient(authProvider);

    try {
      const tokenSet = await client.callback(redirectUri, { code });

      const userinfo = await client.userinfo(tokenSet.access_token);

      if (!userinfo.email) {
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

      validateAllowedEmail(userinfo.email as string, workspace);

      let user = await this.userRepo.findByEmail(
        userinfo.email as string,
        workspaceId,
      );

      if (user) {
        await this.linkAccountIfNeeded(user, userinfo.sub, authProvider.id);
      } else {
        if (!authProvider.allowSignup) {
          throw new BadRequestException(
            'Account signup is not allowed for this OIDC provider',
          );
        }

        user = await this.createUserFromOidc(userinfo, authProvider, workspaceId);
      }

      const token = await this.tokenService.generateAccessToken(user);

      return { token, user };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new UnauthorizedException('OIDC authentication failed: ' + errorMessage);
    }
  }

  private async createClient(authProvider: any): Promise<Client> {
    const issuer = await Issuer.discover(authProvider.oidcIssuer);

    return new issuer.Client({
      client_id: authProvider.oidcClientId,
      client_secret: authProvider.oidcClientSecret,
      response_types: ['code'],
    });
  }

  private async createUserFromOidc(
    userinfo: any,
    authProvider: any,
    workspaceId: string,
  ): Promise<User> {
    const userData: InsertableUser = {
      name: userinfo.name || 
            userinfo.preferred_username || 
            userinfo.email.split('@')[0],
      email: userinfo.email,
      password: '', // Empty password new for OIDC users
      role: UserRole.MEMBER,
      emailVerifiedAt: new Date(),
      workspaceId,
    };

    let user: User;

    await executeTx(this.db, async (trx) => {
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