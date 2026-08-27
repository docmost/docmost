import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  AuthProviderRepo,
  GOOGLE_PROVIDER_TYPE,
} from '@docmost/db/repos/auth-provider/auth-provider.repo';
import { AuthProviderGroupMappingRepo } from '@docmost/db/repos/auth-provider/auth-provider-group-mapping.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { AuthProvider } from '@docmost/db/types/entity.types';
import { MembershipSource } from '../sso.constants';
import { GoogleGroupsService } from './google-groups.service';
import {
  CreateGroupMappingDto,
  PreviewMappingDto,
  UpdateSsoConfigDto,
  WizardMappingItemDto,
} from '../dto/sso-config.dto';

@Injectable()
export class SsoConfigService {
  private readonly logger = new Logger(SsoConfigService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly mappingRepo: AuthProviderGroupMappingRepo,
    private readonly groupRepo: GroupRepo,
    private readonly googleGroupsService: GoogleGroupsService,
  ) {}

  /**
   * The Google provider row is created on first visit to the settings page, so
   * admins never have to "add" a provider before configuring it.
   */
  async getOrCreateProvider(
    workspaceId: string,
    creatorId: string,
  ): Promise<AuthProvider> {
    const existing =
      await this.authProviderRepo.findGoogleProvider(workspaceId);
    if (existing) return existing;

    return this.authProviderRepo.insert({
      name: 'Google',
      type: GOOGLE_PROVIDER_TYPE,
      isEnabled: false,
      allowSignup: false,
      groupSync: false,
      creatorId,
      workspaceId,
    });
  }

  async updateProvider(
    workspaceId: string,
    userId: string,
    dto: UpdateSsoConfigDto,
  ): Promise<AuthProvider> {
    const provider = await this.getOrCreateProvider(workspaceId, userId);
    return this.authProviderRepo.update(provider.id, workspaceId, dto);
  }

  async listMappings(workspaceId: string) {
    return this.mappingRepo.findByWorkspace(workspaceId);
  }

  async createMapping(
    workspaceId: string,
    userId: string,
    dto: CreateGroupMappingDto,
  ) {
    const provider = await this.getOrCreateProvider(workspaceId, userId);

    const group = await this.groupRepo.findById(dto.groupId, workspaceId);
    if (!group) {
      throw new BadRequestException('Group not found');
    }
    if (group.isDefault) {
      throw new BadRequestException(
        'The default group cannot be managed by Google group sync.',
      );
    }

    return this.mappingRepo.insert({
      authProviderId: provider.id,
      workspaceId,
      externalGroupKey: dto.externalGroupKey.toLowerCase(),
      groupId: dto.groupId,
      role: dto.role ?? null,
    });
  }

  async deleteMapping(workspaceId: string, mappingId: string): Promise<void> {
    const mapping = await this.mappingRepo.findById(mappingId, workspaceId);
    if (!mapping) {
      throw new BadRequestException('Mapping not found');
    }
    await this.mappingRepo.delete(mappingId, workspaceId);
  }

  async commitWizard(
    workspaceId: string,
    userId: string,
    mappings: WizardMappingItemDto[],
  ) {
    const created = [];
    for (const item of mappings) {
      created.push(await this.createMapping(workspaceId, userId, item));
    }
    return created;
  }

  /**
   * Shows an admin exactly what a mapping would do before they commit it:
   * who gets added, who is already there, which manual members are untouched,
   * and which Google members have no Docmost account yet.
   */
  async previewMapping(workspaceId: string, dto: PreviewMappingDto) {
    if (!this.googleGroupsService.isConfigured()) {
      throw new BadRequestException(
        'Google group sync is not configured on this server.',
      );
    }

    const group = await this.groupRepo.findById(dto.groupId, workspaceId);
    if (!group) {
      throw new BadRequestException('Group not found');
    }

    let memberEmails: string[];
    try {
      memberEmails = await this.googleGroupsService.listGroupMemberEmails(
        dto.externalGroupKey,
      );
    } catch (err: any) {
      // The raw body names the service account, project and missing IAM
      // permission; keep that in the logs rather than the HTTP response.
      this.logger.error(
        `Cloud Identity preview failed for ${dto.externalGroupKey}: ${err?.message}`,
      );
      throw new BadRequestException(
        "Could not read that Google group. Check the group email and the service account's Cloud Identity access.",
      );
    }

    const matchedUsers = memberEmails.length
      ? await this.db
          .selectFrom('users')
          .select(['id'])
          .where('workspaceId', '=', workspaceId)
          .where('deletedAt', 'is', null)
          .where(sql`lower(email)`, 'in', memberEmails)
          .execute()
      : [];

    const memberships = await this.db
      .selectFrom('groupUsers')
      .select(['userId', 'source'])
      .where('groupId', '=', dto.groupId)
      .execute();

    const currentIds = new Set(memberships.map((m) => m.userId));
    const matchedIds = matchedUsers.map((u) => u.id);

    return {
      groupName: group.name,
      googleMemberCount: memberEmails.length,
      wouldAdd: matchedIds.filter((id) => !currentIds.has(id)).length,
      alreadyMembers: matchedIds.filter((id) => currentIds.has(id)).length,
      manualMembersUnaffected: memberships.filter(
        (m) => m.source !== MembershipSource.GOOGLE,
      ).length,
      withoutDocmostAccount: memberEmails.length - matchedIds.length,
    };
  }
}
