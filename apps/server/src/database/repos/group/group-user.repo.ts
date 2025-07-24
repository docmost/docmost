import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx, executeTx } from '@docmost/db/utils';
import { sql } from 'kysely';
import { GroupUser, InsertableGroupUser } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '../../pagination/pagination-options';
import { executeWithPagination } from '@docmost/db/pagination/pagination';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

@Injectable()
export class GroupUserRepo {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly groupRepo: GroupRepo,
    private readonly userRepo: UserRepo,
  ) {}

  async getGroupUserById(
    userId: string,
    groupId: string,
    trx?: KyselyTransaction,
  ) {
    const db = dbOrTx(this.db, trx);
    return db
      .selectFrom('groupUsers')
      .selectAll()
      .where('userId', '=', userId)
      .where('groupId', '=', groupId)
      .executeTakeFirst();
  }

  async insertGroupUser(
    insertableGroupUser: InsertableGroupUser,
    trx?: KyselyTransaction,
  ): Promise<GroupUser> {
    const db = dbOrTx(this.db, trx);
    return db
      .insertInto('groupUsers')
      .values(insertableGroupUser)
      .returningAll()
      .executeTakeFirst();
  }

  async getGroupUsersPaginated(groupId: string, pagination: PaginationOptions) {
    let query = this.db
      .selectFrom('groupUsers')
      .innerJoin('users', 'users.id', 'groupUsers.userId')
      .selectAll('users')
      .where('groupId', '=', groupId)
      .orderBy('createdAt', 'asc');

    if (pagination.query) {
      query = query.where((eb) =>
        eb(sql`f_unaccent(users.name)`, 'ilike', sql`f_unaccent(${'%' + pagination.query + '%'})`),
      );
    }

    const result = await executeWithPagination(query, {
      page: pagination.page,
      perPage: pagination.limit,
    });

    result.items.map((user) => {
      delete user.password;
    });

    return result;
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
        const group = await this.groupRepo.findById(groupId, workspaceId, {
          trx,
        });
        if (!group) {
          throw new NotFoundException('Group not found');
        }

        const user = await this.userRepo.findById(userId, workspaceId, {
          trx: trx,
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        const groupUserExists = await this.getGroupUserById(
          userId,
          groupId,
          trx,
        );

        if (groupUserExists) {
          throw new BadRequestException(
            'User is already a member of this group',
          );
        }

        await this.insertGroupUser(
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
        await this.insertGroupUser(
          {
            userId,
            groupId: defaultGroup.id,
          },
          trx,
        );
      },
      trx,
    );
  }

  async delete(userId: string, groupId: string): Promise<void> {
    await this.db
      .deleteFrom('groupUsers')
      .where('userId', '=', userId)
      .where('groupId', '=', groupId)
      .execute();
  }
}
