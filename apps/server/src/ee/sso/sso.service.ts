import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthProviderRepo } from './auth-provider.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { Workspace } from '@docmost/db/types/entity.types';

@Injectable()
export class SsoService {
  constructor(
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  private assertAdmin(user: User, workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  private mapProvider(provider: any) {
    return {
      ...provider,
      providerId: provider.id,
      samlUrl: provider.samlUrl,
      samlCertificate: provider.samlCertificate,
      oidcIssuer: provider.oidcIssuer,
      oidcClientId: provider.oidcClientId,
      oidcClientSecret: provider.oidcClientSecret,
      ldapUrl: provider.ldapUrl,
      ldapBindDn: provider.ldapBindDn,
      ldapBindPassword: provider.ldapBindPassword,
      ldapBaseDn: provider.ldapBaseDn,
      ldapUserSearchFilter: provider.ldapUserSearchFilter,
      ldapUserAttributes: provider.ldapUserAttributes,
      ldapTlsEnabled: provider.ldapTlsEnabled,
      ldapTlsCaCert: provider.ldapTlsCaCert,
    };
  }

  async list(
    workspaceId: string,
    user: User,
    workspace: Workspace,
    pagination: PaginationOptions,
  ) {
    this.assertAdmin(user, workspace);
    const result = await this.authProviderRepo.listPaginated(
      workspaceId,
      pagination,
    );
    return {
      ...result,
      items: result.items.map((p) => this.mapProvider(p)),
    };
  }

  async getById(
    providerId: string,
    workspaceId: string,
    user: User,
    workspace: Workspace,
  ) {
    this.assertAdmin(user, workspace);
    const provider = await this.authProviderRepo.findById(
      providerId,
      workspaceId,
    );
    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }
    return this.mapProvider(provider);
  }

  async create(workspaceId: string, user: User, workspace: Workspace, data: any) {
    this.assertAdmin(user, workspace);
    const provider = await this.authProviderRepo.insert({
      name: data.name,
      type: data.type,
      samlUrl: data.samlUrl ?? null,
      samlCertificate: data.samlCertificate ?? null,
      oidcIssuer: data.oidcIssuer ?? null,
      oidcClientId: data.oidcClientId ?? null,
      oidcClientSecret: data.oidcClientSecret ?? null,
      ldapUrl: data.ldapUrl ?? null,
      ldapBindDn: data.ldapBindDn ?? null,
      ldapBindPassword: data.ldapBindPassword ?? null,
      ldapBaseDn: data.ldapBaseDn ?? null,
      ldapUserSearchFilter: data.ldapUserSearchFilter ?? null,
      ldapUserAttributes: data.ldapUserAttributes ?? null,
      ldapTlsEnabled: data.ldapTlsEnabled ?? false,
      ldapTlsCaCert: data.ldapTlsCaCert ?? null,
      allowSignup: data.allowSignup ?? false,
      isEnabled: data.isEnabled ?? false,
      groupSync: data.groupSync ?? false,
      creatorId: user.id,
      workspaceId,
    });
    return this.mapProvider(provider);
  }

  async update(
    workspaceId: string,
    user: User,
    workspace: Workspace,
    data: any,
  ) {
    this.assertAdmin(user, workspace);
    const providerId = data.providerId ?? data.id;
    const existing = await this.authProviderRepo.findById(
      providerId,
      workspaceId,
    );
    if (!existing) {
      throw new NotFoundException('SSO provider not found');
    }

    const updated = await this.authProviderRepo.update(
      providerId,
      workspaceId,
      {
        name: data.name,
        samlUrl: data.samlUrl,
        samlCertificate: data.samlCertificate,
        oidcIssuer: data.oidcIssuer,
        oidcClientId: data.oidcClientId,
        oidcClientSecret: data.oidcClientSecret,
        ldapUrl: data.ldapUrl,
        ldapBindDn: data.ldapBindDn,
        ldapBindPassword: data.ldapBindPassword,
        ldapBaseDn: data.ldapBaseDn,
        ldapUserSearchFilter: data.ldapUserSearchFilter,
        ldapUserAttributes: data.ldapUserAttributes,
        ldapTlsEnabled: data.ldapTlsEnabled,
        ldapTlsCaCert: data.ldapTlsCaCert,
        allowSignup: data.allowSignup,
        isEnabled: data.isEnabled,
        groupSync: data.groupSync,
      },
    );
    return this.mapProvider(updated);
  }

  async delete(
    providerId: string,
    workspaceId: string,
    user: User,
    workspace: Workspace,
  ) {
    this.assertAdmin(user, workspace);
    const existing = await this.authProviderRepo.findById(
      providerId,
      workspaceId,
    );
    if (!existing) {
      throw new NotFoundException('SSO provider not found');
    }
    await this.authProviderRepo.softDelete(providerId, workspaceId);
  }
}
