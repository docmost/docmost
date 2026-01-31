import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  PagePermissionMember,
  PagePermissionRepo,
} from '@docmost/db/repos/page/page-permission.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import {
  AddPagePermissionDto,
  RemovePagePermissionDto,
  UpdatePagePermissionRoleDto,
} from '../dto/page-permission.dto';
import { Page, User } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  PageAccessLevel,
  PagePermissionRole,
} from '../../../common/helpers/types/permission';
import { executeTx } from '@docmost/db/utils';
import SpaceAbilityFactory from '../../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../casl/interfaces/space-ability.type';
import {
  CursorPaginationResult,
  emptyCursorPaginationResult,
} from '@docmost/db/pagination/cursor-pagination';

export type PageRestrictionInfo = {
  id: string;
  title: string;
  hasDirectRestriction: boolean;
  hasInheritedRestriction: boolean;
  userAccess: {
    canView: boolean;
    canEdit: boolean;
    canManage: boolean;
  };
};

@Injectable()
export class PagePermissionService {
  constructor(
    private pagePermissionRepo: PagePermissionRepo,
    private pageRepo: PageRepo,
    private spaceAbility: SpaceAbilityFactory,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async restrictPage(
    pageId: string,
    authUser: User,
    workspaceId: string,
  ): Promise<void> {
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.validateWriteAccess(page, authUser);

    const existingAccess =
      await this.pagePermissionRepo.findPageAccessByPageId(pageId);
    if (existingAccess) {
      throw new BadRequestException('Page is already restricted');
    }

    await executeTx(this.db, async (trx) => {
      const pageAccess = await this.pagePermissionRepo.insertPageAccess(
        {
          pageId: pageId,
          workspaceId: workspaceId,
          accessLevel: PageAccessLevel.RESTRICTED,
          creatorId: authUser.id,
        },
        trx,
      );

      await this.pagePermissionRepo.insertPagePermissions(
        [
          {
            pageAccessId: pageAccess.id,
            userId: authUser.id,
            role: PagePermissionRole.WRITER,
            addedById: authUser.id,
          },
        ],
        trx,
      );
    });
  }

  async addPagePermissions(
    dto: AddPagePermissionDto,
    authUser: User,
    workspaceId: string,
  ): Promise<void> {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.validateWriteAccess(page, authUser);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      dto.pageId,
    );
    if (!pageAccess) {
      throw new BadRequestException(
        'Page is not restricted. Restrict the page first.',
      );
    }

    let validUsers = [];
    let validGroups = [];

    if (dto.userIds && dto.userIds.length > 0) {
      validUsers = await this.db
        .selectFrom('users')
        .select(['id'])
        .where('id', 'in', dto.userIds)
        .where('workspaceId', '=', workspaceId)
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom('pagePermissions')
                .select('id')
                .whereRef('pagePermissions.userId', '=', 'users.id')
                .where('pagePermissions.pageAccessId', '=', pageAccess.id),
            ),
          ),
        )
        .execute();
    }

    if (dto.groupIds && dto.groupIds.length > 0) {
      validGroups = await this.db
        .selectFrom('groups')
        .select(['id'])
        .where('id', 'in', dto.groupIds)
        .where('workspaceId', '=', workspaceId)
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom('pagePermissions')
                .select('id')
                .whereRef('pagePermissions.groupId', '=', 'groups.id')
                .where('pagePermissions.pageAccessId', '=', pageAccess.id),
            ),
          ),
        )
        .execute();
    }

    const permissionsToAdd = [];

    for (const user of validUsers) {
      permissionsToAdd.push({
        pageAccessId: pageAccess.id,
        userId: user.id,
        role: dto.role,
        addedById: authUser.id,
      });
    }

    for (const group of validGroups) {
      permissionsToAdd.push({
        pageAccessId: pageAccess.id,
        groupId: group.id,
        role: dto.role,
        addedById: authUser.id,
      });
    }

    if (permissionsToAdd.length > 0) {
      await this.pagePermissionRepo.insertPagePermissions(permissionsToAdd);
    }
  }

  async removePagePermissions(
    dto: RemovePagePermissionDto,
    authUser: User,
  ): Promise<void> {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.validateWriteAccess(page, authUser);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      dto.pageId,
    );
    if (!pageAccess) {
      throw new BadRequestException('Page is not restricted');
    }

    const userIds = dto.userIds ?? [];
    const groupIds = dto.groupIds ?? [];

    if (userIds.length > 0) {
      await this.pagePermissionRepo.deletePagePermissionsByUserIds(
        pageAccess.id,
        userIds,
      );
    }

    if (groupIds.length > 0) {
      await this.pagePermissionRepo.deletePagePermissionsByGroupIds(
        pageAccess.id,
        groupIds,
      );
    }

    const writerCount =
      await this.pagePermissionRepo.countWritersByPageAccessId(pageAccess.id);
    if (writerCount < 1) {
      throw new BadRequestException(
        'There must be at least one user with "Can edit" permission',
      );
    }
  }

  async updatePagePermissionRole(
    dto: UpdatePagePermissionRoleDto,
    authUser: User,
  ): Promise<void> {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.validateWriteAccess(page, authUser);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      dto.pageId,
    );
    if (!pageAccess) {
      throw new BadRequestException('Page is not restricted');
    }

    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('Please provide a userId or groupId');
    }

    if (dto.userId) {
      const permission =
        await this.pagePermissionRepo.findPagePermissionByUserId(
          pageAccess.id,
          dto.userId,
        );
      if (!permission) {
        throw new NotFoundException('Permission not found');
      }

      if (permission.role === dto.role) {
        return;
      }

      if (permission.role === PagePermissionRole.WRITER) {
        await this.validateLastWriter(pageAccess.id);
      }

      await this.pagePermissionRepo.updatePagePermissionRole(
        pageAccess.id,
        dto.role,
        { userId: dto.userId },
      );
    } else if (dto.groupId) {
      const permission =
        await this.pagePermissionRepo.findPagePermissionByGroupId(
          pageAccess.id,
          dto.groupId,
        );
      if (!permission) {
        throw new NotFoundException('Permission not found');
      }

      if (permission.role === dto.role) {
        return;
      }

      if (permission.role === PagePermissionRole.WRITER) {
        await this.validateLastWriter(pageAccess.id);
      }

      await this.pagePermissionRepo.updatePagePermissionRole(
        pageAccess.id,
        dto.role,
        { groupId: dto.groupId },
      );
    }
  }

  async removePageRestriction(pageId: string, authUser: User): Promise<void> {
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.validateWriteAccess(page, authUser);

    const pageAccess =
      await this.pagePermissionRepo.findPageAccessByPageId(pageId);
    if (!pageAccess) {
      throw new BadRequestException('Page is not restricted');
    }

    await this.pagePermissionRepo.deletePageAccess(pageId);
  }

  async getPagePermissions(
    pageId: string,
    authUser: User,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<PagePermissionMember>> {
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(
      authUser,
      page.spaceId,
    );
    // user must be a space member
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    // user must not have any restriction to view this page
    const canView = await this.canViewPage(authUser.id, pageId);
    if (!canView) {
      throw new ForbiddenException();
    }

    const pageAccess =
      await this.pagePermissionRepo.findPageAccessByPageId(pageId);
    if (!pageAccess) {
      return emptyCursorPaginationResult(pagination.limit);
    }

    return this.pagePermissionRepo.getPagePermissionsPaginated(
      pageAccess.id,
      pagination,
    );
  }

  /**
   * Get page restriction info for the current user.
   *
   * Security: User must be a space member. Returns 404 for pages the user cannot view
   * to avoid leaking existence of restricted pages.
   *
   * Performance: Uses single optimized query to get all restriction/access data.
   */
  async getPageRestrictionInfo(
    pageId: string,
    authUser: User,
  ): Promise<PageRestrictionInfo> {
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(
      authUser,
      page.spaceId,
    );

    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const {
      hasDirectRestriction,
      hasInheritedRestriction,
      canAccess,
      canEdit,
    } = await this.pagePermissionRepo.getUserPageAccessLevel(
      authUser.id,
      pageId,
    );

    // Security: return 404 to avoid leaking existence of restricted pages
    if (!canAccess) {
      throw new NotFoundException('Permission not found');
    }

    const canManage = this.computeCanManage(ability, canEdit, canAccess);

    return {
      id: page.id,
      title: page.title,
      hasDirectRestriction,
      hasInheritedRestriction,
      userAccess: {
        canView: canAccess,
        canEdit,
        canManage,
      },
    };
  }

  /**
   * Compute if user can manage page permissions based on precomputed access values.
   * Mirrors validateWriteAccess logic without throwing.
   */
  private computeCanManage(
    ability: Awaited<ReturnType<SpaceAbilityFactory['createForUser']>>,
    canEdit: boolean,
    canView: boolean,
  ): boolean {
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      return false;
    }

    if (canEdit) {
      return true;
    }

    const isSpaceAdmin = ability.can(
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Page,
    );

    return isSpaceAdmin && canView;
  }

  async validateLastWriter(pageAccessId: string): Promise<void> {
    const writerCount =
      await this.pagePermissionRepo.countWritersByPageAccessId(pageAccessId);
    if (writerCount <= 1) {
      throw new BadRequestException(
        'There must be at least one user with "Can edit" permission',
      );
    }
  }

  /**
   * Validate if user can manage page permissions (restrict, add/remove members, etc.)
   *
   * Requirements:
   * 1. User must have space-level Edit permission (minimum baseline)
   * 2. For restricted pages, user must have one of:
   *    - Page-level Writer permission on all restricted ancestors
   *    - Space Admin role + at least page-level Reader permission (admin elevates)
   */
  async validateWriteAccess(page: Page, user: User): Promise<void> {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);

    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const canEdit = await this.canEditPage(user.id, page.id);
    if (canEdit) {
      return;
    }

    const isSpaceAdmin = ability.can(
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Page,
    );
    if (isSpaceAdmin) {
      const canView = await this.canViewPage(user.id, page.id);
      if (canView) {
        return;
      }
    }

    throw new ForbiddenException();
  }

  /**
   * Check if user can view a page.
   * User must have permission (reader or writer) on EVERY restricted ancestor.
   * Returns true if:
   * - No ancestors are restricted (defer to space permission)
   * - User has permission on all restricted ancestors
   */
  async canViewPage(userId: string, pageId: string): Promise<boolean> {
    return this.pagePermissionRepo.canUserAccessPage(userId, pageId);
  }

  /**
   * Check if user can edit a page.
   * User must have WRITER permission on EVERY restricted ancestor.
   * Returns true if:
   * - No ancestors are restricted (defer to space permission)
   * - User has writer permission on all restricted ancestors
   */
  async canEditPage(userId: string, pageId: string): Promise<boolean> {
    return this.pagePermissionRepo.canUserEditPage(userId, pageId);
  }

  /**
   * Check if user has writer permission on ALL restricted ancestors of a page.
   * Used for permission management operations.
   */
  async hasWritePermission(userId: string, pageId: string): Promise<boolean> {
    const hasRestriction =
      await this.pagePermissionRepo.hasRestrictedAncestor(pageId);

    if (!hasRestriction) {
      return false; // no restrictions, defer to space permissions
    }

    return this.pagePermissionRepo.canUserEditPage(userId, pageId);
  }

  async hasPageAccess(pageId: string): Promise<boolean> {
    const pageAccess =
      await this.pagePermissionRepo.findPageAccessByPageId(pageId);
    return !!pageAccess;
  }
}
