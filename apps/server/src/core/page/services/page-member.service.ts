import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import {
  PagePermissionRepo,
  PageMemberRole,
} from '@docmost/db/repos/page/page-permission-repo.service';
import { SharedPagesRepo } from '@docmost/db/repos/page/shared-pages.repo';
import { AddPageMembersDto } from '../dto/add-page-members.dto';
import { InjectKysely } from 'nestjs-kysely';
import { Page, PagePermission, User } from '@docmost/db/types/entity.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { RemovePageMemberDto } from '../dto/remove-page-member.dto';
import { UpdatePageMemberRoleDto } from '../dto/update-page-member-role.dto';
import { UpdatePagePermissionDto } from '../dto/update-page-permission.dto';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { executeTx } from '@docmost/db/utils';

export interface IPagePermission {
  id: string;
  cascade: boolean;
  member: {
    id: string;
    type: 'user' | 'group' | 'public';
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    workspaceRole?: string;
    name?: string;
    memberCount?: number;
  };
  membershipRole: {
    id: string;
    level: string;
    source: 'direct' | 'inherited';
  };
  grantedBy: {
    id: string;
    type: 'page' | 'space';
    title?: string;
    name?: string;
    parentId?: string;
  };
}

export interface PagePermissionsResponse {
  page: {
    id: string;
    title: string;
    hasCustomPermissions: boolean;
    inheritPermissions: boolean;
    permissions: IPagePermission[];
  };
}

@Injectable()
export class PagePermissionService {
  constructor(
    private pageMemberRepo: PagePermissionRepo,
    private pageRepo: PageRepo,
    private sharedPagesRepo: SharedPagesRepo,
    private userRepo: UserRepo,
    private groupRepo: GroupRepo,
    private spaceMemberRepo: SpaceMemberRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async addUserToPage(
    userId: string,
    pageId: string,
    role: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await this.pageMemberRepo.insertPageMember(
      {
        userId: userId,
        pageId: pageId,
        role: role,
      },
      trx,
    );
  }

  async addGroupToPage(
    groupId: string,
    pageId: string,
    role: string,
    workspaceId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await this.pageMemberRepo.insertPageMember(
      {
        groupId: groupId,
        pageId: pageId,
        role: role,
      },
      trx,
    );
  }

  async getPageMembers(
    pageId: string,
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    const page = await this.pageRepo.findById(pageId);
    // const page = await this.pageRepo.findById(pageId, { workspaceId });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const members = await this.pageMemberRepo.getPageMembersPaginated(
      pageId,
      pagination,
    );

    return members;
  }

  async restrictPage(authUser: User, pageId: string) {
    // to add custom permissions to a page,
    // we have to restrict the page first.
    // the user is here because they can restrict this page
    // TODO: make sure page is not in trash
    // Not sure if normal users can see restricted pages in trash.
    await this.db
      .updateTable('pages')
      .set({
        isRestricted: true,
        restrictedById: authUser.id,
      })
      .where('id', '=', pageId)
      .execute();
  }

  async addMembersToPageBatch(
    dto: AddPageMembersDto,
    authUser: User,
    workspaceId: string,
  ): Promise<void> {
    try {
      const page = await this.pageRepo.findById(dto.pageId);
      //const page = await this.pageRepo.findById(dto.pageId, { workspaceId });

      if (!page) {
        throw new NotFoundException('Page not found');
      }

      // Validate role
      if (!Object.values(PageMemberRole).includes(dto.role as PageMemberRole)) {
        throw new BadRequestException(`Invalid role: ${dto.role}`);
      }

      // Enable custom permissions if adding first member
      /*if (!page.hasCustomPermissions) {
        await this.pageRepo.update(dto.pageId, {
          hasCustomPermissions: true,
          inheritPermissions: false,
        });
      }*/

      // Make sure we have valid workspace users
      const validUsersQuery = this.db
        .selectFrom('users')
        .select(['id', 'name'])
        .where('users.id', 'in', dto.userIds)
        .where('users.workspaceId', '=', workspaceId)
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom('pagePermissions')
                .select('id')
                .whereRef('pagePermissions.userId', '=', 'users.id')
                .where('pagePermissions.pageId', '=', dto.pageId),
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
              selectFrom('pagePermissions')
                .select('id')
                .whereRef('pagePermissions.groupId', '=', 'groups.id')
                .where('pagePermissions.pageId', '=', dto.pageId),
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
          pageId: dto.pageId,
          userId: user.id,
          role: dto.role,
          addedById: authUser.id,
        });

        // Track orphaned page access if user doesn't have parent access
        if (page.parentPageId && dto.role !== PageMemberRole.NONE) {
          const hasParentAccess = await this.checkParentAccess(
            user.id,
            page.parentPageId,
          );
          if (!hasParentAccess) {
            await this.sharedPagesRepo.addSharedPage(user.id, dto.pageId);
          }
        }
      }

      const groupsToAdd = [];
      for (const group of validGroups) {
        groupsToAdd.push({
          pageId: dto.pageId,
          groupId: group.id,
          role: dto.role,
          addedById: authUser.id,
        });
      }

      const membersToAdd = [...usersToAdd, ...groupsToAdd];
      if (membersToAdd.length > 0) {
        await this.db
          .insertInto('pagePermissions')
          .values(membersToAdd)
          .execute();
      }

      // Apply to child pages if requested
      if (dto.cascade) {
        await this.cascadeToChildren(dto.pageId, membersToAdd);
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to add members to page. Please try again.',
      );
    }
  }

  async removePageMember(
    dto: RemovePageMemberDto,
    workspaceId: string,
  ): Promise<void> {
    const member = await this.db
      .selectFrom('pagePermissions')
      .innerJoin('pages', 'pages.id', 'pagePermissions.pageId')
      .select(['pagePermissions.id', 'pagePermissions.userId'])
      .where('pagePermissions.id', '=', dto.memberId)
      .where('pagePermissions.pageId', '=', dto.pageId)
      .where('pages.workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!member) {
      throw new NotFoundException('Page member not found');
    }

    // Check if this is the last admin
    const adminCount = await this.pageMemberRepo.roleCountByPageId(
      PageMemberRole.ADMIN,
      dto.pageId,
    );

    if (adminCount === 1) {
      const memberToRemove = await this.pageMemberRepo.getPageMemberByTypeId(
        dto.pageId,
        { userId: member.userId },
      );
      if (memberToRemove?.role === PageMemberRole.ADMIN) {
        throw new BadRequestException('Cannot remove the last admin from page');
      }
    }

    await this.pageMemberRepo.removePageMemberById(dto.memberId, dto.pageId);

    // Remove from shared pages if it was tracked
    if (member.userId) {
      await this.sharedPagesRepo.removeSharedPage(member.userId, dto.pageId);
    }
  }

  async updatePageMemberRole(
    dto: UpdatePageMemberRoleDto,
    workspaceId: string,
  ): Promise<void> {
    const member = await this.db
      .selectFrom('pagePermissions')
      .innerJoin('pages', 'pages.id', 'pagePermissions.pageId')
      .select(['pagePermissions.id', 'pagePermissions.role'])
      .where('pagePermissions.id', '=', dto.memberId)
      .where('pagePermissions.pageId', '=', dto.pageId)
      .where('pages.workspaceId', '=', workspaceId)
      .executeTakeFirst();

    if (!member) {
      throw new NotFoundException('Page member not found');
    }

    if (
      member.role === PageMemberRole.ADMIN &&
      dto.role !== PageMemberRole.ADMIN
    ) {
      const adminCount = await this.pageMemberRepo.roleCountByPageId(
        PageMemberRole.ADMIN,
        dto.pageId,
      );
      if (adminCount === 1) {
        throw new BadRequestException('Cannot change role of the last admin');
      }
    }

    await this.pageMemberRepo.updatePageMember(
      { role: dto.role },
      dto.memberId,
      dto.pageId,
    );
  }

  async updatePagePermission(
    dto: UpdatePagePermissionDto,
  ): Promise<PagePermissionsResponse> {
    const { pageId, userId, groupId, role, cascade } = dto;

    try {
      // Validate inputs
      if (!userId && !groupId) {
        throw new BadRequestException(
          'Either userId or groupId must be provided',
        );
      }

      if (userId && groupId) {
        throw new BadRequestException('Cannot provide both userId and groupId');
      }

      if (!Object.values(PageMemberRole).includes(role as PageMemberRole)) {
        throw new BadRequestException(`Invalid role: ${role}`);
      }

      await executeTx(this.db, async (trx) => {
        // Update the role
        if (userId) {
          await this.pageMemberRepo.upsertPageMember(
            {
              pageId,
              userId,
              role,
            },
            trx,
          );
        } else if (groupId) {
          await this.pageMemberRepo.upsertPageMember(
            {
              pageId,
              groupId,
              role,
            },
            trx,
          );
        }

        // Mark page as having custom permissions
        /* await this.pageRepo.update(
          pageId,
          {
            hasCustomPermissions: true,
            inheritPermissions: false,
          },
          trx,
        );*/

        // Cascade to children if requested
        if (cascade) {
          const descendants = await this.pageRepo.getAllDescendants(
            pageId,
            trx,
          );
          for (const childId of descendants) {
            if (userId) {
              await this.pageMemberRepo.upsertPageMember(
                {
                  pageId: childId,
                  userId,
                  role,
                },
                trx,
              );
            } else if (groupId) {
              await this.pageMemberRepo.upsertPageMember(
                {
                  pageId: childId,
                  groupId,
                  role,
                },
                trx,
              );
            }
          }
        }
      });

      // Return comprehensive permission data
      return this.getPagePermissions(pageId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to update page permissions. Please try again.',
      );
    }
  }

  async getPagePermissions(pageId: string): Promise<PagePermissionsResponse> {
    const page = await this.pageRepo.findById(pageId, { includeSpace: true });
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const permissions: IPagePermission[] = [];

    // 1. Get direct page members
    const directMembers = await this.pageMemberRepo.getPageMembers(pageId);

    // Batch fetch all users and groups
    const userIds = directMembers.filter((m) => m.userId).map((m) => m.userId);
    const groupIds = directMembers
      .filter((m) => m.groupId)
      .map((m) => m.groupId);

    const [users, groups] = await Promise.all([
      userIds.length > 0
        ? this.db
            .selectFrom('users')
            .selectAll()
            .where('id', 'in', userIds)
            .execute()
        : Promise.resolve([]),
      groupIds.length > 0
        ? this.db
            .selectFrom('groups')
            .selectAll()
            .where('id', 'in', groupIds)
            .execute()
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u] as const));
    const groupMap = new Map(groups.map((g) => [g.id, g] as const));

    // Build permissions with batch-fetched data
    for (const member of directMembers) {
      let memberData: any = null;

      if (member.userId) {
        const user = userMap.get(member.userId);
        if (user) {
          memberData = {
            id: user.id,
            type: 'user' as const,
            email: user.email,
            displayName: user.name,
            avatarUrl: user.avatarUrl,
            workspaceRole: user.role,
          };
        }
      } else if (member.groupId) {
        const group = groupMap.get(member.groupId);
        if (group) {
          memberData = {
            id: group.id,
            type: 'group' as const,
            name: group.name,
            memberCount: await this.db
              .selectFrom('groupUsers')
              .select((eb) => eb.fn.count('userId').as('count'))
              .where('groupId', '=', group.id)
              .executeTakeFirst()
              .then((result) => Number(result?.count || 0)),
          };
        }
      }

      if (memberData) {
        permissions.push({
          id: member.id,
          cascade: true, // Page permissions cascade by default
          member: memberData,
          membershipRole: {
            id: member.id,
            level: member.role,
            source: 'direct',
          },
          grantedBy: {
            id: pageId,
            type: 'page',
            title: page.title,
          },
        });
      }
    }

    // 2. Get inherited space members (if page inherits)
    if (page) {
      //if (page.inheritPermissions || !page.hasCustomPermissions) {
      const spaceMembers = await this.spaceMemberRepo.getSpaceMembersPaginated(
        page.spaceId,
        { page: 1, limit: 100 },
      );

      for (const spaceMember of spaceMembers.items as any[]) {
        // Skip if user has direct page permission
        const hasDirect = directMembers.some(
          (dm) =>
            (dm.userId === spaceMember.id && spaceMember.type === 'user') ||
            (dm.groupId === spaceMember.id && spaceMember.type === 'group'),
        );
        if (!hasDirect) {
          permissions.push({
            id: `space-${spaceMember.id}`,
            cascade: false, // Space permissions don't cascade to page children
            member: {
              id: spaceMember.id,
              type: spaceMember.type as 'user' | 'group',
              email: spaceMember.email,
              displayName: spaceMember.name,
              avatarUrl: spaceMember.avatarUrl,
              name: spaceMember.name,
              memberCount: Number(spaceMember.memberCount || 0),
            },
            membershipRole: {
              id: `space-role-${spaceMember.id}`,
              level: spaceMember.role,
              source: 'inherited',
            },
            grantedBy: {
              id: page.spaceId,
              type: 'space',
              name: (page as any).space?.name,
            },
          });
        }
      }
    }

    return {
      page: {
        id: page.id,
        title: page.title,
        hasCustomPermissions: true,
        inheritPermissions: false,
        permissions,
      },
    };
  }

  private async checkParentAccess(
    userId: string,
    parentPageId: string | null,
  ): Promise<boolean> {
    if (!parentPageId) return true; // Root pages always accessible

    const parentAccess = await this.pageMemberRepo.resolveUserPageAccess(
      userId,
      parentPageId,
    );
    return parentAccess !== null && parentAccess !== PageMemberRole.NONE;
  }

  private async cascadeToChildren(
    pageId: string,
    membersToAdd: any[],
  ): Promise<void> {
    const descendants = await this.pageRepo.getAllDescendants(pageId);
    if (descendants.length === 0) return;

    // Separate user and group members for proper conflict handling
    const userMembers = membersToAdd.filter((m) => m.userId);
    const groupMembers = membersToAdd.filter((m) => m.groupId);

    for (const childId of descendants) {
      // Handle user members with proper conflict resolution
      if (userMembers.length > 0) {
        const childUserMembers = userMembers.map((m) => ({
          ...m,
          pageId: childId,
        }));

        await this.db
          .insertInto('pagePermissions')
          .values(childUserMembers)
          .onConflict((oc) =>
            oc.columns(['pageId', 'userId']).doUpdateSet({
              role: (eb) => eb.ref('excluded.role'),
              updatedAt: new Date(),
            }),
          )
          .execute();
      }

      // Handle group members separately
      if (groupMembers.length > 0) {
        const childGroupMembers = groupMembers.map((m) => ({
          ...m,
          pageId: childId,
        }));

        await this.db
          .insertInto('pagePermissions')
          .values(childGroupMembers)
          .onConflict((oc) =>
            oc.columns(['pageId', 'groupId']).doUpdateSet({
              role: (eb) => eb.ref('excluded.role'),
              updatedAt: new Date(),
            }),
          )
          .execute();
      }
    }
  }
}
