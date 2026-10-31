import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateSpaceDto } from '../dto/create-space.dto.js';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options.js';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo.js';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types.js';
import { Space, User } from '@docmost/db/types/entity.types.js';
import { UpdateSpaceDto } from '../dto/update-space.dto.js';
import { executeTx } from '@docmost/db/utils.js';
import { InjectKysely } from 'nestjs-kysely';
import { Feature } from '../../../common/features.js';
import { SpaceMemberService } from './space-member.service.js';
import { SpaceRole } from '../../../common/helpers/types/permission.js';
import { QueueJob, QueueName } from '../../../integrations/queue/constants/index.js';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CursorPaginationResult } from '@docmost/db/pagination/cursor-pagination.js';
import { ShareRepo } from '@docmost/db/repos/share/share.repo.js';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo.js';
import { LicenseCheckService } from '../../../integrations/environment/license-check.service.js';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events.js';
import { diffAuditTrackedFields } from '../../../common/helpers/index.js';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service.js';

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
    });
    if (!space) {
      throw new NotFoundException('Space not found');
    }

    return space;
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
}
