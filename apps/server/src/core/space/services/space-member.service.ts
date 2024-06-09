import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { AddSpaceMembersDto } from '../dto/add-space-members.dto';
import { InjectKysely } from 'nestjs-kysely';
import { Space, SpaceMember, User } from '@docmost/db/types/entity.types';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { RemoveSpaceMemberDto } from '../dto/remove-space-member.dto';
import { UpdateSpaceMemberRoleDto } from '../dto/update-space-member-role.dto';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { PaginationResult } from '@docmost/db/pagination/pagination';

@Injectable()
export class SpaceMemberService {
  constructor(
    private spaceMemberRepo: SpaceMemberRepo,
    private spaceRepo: SpaceRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async addUserToSpace(
    userId: string,
    spaceId: string,
    role: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    //if (existingSpaceUser) {
    //           throw new BadRequestException('User already added to this space');
    //         }
    await this.spaceMemberRepo.insertSpaceMember(
      {
        userId: userId,
        spaceId: spaceId,
        role: role,
      },
      trx,
    );
  }

  async addGroupToSpace(
    groupId: string,
    spaceId: string,
    role: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await this.spaceMemberRepo.insertSpaceMember(
      {
        groupId: groupId,
        spaceId: spaceId,
        role: role,
      },
      trx,
    );
  }

  /*
   * get members of a space.
   * can be a group or user
   */
  async getSpaceMembers(
    spaceId: string,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    const space = await this.spaceRepo.findById(spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    const members = await this.spaceMemberRepo.getSpaceMembersPaginated(
      spaceId,
      pagination,
    );

    return members;
  }

  async addMembersToSpaceBatch(
    dto: AddSpaceMembersDto,
    authUser: User,
    workspaceId: string,
  ): Promise<void> {
    // await this.spaceService.findAndValidateSpace(spaceId, workspaceId);

    const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    // make sure we have valid workspace users
    const validUsersQuery = this.db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('users.id', 'in', dto.userIds)
      .where('users.workspaceId', '=', workspaceId)
      // using this because we can not use easily use onConflict with two unique indexes.
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('spaceMembers')
              .select('id')
              .whereRef('spaceMembers.userId', '=', 'users.id')
              .where('spaceMembers.spaceId', '=', dto.spaceId),
          ),
        ),
      );

    const validGroupsQuery = this.db
      .selectFrom('groups')
      .select(['id', 'name'])
      .where('groups.id', 'in', dto.groupIds)
      .where('groups.workspaceId', '=', workspaceId)
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('spaceMembers')
              .select('id')
              .whereRef('spaceMembers.groupId', '=', 'groups.id')
              .where('spaceMembers.spaceId', '=', dto.spaceId),
          ),
        ),
      );

    let validUsers = [],
      validGroups = [];
    if (dto.userIds && dto.userIds.length > 0) {
      validUsers = await validUsersQuery.execute();
    }
    if (dto.groupIds && dto.groupIds.length > 0) {
      validGroups = await validGroupsQuery.execute();
    }

    const usersToAdd = [];
    for (const user of validUsers) {
      usersToAdd.push({
        spaceId: dto.spaceId,
        userId: user.id,
        role: dto.role,
        addedById: authUser.id,
      });
    }

    const groupsToAdd = [];
    for (const group of validGroups) {
      groupsToAdd.push({
        spaceId: dto.spaceId,
        groupId: group.id,
        role: dto.role,
        addedById: authUser.id,
      });
    }

    const membersToAdd = [...usersToAdd, ...groupsToAdd];

    if (membersToAdd.length > 0) {
      await this.spaceMemberRepo.insertSpaceMember(membersToAdd);
    } else {
      // either they are already members or do not exist on the workspace
    }
  }

  async removeMemberFromSpace(
    dto: RemoveSpaceMemberDto,
    workspaceId: string,
  ): Promise<void> {
    const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    let spaceMember: SpaceMember = null;

    if (dto.userId) {
      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
        dto.spaceId,
        {
          userId: dto.userId,
        },
      );
    } else if (dto.groupId) {
      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
        dto.spaceId,
        {
          groupId: dto.groupId,
        },
      );
    } else {
      throw new BadRequestException(
        'Please provide a valid userId or groupId to remove',
      );
    }

    if (!spaceMember) {
      throw new NotFoundException('Space membership not found');
    }

    if (spaceMember.role === SpaceRole.ADMIN) {
      await this.validateLastAdmin(dto.spaceId);
    }

    await this.spaceMemberRepo.removeSpaceMemberById(
      spaceMember.id,
      dto.spaceId,
    );
  }

  async updateSpaceMemberRole(
    dto: UpdateSpaceMemberRoleDto,
    workspaceId: string,
  ): Promise<void> {
    const space = await this.spaceRepo.findById(dto.spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    let spaceMember: SpaceMember = null;

    if (dto.userId) {
      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
        dto.spaceId,
        {
          userId: dto.userId,
        },
      );
    } else if (dto.groupId) {
      spaceMember = await this.spaceMemberRepo.getSpaceMemberByTypeId(
        dto.spaceId,
        {
          groupId: dto.groupId,
        },
      );
    } else {
      throw new BadRequestException(
        'Please provide a valid userId or groupId to remove',
      );
    }

    if (!spaceMember) {
      throw new NotFoundException('Space membership not found');
    }

    if (spaceMember.role === dto.role) {
      return;
    }

    if (spaceMember.role === SpaceRole.ADMIN) {
      await this.validateLastAdmin(dto.spaceId);
    }

    await this.spaceMemberRepo.updateSpaceMember(
      { role: dto.role },
      spaceMember.id,
      dto.spaceId,
    );
  }

  async validateLastAdmin(spaceId: string): Promise<void> {
    const spaceOwnerCount = await this.spaceMemberRepo.roleCountBySpaceId(
      SpaceRole.ADMIN,
      spaceId,
    );
    if (spaceOwnerCount === 1) {
      throw new BadRequestException(
        'There must be at least one space admin with full access',
      );
    }
  }

  async getUserSpaces(
    userId: string,
    pagination: PaginationOptions,
  ): Promise<PaginationResult<Space>> {
    return await this.spaceMemberRepo.getUserSpaces(userId, pagination);
  }
}
