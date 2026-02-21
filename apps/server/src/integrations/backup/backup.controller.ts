import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { FastifyReply } from 'fastify';
import { BackupJobService } from './backup-job.service';
import { ListBackupJobsDto, BackupJobIdDto } from './dto/backup-job.dto';
import * as path from 'path';

@UseGuards(JwtAuthGuard)
@Controller('backups')
export class BackupController {
  constructor(
    private readonly backupJobService: BackupJobService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
  ) {}

  private ensureCanManageBackup(user: User, workspace: Workspace) {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  @Get('jobs')
  async listJobs(
    @Query() dto: ListBackupJobsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.ensureCanManageBackup(user, workspace);
    return this.backupJobService.listJobs(workspace.id, {
      cursor: dto.cursor,
      limit: dto.limit,
    });
  }

  @Post('jobs/run')
  async runBackup(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.ensureCanManageBackup(user, workspace);
    const job = await this.backupJobService.createManualJob(
      workspace.id,
      user.id,
    );
    return { job };
  }

  @Get('jobs/:id')
  async getJob(
    @Param() params: BackupJobIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.ensureCanManageBackup(user, workspace);
    const job = await this.backupJobService.getJobWithTriggerer(
      workspace.id,
      params.id,
    );
    if (!job) throw new ForbiddenException();
    return job;
  }

  @Get('jobs/:id/download-url')
  async getDownloadUrl(
    @Param() params: BackupJobIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.ensureCanManageBackup(user, workspace);
    const result = await this.backupJobService.getDownloadUrl(
      workspace.id,
      params.id,
    );
    if (!result) throw new ForbiddenException();
    return result;
  }

  @Get('jobs/:id/download')
  async download(
    @Param() params: BackupJobIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    this.ensureCanManageBackup(user, workspace);
    const fullPath = await this.backupJobService.getArtifactFullPath(
      workspace.id,
      params.id,
    );
    if (!fullPath) throw new ForbiddenException();

    const filename = path.basename(fullPath);
    res.headers({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return res.send(createReadStream(fullPath));
  }
}
