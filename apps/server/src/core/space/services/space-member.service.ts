import { Injectable } from '@nestjs/common';
import { PaginationOptions } from '../../../helpers/pagination/pagination-options';
import { PaginationMetaDto } from '../../../helpers/pagination/pagination-meta-dto';
import { PaginatedResult } from '../../../helpers/pagination/paginated-result';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { SpaceMember } from '@docmost/db/types/entity.types';

@Injectable()
export class SpaceMemberService {
  constructor(private spaceMemberRepo: SpaceMemberRepo) {}

  async addUserToSpace(
    userId: string,
    spaceId: string,
    role: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<SpaceMember> {
    //if (existingSpaceUser) {
    //           throw new BadRequestException('User already added to this space');
    //         }
    return await this.spaceMemberRepo.insertSpaceMember(
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
  ): Promise<SpaceMember> {
    //const existingSpaceUser = await manager.findOneBy(SpaceMember, {
    //           userId: userId,
    //           spaceId: spaceId,
    //         });
    // validations?
    return await this.spaceMemberRepo.insertSpaceMember(
      {
        groupId: groupId,
        spaceId: spaceId,
        role: role,
      },
      trx,
    );
  }

  /*
   * get spaces a user is a member of
   * either by direct membership or via groups
   */
  /*
  async getUserSpaces(
    userId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    const [userSpaces, count] = await this.spaceMemberRepository
      .createQueryBuilder('spaceMember')
      .leftJoinAndSelect('spaceMember.space', 'space')
      .where('spaceMember.userId = :userId', { userId })
      .andWhere('space.workspaceId = :workspaceId', { workspaceId })
      .loadRelationCountAndMap(
        'space.memberCount',
        'space.spaceMembers',
        'spaceMembers',
      )
      .take(paginationOptions.limit)
      .skip(paginationOptions.skip)
      .getManyAndCount();

    const spaces = userSpaces.map((userSpace) => userSpace.space);

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(spaces, paginationMeta);
  }
*/

  /*
   * get members of a space.
   * can be a group or user
   */
  async getSpaceMembers(
    spaceId: string,
    workspaceId: string,
    paginationOptions: PaginationOptions,
  ) {
    //todo: validate the space is inside the workspace
    const { members, count } =
      await this.spaceMemberRepo.getSpaceMembersPaginated(
        spaceId,
        paginationOptions,
      );

    const paginationMeta = new PaginationMetaDto({ count, paginationOptions });
    return new PaginatedResult(members, paginationMeta);
  }
}
// 231 lines
