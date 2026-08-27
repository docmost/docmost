import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { GroupService } from './group.service';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { InjectKysely } from 'nestjs-kysely';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { executeTx } from '@docmost/db/utils';
import { WatcherRepo } from '@docmost/db/repos/watcher/watcher.repo';
import { FavoriteRepo } from '@docmost/db/repos/favorite/favorite.repo';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import { dbOrTx } from '@docmost/db/utils';

@Injectable()
export class GroupUserService {
  constructor(
    private groupUserRepo: GroupUserRepo,
    private spaceMemberRepo: SpaceMemberRepo,
    private userRepo: UserRepo,
    @Inject(forwardRef(() => GroupService))
    private groupService: GroupService,
    private readonly watcherRepo: WatcherRepo,
    private readonly favoriteRepo: FavoriteRepo,
    @InjectKysely() private readonly db: KyselyDB,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getGroupUsers(
    groupId: string,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    await this.groupService.findAndValidateGroup(groupId, workspaceId);

    const groupUsers = await this.groupUserRepo.getGroupUsersPaginated(
      groupId,
      pagination,
    );

    return groupUsers;
  }

  async addUsersToGroupBatch(
    userIds: string[],
    groupId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
    opts?: { source?: 'manual' | 'google' },
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await this.groupService.findAndValidateGroup(groupId, workspaceId, trx);

    if (userIds.length === 0) return;

    // make sure we have valid workspace users
    const validUsers = await db
      .selectFrom('users')
      .select(['id', 'name'])
      .where('users.id', 'in', userIds)
      .where('users.workspaceId', '=', workspaceId)
      .execute();

    if (validUsers.length === 0) return;

    // prepare users to add to group
    const source = opts?.source ?? 'manual';
    const groupUsersToInsert = [];
    for (const user of validUsers) {
      groupUsersToInsert.push({
        userId: user.id,
        groupId: groupId,
        source,
        syncedAt: source === 'manual' ? null : new Date(),
      });
    }

    // batch insert new group users
    await db
      .insertInto('groupUsers')
      .values(groupUsersToInsert)
      .onConflict((oc) => oc.columns(['userId', 'groupId']).doNothing())
      .execute();

    for (const user of validUsers) {
      this.auditService.log({
        event: AuditEvent.GROUP_MEMBER_ADDED,
        resourceType: AuditResource.GROUP,
        resourceId: groupId,
        changes: {
          after: {
            userId: user.id,
            userName: user.name,
          },
        },
      });
    }
  }

  /**
   * Deletes memberships and cleans up watchers/favorites for users who lose
   * access to the group's spaces as a result. Shared by the manual removal
   * path and by Google group sync, so both stay consistent.
   */
  async removeUsersFromGroupBatch(
    userIds: string[],
    groupId: string,
  ): Promise<void> {
    if (userIds.length === 0) return;

    const spaceIds = await this.spaceMemberRepo.getSpaceIdsByGroupId(groupId);

    // TODO: use queue instead
    await executeTx(this.db, async (trx) => {
      for (const userId of userIds) {
        await this.groupUserRepo.delete(userId, groupId, { trx });
      }

      for (const spaceId of spaceIds) {
        await this.watcherRepo.deleteByUsersWithoutSpaceAccess(
          userIds,
          spaceId,
          { trx },
        );

        await this.favoriteRepo.deleteByUsersWithoutSpaceAccess(
          userIds,
          spaceId,
          { trx },
        );
      }
    });
  }

  async removeUserFromGroup(
    userId: string,
    groupId: string,
    workspaceId: string,
  ): Promise<void> {
    const group = await this.groupService.findAndValidateGroup(
      groupId,
      workspaceId,
    );

    const user = await this.userRepo.findById(userId, workspaceId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (group.isDefault) {
      throw new BadRequestException(
        'You cannot remove users from a default group',
      );
    }

    const groupUser = await this.groupUserRepo.getGroupUserById(
      userId,
      groupId,
    );

    if (!groupUser) {
      throw new BadRequestException('Group member not found');
    }

    await this.removeUsersFromGroupBatch([userId], groupId);

    this.auditService.log({
      event: AuditEvent.GROUP_MEMBER_REMOVED,
      resourceType: AuditResource.GROUP,
      resourceId: groupId,
      changes: {
        before: {
          userId: user.id,
          userName: user.name,
        },
      },
      metadata: {
        groupName: group.name,
      },
    });
  }
}
