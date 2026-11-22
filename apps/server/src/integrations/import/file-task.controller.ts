import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FileTask, User, Workspace } from '@docmost/db/types/entity.types';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { FileTaskIdDto } from './dto/file-task-dto';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ApiKeyScope } from '../../common/decorators/api-key-scope.decorator';
import { FileImportSource } from './utils/file.utils';

@Controller('file-tasks')
export class FileTaskController {
  constructor(
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  @ApiKeyScope('read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post()
  async getFileTasks(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }

    const query = this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('workspaceId', '=', workspace.id)
      .where(
        'spaceId',
        'in',
        this.spaceMemberRepo.getUserSpaceIdsQuery(user.id),
      );

    const result = await executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (cursor) => ({ id: cursor.id }),
    });

    // a task tied to a page shows only to people who can open that page
    const pageIds = [
      ...new Set(result.items.map((task) => task.pageId).filter(Boolean)),
    ];
    const accessible = pageIds.length
      ? new Set(
          await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds,
            userId: user.id,
          }),
        )
      : new Set<string>();
    return {
      ...result,
      items: result.items
        .filter((task) => !task.pageId || accessible.has(task.pageId))
        .map((task) => this.visibleFileTask(task, user.id)),
    };
  }

  @ApiKeyScope('read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getFileTask(@Body() dto: FileTaskIdDto, @AuthUser() user: User) {
    const fileTask = await this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('id', '=', dto.fileTaskId)
      .where('workspaceId', '=', user.workspaceId)
      .executeTakeFirst();

    if (!fileTask || !fileTask.spaceId) {
      throw new NotFoundException('File task not found');
    }

    const ability = await this.spaceAbility.createForUser(
      user,
      fileTask.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    if (
      fileTask.pageId &&
      !(await this.pagePermissionRepo.canUserAccessPage(
        user.id,
        fileTask.pageId,
      ))
    ) {
      throw new ForbiddenException();
    }

    return this.visibleFileTask(fileTask, user.id);
  }

  private visibleFileTask(task: FileTask, userId: string): FileTask {
    const metadata = task.metadata;
    if (
      task.source !== FileImportSource.Confluence ||
      task.creatorId === userId ||
      !metadata ||
      typeof metadata !== 'object' ||
      Array.isArray(metadata) ||
      !('warnings' in metadata)
    ) {
      return task;
    }
    const visibleMetadata = { ...metadata };
    delete visibleMetadata.warnings;
    return { ...task, metadata: visibleMetadata };
  }
}
