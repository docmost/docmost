import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { Page, User } from '@docmost/db/types/entity.types';
import {
  PageAccessLevel,
  PagePermissionRole,
} from '../../common/helpers/types/permission';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import { QueueJob, QueueName } from '../../integrations/queue/constants';
import { executeTx } from '@docmost/db/utils';

@Injectable()
export class PagePermissionService {
  constructor(
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
    @InjectKysely() private readonly db: KyselyDB,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
  ) {}

  private async getPageOrThrow(pageId: string): Promise<Page> {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private async canManagePermissions(
    user: User,
    page: Page,
  ): Promise<boolean> {
    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)) {
      return true;
    }

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      page.id,
    );
    if (pageAccess) {
      const perm = await this.pagePermissionRepo.getUserPagePermission(
        user.id,
        page.id,
      );
      return perm?.role === PagePermissionRole.WRITER;
    }

    if (page.creatorId === user.id) {
      return true;
    }

    return ability.can(SpaceCaslAction.Edit, SpaceCaslSubject.Page);
  }

  private async assertCanManage(user: User, page: Page): Promise<void> {
    if (!(await this.canManagePermissions(user, page))) {
      throw new ForbiddenException();
    }
  }

  private async getInheritedFrom(pageId: string) {
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
      .innerJoin('pageAccess', 'pageAccess.pageId', 'ancestors.ancestorId')
      .innerJoin('pages', 'pages.id', 'ancestors.ancestorId')
      .select(['pages.id', 'pages.slugId', 'pages.title'])
      .where('ancestors.depth', '>', 0)
      .orderBy('ancestors.depth', 'asc')
      .executeTakeFirst();

    if (!row) return undefined;
    return { id: row.id, slugId: row.slugId, title: row.title };
  }

  async restrictPage(pageId: string, user: User, workspaceId: string) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.assertCanManage(user, page);

    const existing = await this.pagePermissionRepo.findPageAccessByPageId(
      pageId,
    );
    if (existing) {
      throw new BadRequestException('Page is already restricted');
    }

    await executeTx(this.db, async (trx) => {
      const pageAccess = await this.pagePermissionRepo.insertPageAccess(
        {
          pageId: page.id,
          workspaceId,
          spaceId: page.spaceId,
          accessLevel: PageAccessLevel.RESTRICTED,
          creatorId: user.id,
        },
        trx,
      );

      await this.pagePermissionRepo.insertPagePermissions(
        [
          {
            pageAccessId: pageAccess.id,
            userId: user.id,
            role: PagePermissionRole.WRITER,
            addedById: user.id,
          },
        ],
        trx,
      );
    });

    this.auditService.log({
      event: AuditEvent.PAGE_RESTRICTED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
    });
  }

  async unrestrictPage(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.assertCanManage(user, page);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      pageId,
    );
    if (!pageAccess) {
      return;
    }

    await this.pagePermissionRepo.deletePageAccess(pageId);

    this.auditService.log({
      event: AuditEvent.PAGE_RESTRICTION_REMOVED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
    });
  }

  async addPermission(
    data: {
      pageId: string;
      role: string;
      userIds?: string[];
      groupIds?: string[];
    },
    user: User,
    workspaceId: string,
  ) {
    const page = await this.getPageOrThrow(data.pageId);
    await this.assertCanManage(user, page);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      data.pageId,
    );
    if (!pageAccess) {
      throw new BadRequestException('Page must be restricted first');
    }

    const userIds = data.userIds ?? [];
    const groupIds = data.groupIds ?? [];
    if (userIds.length === 0 && groupIds.length === 0) {
      throw new BadRequestException('No members specified');
    }

    const permissions = [
      ...userIds.map((userId) => ({
        pageAccessId: pageAccess.id,
        userId,
        role: data.role,
        addedById: user.id,
      })),
      ...groupIds.map((groupId) => ({
        pageAccessId: pageAccess.id,
        groupId,
        role: data.role,
        addedById: user.id,
      })),
    ];

    await this.pagePermissionRepo.insertPagePermissions(permissions);

    if (userIds.length > 0) {
      await this.notificationQueue.add(QueueJob.PAGE_PERMISSION_GRANTED, {
        userIds,
        pageId: page.id,
        spaceId: page.spaceId,
        workspaceId,
        actorId: user.id,
        role: data.role,
      });
    }

    this.auditService.log({
      event: AuditEvent.PAGE_PERMISSION_ADDED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: { role: data.role, userIds, groupIds },
    });
  }

  async removePermission(
    data: { pageId: string; userIds?: string[]; groupIds?: string[] },
    user: User,
  ) {
    const page = await this.getPageOrThrow(data.pageId);
    await this.assertCanManage(user, page);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      data.pageId,
    );
    if (!pageAccess) {
      throw new BadRequestException('Page is not restricted');
    }

    const userIds = data.userIds ?? [];
    const groupIds = data.groupIds ?? [];

    if (userIds.length > 0) {
      const removingWriter = await this.db
        .selectFrom('pagePermissions')
        .select('id')
        .where('pageAccessId', '=', pageAccess.id)
        .where('userId', 'in', userIds)
        .where('role', '=', PagePermissionRole.WRITER)
        .execute();

      if (removingWriter.length > 0) {
        const writerCount =
          await this.pagePermissionRepo.countWritersByPageAccessId(
            pageAccess.id,
          );
        if (writerCount <= removingWriter.length) {
          throw new BadRequestException('Cannot remove the last writer');
        }
      }

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

    this.auditService.log({
      event: AuditEvent.PAGE_PERMISSION_REMOVED,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
      metadata: { userIds, groupIds },
    });
  }

  async updatePermissionRole(
    data: {
      pageId: string;
      role: string;
      userId?: string;
      groupId?: string;
    },
    user: User,
  ) {
    const page = await this.getPageOrThrow(data.pageId);
    await this.assertCanManage(user, page);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      data.pageId,
    );
    if (!pageAccess) {
      throw new BadRequestException('Page is not restricted');
    }

    if (data.role !== PagePermissionRole.WRITER) {
      const isWriterTarget = data.userId
        ? (
            await this.pagePermissionRepo.findPagePermissionByUserId(
              pageAccess.id,
              data.userId,
            )
          )?.role === PagePermissionRole.WRITER
        : false;

      if (isWriterTarget) {
        const writerCount =
          await this.pagePermissionRepo.countWritersByPageAccessId(
            pageAccess.id,
          );
        if (writerCount <= 1) {
          throw new BadRequestException('Cannot demote the last writer');
        }
      }
    }

    await this.pagePermissionRepo.updatePagePermissionRole(
      pageAccess.id,
      data.role,
      { userId: data.userId, groupId: data.groupId },
    );
  }

  async getPermissions(pageId: string, user: User, pagination: PaginationOptions) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanView(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      pageId,
    );
    if (!pageAccess) {
      return { items: [], meta: { hasNextPage: false, hasPreviousPage: false } };
    }

    return this.pagePermissionRepo.getPagePermissionsPaginated(
      pageAccess.id,
      pagination,
    );
  }

  async getRestrictionInfo(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanView(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      pageId,
    );
    const accessLevel = await this.pagePermissionRepo.getUserPageAccessLevel(
      user.id,
      pageId,
    );
    const canManage = await this.canManagePermissions(user, page);

    const inheritedFrom =
      accessLevel.hasInheritedRestriction && !accessLevel.hasDirectRestriction
        ? await this.getInheritedFrom(pageId)
        : undefined;

    return {
      restrictionId: pageAccess?.id,
      hasDirectRestriction: accessLevel.hasDirectRestriction,
      hasInheritedRestriction: accessLevel.hasInheritedRestriction,
      inheritedFrom,
      userAccess: {
        canView: accessLevel.canAccess,
        canEdit: accessLevel.canEdit,
        canManage,
      },
    };
  }
}
