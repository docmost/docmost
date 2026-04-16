import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { WsService } from '../../ws/ws.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { sql } from 'kysely';

type PagePermissionRole = 'reader' | 'writer';

@Injectable()
export class PagePermissionService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly wsService: WsService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  async getPermissionInfo(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanView(page, user);

    const access = await this.pagePermissionRepo.getUserPageAccessLevel(
      user.id,
      page.id,
    );
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    const hasRestriction = access.hasAnyRestriction;
    const canManage = hasRestriction
      ? access.canEdit
      : ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);

    return {
      restrictionId: access.hasDirectRestriction ? page.id : undefined,
      hasDirectRestriction: access.hasDirectRestriction,
      hasInheritedRestriction: access.hasInheritedRestriction,
      inheritedFrom: access.hasInheritedRestriction
        ? await this.getInheritedRestriction(page.id)
        : undefined,
      userAccess: {
        canView: hasRestriction
          ? access.canAccess
          : ability.can(SpaceCaslAction.Read, SpaceCaslSubject.Page),
        canEdit: hasRestriction
          ? access.canEdit
          : ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page),
        canManage,
      },
    };
  }

  async getPermissions(
    pageId: string,
    user: User,
    workspace: Workspace,
    pagination: PaginationOptions,
  ) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      page.id,
    );
    if (!pageAccess) {
      return {
        items: [],
        meta: {
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
          prevCursor: null,
        },
      };
    }

    return this.pagePermissionRepo.getPagePermissionsPaginated(
      pageAccess.id,
      pagination,
    );
  }

  async restrictPage(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const existing = await this.pagePermissionRepo.findPageAccessByPageId(
      page.id,
    );
    if (existing) {
      return;
    }

    const pageAccess = await this.pagePermissionRepo.insertPageAccess({
      pageId: page.id,
      workspaceId: workspace.id,
      spaceId: page.spaceId,
      accessLevel: 'restricted',
      creatorId: user.id,
    });

    await this.pagePermissionRepo.insertPagePermissions([
      {
        pageAccessId: pageAccess.id,
        userId: user.id,
        role: 'writer',
        addedById: user.id,
      },
    ]);

    await this.wsService.invalidateSpaceRestrictionCache(page.spaceId);

    this.auditService.log({
      event: AuditEvent.PAGE_RESTRICTED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
    });
  }

  async removeRestriction(pageId: string, user: User, workspace: Workspace) {
    const page = await this.getPageOrThrow(pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      page.id,
    );
    if (!pageAccess) {
      return;
    }

    await this.pagePermissionRepo.deletePageAccess(page.id);
    await this.wsService.invalidateSpaceRestrictionCache(page.spaceId);

    this.auditService.log({
      event: AuditEvent.PAGE_RESTRICTION_REMOVED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
    });
  }

  async addPermission(
    body: {
      pageId: string;
      role: PagePermissionRole;
      userIds?: string[];
      groupIds?: string[];
    },
    user: User,
    workspace: Workspace,
  ) {
    if (!body.userIds?.length && !body.groupIds?.length) {
      throw new BadRequestException('At least one user or group is required');
    }

    const page = await this.getPageOrThrow(body.pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    let pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(page.id);
    if (!pageAccess) {
      await this.restrictPage(page.id, user, workspace);
      pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(page.id);
      if (!pageAccess) {
        throw new BadRequestException('Failed to restrict page');
      }
    }

    const validUserIds = await this.assertUsersExist(
      body.userIds ?? [],
      workspace.id,
    );
    const validGroupIds = await this.assertGroupsExist(
      body.groupIds ?? [],
      workspace.id,
    );

    const permissions: Array<{
      pageAccessId: string;
      role: PagePermissionRole;
      userId?: string;
      groupId?: string;
      addedById: string;
    }> = [];
    const grantedUserIds: string[] = [];

    for (const userId of validUserIds) {
      const existing = await this.pagePermissionRepo.findPagePermissionByUserId(
        pageAccess.id,
        userId,
      );
      if (!existing) {
        permissions.push({
          pageAccessId: pageAccess.id,
          userId,
          role: body.role,
          addedById: user.id,
        });
        grantedUserIds.push(userId);
      }
    }

    for (const groupId of validGroupIds) {
      const existing =
        await this.pagePermissionRepo.findPagePermissionByGroupId(
          pageAccess.id,
          groupId,
        );
      if (!existing) {
        permissions.push({
          pageAccessId: pageAccess.id,
          groupId,
          role: body.role,
          addedById: user.id,
        });
      }
    }

    await this.pagePermissionRepo.insertPagePermissions(permissions);

    if (grantedUserIds.length > 0) {
      await this.notificationQueue.add(QueueJob.PAGE_PERMISSION_GRANTED, {
        userIds: grantedUserIds.filter((userId) => userId !== user.id),
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId: workspace.id,
        actorId: user.id,
        role: body.role,
      });
    }

    this.auditService.log({
      event: AuditEvent.PAGE_PERMISSION_ADDED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        role: body.role,
        userIds: validUserIds,
        groupIds: validGroupIds,
      },
    });
  }

  async removePermission(
    body: {
      pageId: string;
      userIds?: string[];
      groupIds?: string[];
    },
    user: User,
    workspace: Workspace,
  ) {
    const page = await this.getPageOrThrow(body.pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      page.id,
    );
    if (!pageAccess) {
      throw new BadRequestException('Page is not restricted');
    }

    const writerRemovals = await this.countWriterRemovals(pageAccess.id, {
      userIds: body.userIds ?? [],
      groupIds: body.groupIds ?? [],
    });
    const writerCount = await this.pagePermissionRepo.countWritersByPageAccessId(
      pageAccess.id,
    );

    if (writerCount > 0 && writerRemovals >= writerCount) {
      throw new BadRequestException('At least one writer must remain');
    }

    await this.pagePermissionRepo.deletePagePermissionsByUserIds(
      pageAccess.id,
      body.userIds ?? [],
    );
    await this.pagePermissionRepo.deletePagePermissionsByGroupIds(
      pageAccess.id,
      body.groupIds ?? [],
    );

    this.auditService.log({
      event: AuditEvent.PAGE_PERMISSION_REMOVED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: {
        userIds: body.userIds ?? [],
        groupIds: body.groupIds ?? [],
      },
    });
  }

  async updatePermissionRole(
    body: {
      pageId: string;
      role: PagePermissionRole;
      userId?: string;
      groupId?: string;
    },
    user: User,
    workspace: Workspace,
  ) {
    if (!body.userId && !body.groupId) {
      throw new BadRequestException('userId or groupId is required');
    }

    const page = await this.getPageOrThrow(body.pageId, workspace.id);
    await this.pageAccessService.validateCanEdit(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      page.id,
    );
    if (!pageAccess) {
      throw new BadRequestException('Page is not restricted');
    }

    const existing = body.userId
      ? await this.pagePermissionRepo.findPagePermissionByUserId(
          pageAccess.id,
          body.userId,
        )
      : await this.pagePermissionRepo.findPagePermissionByGroupId(
          pageAccess.id,
          body.groupId,
        );

    if (!existing) {
      throw new NotFoundException('Page permission not found');
    }

    if (existing.role === 'writer' && body.role !== 'writer') {
      const writerCount =
        await this.pagePermissionRepo.countWritersByPageAccessId(pageAccess.id);
      if (writerCount <= 1) {
        throw new BadRequestException('At least one writer must remain');
      }
    }

    await this.pagePermissionRepo.updatePagePermissionRole(
      pageAccess.id,
      body.role,
      {
        userId: body.userId,
        groupId: body.groupId,
      },
    );
  }

  private async getPageOrThrow(pageId: string, workspaceId: string) {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private async assertUsersExist(userIds: string[], workspaceId: string) {
    if (userIds.length === 0) return [];

    const users = await this.db
      .selectFrom('users')
      .select('id')
      .where('id', 'in', userIds)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .where('deactivatedAt', 'is', null)
      .execute();

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more users were not found');
    }

    return users.map((row) => row.id);
  }

  private async assertGroupsExist(groupIds: string[], workspaceId: string) {
    if (groupIds.length === 0) return [];

    const groups = await this.db
      .selectFrom('groups')
      .select('id')
      .where('id', 'in', groupIds)
      .where('workspaceId', '=', workspaceId)
      .execute();

    if (groups.length !== groupIds.length) {
      throw new BadRequestException('One or more groups were not found');
    }

    return groups.map((row) => row.id);
  }

  private async countWriterRemovals(
    pageAccessId: string,
    opts: { userIds: string[]; groupIds: string[] },
  ) {
    let writerRemovals = 0;

    for (const userId of opts.userIds) {
      const permission = await this.pagePermissionRepo.findPagePermissionByUserId(
        pageAccessId,
        userId,
      );
      if (permission?.role === 'writer') {
        writerRemovals += 1;
      }
    }

    for (const groupId of opts.groupIds) {
      const permission =
        await this.pagePermissionRepo.findPagePermissionByGroupId(
          pageAccessId,
          groupId,
        );
      if (permission?.role === 'writer') {
        writerRemovals += 1;
      }
    }

    return writerRemovals;
  }

  private async getInheritedRestriction(pageId: string) {
    const row = await this.db
      .withRecursive('ancestors', (qb) =>
        qb
          .selectFrom('pages')
          .select([
            'pages.id as ancestorId',
            'pages.parentPageId',
            sql<number>`0`.as('depth'),
          ])
          .where('pages.id', '=', pageId)
          .unionAll((eb) =>
            eb
              .selectFrom('pages')
              .innerJoin('ancestors', 'ancestors.parentPageId', 'pages.id')
              .select([
                'pages.id as ancestorId',
                'pages.parentPageId',
                sql<number>`ancestors.depth + 1`.as('depth'),
              ]),
          ),
      )
      .selectFrom('ancestors')
      .innerJoin('pages', 'pages.id', 'ancestors.ancestorId')
      .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
      .select(['pages.id', 'pages.slugId', 'pages.title'])
      .where('pages.id', '!=', pageId)
      .orderBy('ancestors.depth', 'asc')
      .executeTakeFirst();

    return row ?? undefined;
  }
}
