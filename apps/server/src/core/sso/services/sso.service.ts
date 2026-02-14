import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProviderRepo } from '@docmost/db/repos/auth-provider/auth-provider.repo';
import { AuthAccountRepo } from '@docmost/db/repos/auth-provider/auth-account.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { TokenService } from '../../auth/services/token.service';
import { SignupService } from '../../auth/services/signup.service';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { nanoIdGen } from '../../../common/helpers';
import {
  AuthProvider,
  User,
  Workspace,
} from '@docmost/db/types/entity.types';
import {
  CreateSsoProviderDto,
  DeleteSsoProviderDto,
  GetSsoProviderDto,
  UpdateSsoProviderDto,
} from '../dto/sso.dto';
import { Issuer } from 'openid-client';
import { IncomingMessage } from 'http';

@Injectable()
export class SsoService {
  constructor(
    private authProviderRepo: AuthProviderRepo,
    private authAccountRepo: AuthAccountRepo,
    private userRepo: UserRepo,
    private tokenService: TokenService,
    private signupService: SignupService,
    private environmentService: EnvironmentService,
  ) {}

  async getProviders(workspaceId: string): Promise<AuthProvider[]> {
    return this.authProviderRepo.findByWorkspaceId(workspaceId);
  }

  async getProviderById(dto: GetSsoProviderDto, workspaceId: string) {
    const provider = await this.authProviderRepo.findById(dto.providerId);
    if (!provider || provider.workspaceId !== workspaceId) {
      throw new NotFoundException('SSO provider not found');
    }
    return provider;
  }

  async createProvider(
    dto: CreateSsoProviderDto,
    user: User,
    workspace: Workspace,
  ): Promise<AuthProvider> {
    return this.authProviderRepo.insert({
      type: dto.type,
      name: dto.name,
      workspaceId: workspace.id,
      creatorId: user.id,
    });
  }

  async updateProvider(
    dto: UpdateSsoProviderDto,
    workspaceId: string,
  ): Promise<AuthProvider> {
    const provider = await this.authProviderRepo.findById(dto.providerId);
    if (!provider || provider.workspaceId !== workspaceId) {
      throw new NotFoundException('SSO provider not found');
    }

    const { providerId, ...updateData } = dto;

    return this.authProviderRepo.update(providerId, updateData as any);
  }

  async deleteProvider(
    dto: DeleteSsoProviderDto,
    workspaceId: string,
  ): Promise<void> {
    const provider = await this.authProviderRepo.findById(dto.providerId);
    if (!provider || provider.workspaceId !== workspaceId) {
      throw new NotFoundException('SSO provider not found');
    }

    await this.authProviderRepo.delete(dto.providerId, workspaceId);
  }

  getOidcCallbackUrl(providerId: string): string {
    return `${this.environmentService.getAppUrl()}/api/sso/oidc/${providerId}/callback`;
  }

  async getOidcLoginUrl(providerId: string): Promise<string> {
    const provider = await this.authProviderRepo.findById(providerId);
    if (
      !provider ||
      provider.type !== 'oidc' ||
      !provider.isEnabled
    ) {
      throw new NotFoundException('OIDC provider not found or not enabled');
    }

    if (!provider.oidcIssuer || !provider.oidcClientId) {
      throw new BadRequestException('OIDC provider is not properly configured');
    }

    const issuer = await Issuer.discover(provider.oidcIssuer);

    if (!issuer.metadata.authorization_endpoint) {
      throw new BadRequestException('OIDC issuer has no authorization endpoint');
    }

    const redirectUri = this.getOidcCallbackUrl(providerId);

    return (
      `${issuer.metadata.authorization_endpoint}` +
      `?response_type=code` +
      `&client_id=${provider.oidcClientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=openid profile email` +
      `&state=${providerId}`
    );
  }

  async handleOidcCallback(
    providerId: string,
    req: IncomingMessage,
  ): Promise<string> {
    const provider = await this.authProviderRepo.findById(providerId);
    if (
      !provider ||
      provider.type !== 'oidc' ||
      !provider.isEnabled
    ) {
      throw new UnauthorizedException('OIDC provider not found or not enabled');
    }

    if (
      !provider.oidcIssuer ||
      !provider.oidcClientId ||
      !provider.oidcClientSecret
    ) {
      throw new UnauthorizedException('OIDC provider is not properly configured');
    }

    const issuer = await Issuer.discover(provider.oidcIssuer);
    const client = new issuer.Client({
      client_id: provider.oidcClientId,
      client_secret: provider.oidcClientSecret,
    });

    const redirectUri = this.getOidcCallbackUrl(providerId);
    const params = client.callbackParams(req);

    const tokenSet = await client.callback(redirectUri, params, {
      state: providerId,
    });

    const claims = tokenSet.claims();
    const email = claims.email as string;
    const name = (claims.name as string) || (claims.preferred_username as string);
    const providerUserId = claims.sub;

    if (!email) {
      throw new UnauthorizedException('Email not provided by OIDC provider');
    }

    // Check if auth account already exists
    const existingAccount = await this.authAccountRepo.findByProviderUserId(
      providerUserId,
      provider.id,
    );

    if (existingAccount) {
      const user = await this.userRepo.findById(
        existingAccount.userId,
        provider.workspaceId,
      );
      if (!user || user.deactivatedAt) {
        throw new UnauthorizedException('User account is deactivated');
      }
      return this.tokenService.generateAccessToken(user);
    }

    // Find user by email
    let user = await this.userRepo.findByEmail(email, provider.workspaceId);

    if (user) {
      // Link the OIDC account to existing user
      await this.authAccountRepo.upsert({
        userId: user.id,
        providerUserId,
        authProviderId: provider.id,
        workspaceId: provider.workspaceId,
      });
      return this.tokenService.generateAccessToken(user);
    }

    // JIT provisioning: create user if allowSignup is enabled
    if (provider.allowSignup) {
      user = await this.signupService.signup(
        {
          email,
          name: name || email.split('@')[0],
          password: nanoIdGen() + nanoIdGen(),
          emailVerifiedAt: new Date(),
        } as any,
        provider.workspaceId,
      );

      await this.authAccountRepo.insert({
        userId: user.id,
        providerUserId,
        authProviderId: provider.id,
        workspaceId: provider.workspaceId,
      });

      return this.tokenService.generateAccessToken(user);
    }

    throw new UnauthorizedException(
      'No account found for this email. Contact your workspace administrator.',
    );
  }
}
