import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceArchivedBy } from '@docmost/db/repos/space/types';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { Page, Space, User } from '@docmost/db/types/entity.types';
import { UpdateSpaceDto } from '../dto/update-space.dto';
import { executeTx } from '@docmost/db/utils';
import { InjectKysely } from 'nestjs-kysely';
import { Feature } from '../../../common/features';
import { SpaceMemberService } from './space-member.service';
import { SpaceRole } from '../../../common/helpers/types/permission';
import { QueueJob, QueueName } from 'src/integrations/queue/constants';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import { diffAuditTrackedFields } from '../../../common/helpers';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import { WsService } from '../../../ws/ws.service';

@Injectable()
export class SpaceService {
  constructor(
    private spaceRepo: SpaceRepo,
    private spaceMemberService: SpaceMemberService,
    private shareRepo: ShareRepo,
    private workspaceRepo: WorkspaceRepo,
    private licenseCheckService: LicenseCheckService,
    @InjectKysely() private readonly db: KyselyDB,
    @InjectQueue(QueueName.ATTACHMENT_QUEUE) private attachmentQueue: Queue,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
    private readonly wsService: WsService,
    private pageRepo: PageRepo,
    private pagePermissionRepo: PagePermissionRepo,
  ) {}

  async createSpace(
    authUser: User,
    workspaceId: string,
    createSpaceDto: CreateSpaceDto,
    trx?: KyselyTransaction,
    options?: { isPersonal?: boolean },
  ): Promise<Space> {
    let space = null;

    await executeTx(
      this.db,
      async (trx) => {
        space = await this.create(
          authUser.id,
          workspaceId,
          createSpaceDto,
          trx,
          options,
        );

        await this.spaceMemberService.addUserToSpace(
          authUser.id,
          space.id,
          SpaceRole.ADMIN,
          workspaceId,
          trx,
        );
      },
      trx,
    );

    this.auditService.log({
      event: AuditEvent.SPACE_CREATED,
      resourceType: AuditResource.SPACE,
      resourceId: space.id,
      spaceId: space.id,
      changes: {
        after: {
          name: space.name,
          slug: space.slug,
          ...(space.isPersonal ? { isPersonal: true } : {}),
        },
      },
    });

    return { ...space, memberCount: 1 };
  }

  async create(
    userId: string,
    workspaceId: string,
    createSpaceDto: CreateSpaceDto,
    trx?: KyselyTransaction,
    options?: { isPersonal?: boolean },
  ): Promise<Space> {
    const slugExists = await this.spaceRepo.slugExists(
      createSpaceDto.slug,
      workspaceId,
      trx,
    );
    if (slugExists) {
      throw new BadRequestException(
        'Space slug exists. Please use a unique space slug',
      );
    }

    return await this.spaceRepo.insertSpace(
      {
        name: createSpaceDto.name ?? 'untitled space',
        description: createSpaceDto.description ?? '',
        creatorId: userId,
        workspaceId: workspaceId,
        slug: createSpaceDto.slug,
        isPersonal: options?.isPersonal ?? false,
      },
      trx,
    );
  }

  async updateSpace(
    updateSpaceDto: UpdateSpaceDto,
    workspaceId: string,
  ): Promise<Space> {
    if (updateSpaceDto?.slug) {
      const slugExists = await this.spaceRepo.slugExists(
        updateSpaceDto.slug,
        workspaceId,
      );

      if (slugExists) {
        throw new BadRequestException(
          'Space slug exists. Please use a unique space slug',
        );
      }
    }

    if (
      typeof updateSpaceDto.disablePublicSharing !== 'undefined' ||
      typeof updateSpaceDto.disableExport === 'boolean' ||
      typeof updateSpaceDto.allowViewerComments !== 'undefined'
    ) {
      const workspace = await this.workspaceRepo.findById(workspaceId, {
        withLicenseKey: true,
      });

      if (
        typeof updateSpaceDto.disablePublicSharing !== 'undefined' &&
        !this.licenseCheckService.hasFeature(
          workspace.licenseKey,
          Feature.SECURITY_SETTINGS,
          workspace.plan,
        )
      ) {
        throw new ForbiddenException('This feature requires a valid license');
      }

      if (
        updateSpaceDto.disableExport === true &&
        !this.licenseCheckService.hasFeature(
          workspace.licenseKey,
          Feature.EXPORT_CONTROLS,
          workspace.plan,
        )
      ) {
        throw new ForbiddenException('This feature requires a valid license');
      }

      if (
        typeof updateSpaceDto.allowViewerComments !== 'undefined' &&
        !this.licenseCheckService.hasFeature(
          workspace.licenseKey,
          Feature.VIEWER_COMMENTS,
          workspace.plan,
        )
      ) {
        throw new ForbiddenException('This feature requires a valid license');
      }
    }

    const spaceBefore = await this.spaceRepo.findById(
      updateSpaceDto.spaceId,
      workspaceId,
    );
    const settingsBefore = (spaceBefore?.settings ?? {}) as Record<string, any>;

    let newHomePage: Page | undefined;
    if (updateSpaceDto.homePageId) {
      newHomePage = await this.pageRepo.findById(updateSpaceDto.homePageId);
      if (
        !newHomePage ||
        newHomePage.deletedAt ||
        newHomePage.spaceId !== spaceBefore?.id
      ) {
        throw new BadRequestException('Home page must be a page in this space');
      }
    }

    const homePageId = newHomePage
      ? newHomePage.id
      : updateSpaceDto.homePageId;

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    let updatedSpace: Space;

    await executeTx(this.db, async (trx) => {
      if (typeof updateSpaceDto.disablePublicSharing !== 'undefined') {
        const prev = settingsBefore?.sharing?.disabled ?? false;
        if (prev !== updateSpaceDto.disablePublicSharing) {
          before.disablePublicSharing = prev;
          after.disablePublicSharing = updateSpaceDto.disablePublicSharing;
        }

        await this.spaceRepo.updateSharingSettings(
          updateSpaceDto.spaceId,
          workspaceId,
          'disabled',
          updateSpaceDto.disablePublicSharing,
          trx,
        );

        if (updateSpaceDto.disablePublicSharing) {
          await this.shareRepo.deleteBySpaceId(updateSpaceDto.spaceId, trx);
        }
      }

      if (typeof updateSpaceDto.disableExport === 'boolean') {
        const prev = settingsBefore?.export?.disabled ?? false;
        if (prev !== updateSpaceDto.disableExport) {
          before.disableExport = prev;
          after.disableExport = updateSpaceDto.disableExport;
        }

        await this.spaceRepo.updateExportSettings(
          updateSpaceDto.spaceId,
          workspaceId,
          'disabled',
          updateSpaceDto.disableExport,
          trx,
        );
      }

      if (typeof updateSpaceDto.allowViewerComments !== 'undefined') {
        const prev = settingsBefore?.comments?.allowViewerComments ?? false;
        if (prev !== updateSpaceDto.allowViewerComments) {
          before.allowViewerComments = prev;
          after.allowViewerComments = updateSpaceDto.allowViewerComments;
        }

        await this.spaceRepo.updateCommentSettings(
          updateSpaceDto.spaceId,
          workspaceId,
          'allowViewerComments',
          updateSpaceDto.allowViewerComments,
          trx,
        );
      }

      updatedSpace = await this.spaceRepo.updateSpace(
        {
          name: updateSpaceDto.name,
          description: updateSpaceDto.description,
          slug: updateSpaceDto.slug,
          homePageId,
        },
        updateSpaceDto.spaceId,
        workspaceId,
        trx,
      );
    });

    const columnChanges = diffAuditTrackedFields(
      ['name', 'slug', 'description'],
      updateSpaceDto,
      spaceBefore,
      updatedSpace,
    );
    if (columnChanges) {
      Object.assign(before, columnChanges.before);
      Object.assign(after, columnChanges.after);
    }

    const homePageBeforeId = spaceBefore?.homePageId ?? null;
    if (
      typeof homePageId !== 'undefined' &&
      (homePageId ?? null) !== homePageBeforeId
    ) {
      const oldHomePage = homePageBeforeId
        ? await this.pageRepo.findById(homePageBeforeId)
        : null;
      before.homePageId = homePageBeforeId;
      before.homePageTitle = oldHomePage?.title ?? null;
      after.homePageId = homePageId ?? null;
      after.homePageTitle = newHomePage?.title ?? null;
    }

    if (Object.keys(after).length > 0) {
      this.auditService.log({
        event: AuditEvent.SPACE_UPDATED,
        resourceType: AuditResource.SPACE,
        resourceId: updateSpaceDto.spaceId,
        spaceId: updateSpaceDto.spaceId,
        changes: { before, after },
      });
    }

    return updatedSpace;
  }

  async getSpaceInfo(spaceId: string, workspaceId: string): Promise<Space> {
    const space = await this.spaceRepo.findById(spaceId, workspaceId, {
      includeMemberCount: true,
      includeArchivedBy: true,
    });
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    return space;
  }

  async getHomePage(
    space: Pick<Space, 'id' | 'homePageId'>,
    userId: string,
  ): Promise<Pick<Page, 'id' | 'slugId' | 'title' | 'icon'> | null> {
    if (!space.homePageId) return null;

    const page = await this.pageRepo.findById(space.homePageId);
    if (!page || page.deletedAt || page.spaceId !== space.id) return null;

    const canAccess = await this.pagePermissionRepo.canUserAccessPage(
      userId,
      page.id,
    );
    if (!canAccess) return null;

    return {
      id: page.id,
      slugId: page.slugId,
      title: page.title,
      icon: page.icon,
    };
  }

  async getWorkspaceSpaces(
    workspaceId: string,
    pagination: PaginationOptions,
  ): Promise<CursorPaginationResult<Space>> {
    return this.spaceRepo.getSpacesInWorkspace(workspaceId, pagination);
  }

  async deleteSpace(spaceId: string, workspaceId: string): Promise<void> {
    const space = await this.spaceRepo.findById(spaceId, workspaceId);
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    await this.spaceRepo.deleteSpace(spaceId, workspaceId);
    await this.attachmentQueue.add(QueueJob.DELETE_SPACE_ATTACHMENTS, space);

    this.auditService.log({
      event: AuditEvent.SPACE_DELETED,
      resourceType: AuditResource.SPACE,
      resourceId: spaceId,
      spaceId: spaceId,
      changes: {
        before: {
          name: space.name,
          slug: space.slug,
          description: space.description,
        },
      },
    });
  }

  async archiveSpace(
    space: Space,
    user: User,
  ): Promise<Space & { archivedBy?: SpaceArchivedBy | null }> {
    if (space.isPersonal) {
      throw new BadRequestException('Personal spaces cannot be archived');
    }

    if (space.archivedAt) {
      return space;
    }

    const archivedSpace = await this.spaceRepo.updateSpace(
      { archivedAt: new Date(), archivedById: user.id },
      space.id,
      space.workspaceId,
    );
    const archivedBy: SpaceArchivedBy = {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };

    this.auditService.log({
      event: AuditEvent.SPACE_ARCHIVED,
      resourceType: AuditResource.SPACE,
      resourceId: space.id,
      spaceId: space.id,
      changes: {
        before: { name: space.name, archivedAt: space.archivedAt },
        after: { archivedAt: archivedSpace.archivedAt },
      },
    });

    this.emitArchiveUpdate(
      archivedSpace.id,
      archivedSpace.archivedAt,
      archivedBy,
    );

    return { ...archivedSpace, archivedBy };
  }

  async unarchiveSpace(
    space: Space,
  ): Promise<Space & { archivedBy?: SpaceArchivedBy | null }> {
    if (!space.archivedAt) {
      return space;
    }

    const unarchivedSpace = await this.spaceRepo.updateSpace(
      { archivedAt: null, archivedById: null },
      space.id,
      space.workspaceId,
    );

    this.auditService.log({
      event: AuditEvent.SPACE_UNARCHIVED,
      resourceType: AuditResource.SPACE,
      resourceId: space.id,
      spaceId: space.id,
      changes: {
        before: { name: space.name, archivedAt: space.archivedAt },
        after: { archivedAt: unarchivedSpace.archivedAt },
      },
    });

    this.emitArchiveUpdate(
      unarchivedSpace.id,
      unarchivedSpace.archivedAt,
      null,
    );

    return { ...unarchivedSpace, archivedBy: null };
  }

  private emitArchiveUpdate(
    spaceId: string,
    archivedAt: Date | null,
    archivedBy: SpaceArchivedBy | null,
  ): void {
    this.wsService.emitToSpace(spaceId, {
      operation: 'spaceArchiveUpdated',
      spaceId,
      archivedAt,
      archivedBy,
    });
  }
}
