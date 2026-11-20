import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';
import { User } from '@docmost/db/types/entity.types';
import { isUserDisabled } from '../../common/helpers/utils';
import {
  ProfileViewer,
  UserProfile,
  UserProfileSpace,
  UserRecentPage,
} from './user.types';

@Injectable()
export class UserProfileService {
  constructor(
    private readonly userRepo: UserRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pageRepo: PageRepo,
  ) {}

  async getProfile(
    targetUserId: string,
    viewer: ProfileViewer,
  ): Promise<UserProfile> {
    const user = await this.findVisibleUser(targetUserId, viewer);

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      email: user.deletedAt ? null : user.email,
      role: user.role,
      deactivatedAt: user.deactivatedAt,
      deletedAt: user.deletedAt,
    };
  }

  async getSpaces(
    targetUserId: string,
    viewer: ProfileViewer,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<UserProfileSpace>> {
    await this.findVisibleUser(targetUserId, viewer);

    const result = await this.spaceMemberRepo.getSharedSpacesPaginated(
      targetUserId,
      viewer.userId,
      viewer.workspaceId,
      pagination,
    );

    return {
      items: result.items.map((space) => ({
        id: space.id,
        name: space.name,
        slug: space.slug,
        logo: space.logo,
      })),
      meta: result.meta,
    };
  }

  async getRecentPages(
    targetUserId: string,
    viewer: ProfileViewer,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<UserRecentPage>> {
    await this.findVisibleUser(targetUserId, viewer);

    return this.pageRepo.getRecentPagesByUser(
      targetUserId,
      viewer.userId,
      viewer.workspaceId,
      pagination,
    );
  }

  private async findVisibleUser(
    targetUserId: string,
    viewer: ProfileViewer,
  ): Promise<User> {
    const user = await this.userRepo.findById(targetUserId, viewer.workspaceId);

    if (!user || (isUserDisabled(user) && !viewer.canManageMembers)) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
