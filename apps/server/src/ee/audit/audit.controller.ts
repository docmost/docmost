import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EeAuditService } from './ee-audit.service';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly auditService: EeAuditService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() body: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanViewAudit(user, workspace);

    let query = this.db
      .selectFrom('audit')
      .selectAll('audit')
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('users')
            .select(['users.id', 'users.name', 'users.email', 'users.avatarUrl'])
            .whereRef('users.id', '=', 'audit.actorId'),
        ).as('actor'),
      )
      .where('audit.workspaceId', '=', workspace.id);

    if (body?.event) {
      query = query.where('audit.event', '=', body.event);
    }
    if (body?.resourceType) {
      query = query.where('audit.resourceType', '=', body.resourceType);
    }
    if (body?.actorId) {
      query = query.where('audit.actorId', '=', body.actorId);
    }
    if (body?.spaceId) {
      query = query.where('audit.spaceId', '=', body.spaceId);
    }
    if (body?.startDate) {
      query = query.where('audit.createdAt', '>=', new Date(body.startDate));
    }
    if (body?.endDate) {
      query = query.where('audit.createdAt', '<=', new Date(body.endDate));
    }

    const result = await executeWithCursorPagination(query, {
      perPage: body?.limit,
      cursor: body?.cursor,
      beforeCursor: body?.beforeCursor,
      fields: [
        { expression: 'audit.createdAt', direction: 'desc', key: 'createdAt' },
        { expression: 'audit.id', direction: 'desc', key: 'id' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });

    return {
      items: result.items.map((item: any) => ({
        ...item,
        actorId: item.actorId ?? undefined,
        resourceId: item.resourceId ?? undefined,
        spaceId: item.spaceId ?? undefined,
        changes: item.changes ?? undefined,
        metadata: item.metadata ?? undefined,
        ipAddress: item.ipAddress ?? undefined,
      })),
      meta: result.meta,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('retention')
  async retention(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanViewAudit(user, workspace);

    const row = await this.workspaceRepo.findById(workspace.id);
    return { retentionDays: row?.auditRetentionDays ?? 180 };
  }

  @HttpCode(HttpStatus.OK)
  @Post('retention/update')
  async updateRetention(
    @Body() body: { auditRetentionDays: number },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanViewAudit(user, workspace);

    const retentionDays = Math.max(1, Number(body?.auditRetentionDays ?? 180));
    await this.auditService.updateRetention(workspace.id, retentionDays);
    return { retentionDays };
  }

  private assertCanViewAudit(user: User, workspace: Workspace): void {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Audit)) {
      throw new ForbiddenException();
    }
  }
}
