import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
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

    const ability = await this.spaceAbility.createForUser(authUser, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    // TODO: does this check if any of the page's ancestor's is restricted and the user don't have access to it?
    // to have access to this page, they must already have access to the page if any of it's ancestor's is restricted

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

  async removePagePermission(
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

    if (!dto.userId && !dto.groupId) {
      throw new BadRequestException('Please provide a userId or groupId');
    }

    if (dto.userId) {
      const permission = await this.pagePermissionRepo.findPagePermissionByUserId(
        pageAccess.id,
        dto.userId,
      );
      if (!permission) {
        throw new NotFoundException('Permission not found');
      }

      if (permission.role === PagePermissionRole.WRITER) {
        await this.validateLastWriter(pageAccess.id);
      }

      await this.pagePermissionRepo.deletePagePermissionByUserId(
        pageAccess.id,
        dto.userId,
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

      if (permission.role === PagePermissionRole.WRITER) {
        await this.validateLastWriter(pageAccess.id);
      }

      await this.pagePermissionRepo.deletePagePermissionByGroupId(
        pageAccess.id,
        dto.groupId,
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
  ) {
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(authUser, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const pageAccess =
      await this.pagePermissionRepo.findPageAccessByPageId(pageId);
    if (!pageAccess) {
      return {
        items: [],
        pagination: {
          page: 1,
          perPage: pagination.limit,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    return this.pagePermissionRepo.getPagePermissionsPaginated(
      pageAccess.id,
      pagination,
    );
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

  async validateWriteAccess(page: Page, user: User): Promise<void> {
    const hasWritePermission = await this.hasWritePermission(user.id, page.id);
    if (hasWritePermission) {
      return;
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
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
   * Filter page IDs to only those the user can access.
   */
  async filterAccessiblePages(
    pageIds: string[],
    userId: string,
  ): Promise<string[]> {
    return this.pagePermissionRepo.filterAccessiblePageIds(pageIds, userId);
  }

  /**
   * Validate user can view page, throws ForbiddenException if not.
   * Checks both space-level and page-level permissions.
   */
  async validateCanView(page: Page, user: User): Promise<void> {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const canView = await this.canViewPage(user.id, page.id);
    if (!canView) {
      throw new ForbiddenException();
    }
  }

  /**
   * Validate user can edit page, throws ForbiddenException if not.
   * Checks both space-level and page-level permissions.
   */
  async validateCanEdit(page: Page, user: User): Promise<void> {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    const canEdit = await this.canEditPage(user.id, page.id);
    if (!canEdit) {
      throw new ForbiddenException();
    }
  }
}
