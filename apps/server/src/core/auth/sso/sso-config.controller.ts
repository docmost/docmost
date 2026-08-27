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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../casl/interfaces/workspace-ability.type';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { SsoConfigService } from './services/sso-config.service';
import {
  CommitWizardDto,
  CreateGroupMappingDto,
  GroupMappingIdDto,
  PreviewMappingDto,
  ResyncDto,
  UpdateSsoConfigDto,
} from './dto/sso-config.dto';

@UseGuards(JwtAuthGuard)
@Controller('sso/config')
export class SsoConfigController {
  constructor(
    private readonly ssoConfigService: SsoConfigService,
    private readonly environmentService: EnvironmentService,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    @InjectQueue(QueueName.GENERAL_QUEUE) private generalQueue: Queue,
  ) {}

  private assertCanManage(user: User, workspace: Workspace): void {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getConfig(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);

    const provider = await this.ssoConfigService.getOrCreateProvider(
      workspace.id,
      user.id,
    );

    return {
      id: provider.id,
      isEnabled: provider.isEnabled,
      allowSignup: provider.allowSignup,
      groupSync: provider.groupSync,
      // Credentials themselves are never exposed, only whether they are set.
      credentialsConfigured: this.environmentService.isGoogleSsoEnabled(),
      groupSyncConfigured:
        this.environmentService.isGoogleGroupSyncConfigured(),
      callbackUrl: `${this.environmentService.getAppUrl()}/api/sso/google/callback`,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateConfig(
    @Body() dto: UpdateSsoConfigDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);
    return this.ssoConfigService.updateProvider(workspace.id, user.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mappings')
  async listMappings(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);
    return this.ssoConfigService.listMappings(workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mappings/create')
  async createMapping(
    @Body() dto: CreateGroupMappingDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);
    return this.ssoConfigService.createMapping(workspace.id, user.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('mappings/delete')
  async deleteMapping(
    @Body() dto: GroupMappingIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);
    await this.ssoConfigService.deleteMapping(workspace.id, dto.mappingId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('preview')
  async preview(
    @Body() dto: PreviewMappingDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);
    return this.ssoConfigService.previewMapping(workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('wizard/commit')
  async commitWizard(
    @Body() dto: CommitWizardDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);

    const created = await this.ssoConfigService.commitWizard(
      workspace.id,
      user.id,
      dto.mappings,
    );

    if (dto.runSync) {
      await this.enqueueSync(workspace.id);
    }

    return { created: created.length, syncQueued: Boolean(dto.runSync) };
  }

  @HttpCode(HttpStatus.OK)
  @Post('resync')
  async resync(
    @Body() dto: ResyncDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);

    if (!this.environmentService.isGoogleGroupSyncConfigured()) {
      throw new NotFoundException(
        'Google group sync is not configured on this server.',
      );
    }

    await this.enqueueSync(workspace.id, dto.mappingId);

    return { queued: true };
  }

  /**
   * A deterministic jobId collapses duplicates, so a double-click or a wizard
   * sync overlapping a manual resync cannot run two reconciliations at once.
   */
  private async enqueueSync(
    workspaceId: string,
    mappingId?: string,
  ): Promise<void> {
    await this.generalQueue.add(
      QueueJob.GOOGLE_GROUP_SYNC,
      { workspaceId, mappingId },
      {
        jobId: `google-group-sync:${workspaceId}:${mappingId ?? 'all'}`,
        removeOnComplete: true,
      },
    );
  }
}
