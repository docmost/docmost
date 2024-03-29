import { BadRequestException, Injectable } from '@nestjs/common';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { GroupService } from './group.service';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { User } from '@docmost/db/types/entity.types';

@Injectable()
export class GroupUserService {
  constructor(
    private groupRepo: GroupRepo,
    private groupUserRepo: GroupUserRepo,
    private groupService: GroupService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async getGroupUsers(
    groupId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginatedResult<User>> {
    await this.groupService.findAndValidateGroup(groupId, workspaceId);

    const { users, count } = await this.groupUserRepo.getGroupUsersPaginated(
      groupId,
      paginationOptions,
    );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });

    return new PaginatedResult(users, paginationMeta);
  }

  async addUserToDefaultGroup(
    userId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await executeTx(
      this.db,
      async (trx) => {
        const defaultGroup = await this.groupRepo.getDefaultGroup(
          workspaceId,
          trx,
        );
        await this.addUserToGroup(userId, defaultGroup.id, workspaceId, trx);
      },
      trx,
    );
  }

  async addUserToGroup(
    userId: string,
    groupId: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await executeTx(
      this.db,
      async (trx) => {
        await this.groupService.findAndValidateGroup(groupId, workspaceId);
        const groupUserExists = await this.groupUserRepo.getGroupUserById(
          userId,
          groupId,
          trx,
        );

        if (groupUserExists) {
          throw new BadRequestException(
            'User is already a member of this group',
          );
        }

        await this.groupUserRepo.insertGroupUser(
          {
            userId,
            groupId,
          },
          trx,
        );
      },
      trx,
    );
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

    await this.groupUserRepo.delete(userId, groupId);
  }
}
