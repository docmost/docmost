import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGroupDto, DefaultGroup } from '../dto/create-group.dto.js';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options.js';
import { UpdateGroupDto } from '../dto/update-group.dto.js';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types.js';
import { GroupRepo } from '@docmost/db/repos/group/group.repo.js';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo.js';
import { Group, InsertableGroup, User } from '@docmost/db/types/entity.types.js';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination.js';
import { GroupUserService } from './group-user.service.js';
import { executeTx } from '@docmost/db/utils.js';
import { InjectKysely } from 'nestjs-kysely';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events.js';
import { diffAuditTrackedFields } from '../../../common/helpers/index.js';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service.js';
import { WrapperType } from '../../../common/helpers/types/wrapper-type.js';

@Injectable()
export class GroupService {
  constructor(
    private groupRepo: GroupRepo,
    private groupUserRepo: GroupUserRepo,
    @Inject(forwardRef(() => GroupUserService))
    private groupUserService: WrapperType<GroupUserService>,
    @InjectKysely() private readonly db: KyselyDB,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getGroupInfo(groupId: string, workspaceId: string): Promise<Group> {
    const group = await this.groupRepo.findById(groupId, workspaceId, {
      includeMemberCount: true,
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async createGroup(
    authUser: User,
    workspaceId: string,
    createGroupDto: CreateGroupDto,
    trx?: KyselyTransaction,
  ): Promise<Group> {
    const groupExists = await this.groupRepo.findByName(
      createGroupDto.name,
      workspaceId,
    );
    if (groupExists) {
      throw new BadRequestException('Group name already exists');
    }
    const insertableGroup: InsertableGroup = {
      name: createGroupDto.name,
      description: createGroupDto.description,
      isDefault: false,
      creatorId: authUser.id,
      workspaceId: workspaceId,
    };

    const createdGroup = await this.groupRepo.insertGroup(insertableGroup, trx);

    if (createGroupDto?.userIds && createGroupDto.userIds.length > 0) {
      await this.groupUserService.addUsersToGroupBatch(
        createGroupDto.userIds,
        createdGroup.id,
        workspaceId,
      );
    }

    this.auditService.log({
      event: AuditEvent.GROUP_CREATED,
      resourceType: AuditResource.GROUP,
      resourceId: createdGroup.id,
      changes: {
        after: {
          name: createdGroup.name,
          description: createdGroup.description,
        },
      },
    });

    return createdGroup;
  }

  async updateGroup(
    workspaceId: string,
    updateGroupDto: UpdateGroupDto,
  ): Promise<Group> {
    const group = await this.groupRepo.findById(
      updateGroupDto.groupId,
      workspaceId,
      { includeMemberCount: true },
    );

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.isDefault) {
      throw new BadRequestException('You cannot update a default group');
    }

    const groupBefore = { name: group.name, description: group.description };

    if (updateGroupDto.name) {
      const existingGroup = await this.groupRepo.findByName(
        updateGroupDto.name,
        workspaceId,
      );

      if (existingGroup && group.name !== existingGroup.name) {
        throw new BadRequestException('Group name already exists');
      }

      group.name = updateGroupDto.name;
    }

    if (updateGroupDto.description) {
      group.description = updateGroupDto.description;
    }

    await this.groupRepo.update(
      {
        name: updateGroupDto.name,
        description: updateGroupDto.description,
      },
      group.id,
      workspaceId,
    );

    const changes = diffAuditTrackedFields(
      ['name', 'description'],
      updateGroupDto,
      groupBefore,
      group,
    );

    if (changes) {
      this.auditService.log({
        event: AuditEvent.GROUP_UPDATED,
        resourceType: AuditResource.GROUP,
        resourceId: group.id,
        changes,
      });
    }

    return group;
  }

  async getWorkspaceGroups(
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<CursorPaginationResult<Group>> {
    return this.groupRepo.getGroupsPaginated(workspaceId, paginationOptions);
  }

  async deleteGroup(groupId: string, workspaceId: string): Promise<void> {
    const group = await this.findAndValidateGroup(groupId, workspaceId);
    if (group.isDefault) {
      throw new BadRequestException('You cannot delete a default group');
    }

    const [userIds, groupAccess] = await Promise.all([
      this.groupUserRepo.getUserIdsByGroupId(groupId),
      this.groupUserService.getGroupAccess([groupId]),
    ]);

    // TODO: use queue instead
    await executeTx(this.db, async (trx) => {
      await this.groupRepo.delete(groupId, workspaceId, { trx });
      await this.groupUserService.removeWatchersAndFavoritesWithoutAccess(
        userIds,
        groupAccess.spaceIds,
        trx,
      );
    });

    await this.groupUserService.revokeRealtimeAccess(userIds, groupAccess);

    this.auditService.log({
      event: AuditEvent.GROUP_DELETED,
      resourceType: AuditResource.GROUP,
      resourceId: groupId,
      changes: {
        before: {
          name: group.name,
          description: group.description,
        },
      },
    });
  }

  async findAndValidateGroup(
    groupId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<Group> {
    const group = await this.groupRepo.findById(groupId, workspaceId, {
      trx,
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }
}
