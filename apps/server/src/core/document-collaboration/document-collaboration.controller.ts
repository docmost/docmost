import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '../../database/types/entity.types';
import { DocumentCollaborationService } from './document-collaboration.service';
import {
  BatchIdDto,
  CollaborationMembersDto,
  CollaborationPageDto,
  ConfirmReadingDto,
  CreateDocumentTaskDto,
  CreateReadingBatchDto,
  ReadingListDto,
  TaskIdDto,
  TaskListDto,
  UpdateDocumentTaskDto,
} from './dto/collaboration.dto';
import { OAuthScope } from '../../common/decorators/oauth-scope.decorator';

@UseGuards(JwtAuthGuard)
@Controller('document-collaboration')
export class DocumentCollaborationController {
  constructor(private readonly service: DocumentCollaborationService) {}

  @Post('members')
  @HttpCode(200)
  @OAuthScope('read')
  members(
    @Body() dto: CollaborationMembersDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.members(dto, user, workspace.id);
  }
  @Post('tasks/create')
  @HttpCode(200)
  @OAuthScope('write')
  createTask(
    @Body() dto: CreateDocumentTaskDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.createTask(dto, user, workspace.id);
  }
  @Post('tasks/list')
  @HttpCode(200)
  @OAuthScope('read')
  listTasks(
    @Body() dto: TaskListDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.listTasks(dto, user, workspace.id);
  }
  @Post('tasks/update')
  @HttpCode(200)
  @OAuthScope('write')
  updateTask(
    @Body() dto: UpdateDocumentTaskDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.updateTask(dto, user, workspace.id);
  }
  @Post('tasks/complete')
  @HttpCode(200)
  @OAuthScope('write')
  complete(
    @Body() dto: TaskIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.finishTask(dto.taskId, user, workspace.id);
  }
  @Post('tasks/cancel')
  @HttpCode(200)
  @OAuthScope('write')
  cancel(
    @Body() dto: TaskIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.finishTask(dto.taskId, user, workspace.id, true);
  }
  @Post('reading/preview')
  @HttpCode(200)
  @OAuthScope('read')
  preview(
    @Body() dto: CollaborationPageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.preview(dto.pageId, user, workspace.id);
  }
  @Post('reading/create')
  @HttpCode(200)
  @OAuthScope('write')
  createReading(
    @Body() dto: CreateReadingBatchDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.createReading(dto, user, workspace.id);
  }
  @Post('reading/list')
  @HttpCode(200)
  @OAuthScope('read')
  listReading(
    @Body() dto: ReadingListDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.listReading(dto, user, workspace.id);
  }
  @Post('reading/info')
  @HttpCode(200)
  @OAuthScope('read')
  info(
    @Body() dto: BatchIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.readingInfo(dto.batchId, user, workspace.id);
  }
  @Post('reading/confirm')
  @HttpCode(200)
  @OAuthScope('write')
  confirm(
    @Body() dto: ConfirmReadingDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.confirmReading(
      dto.batchId,
      dto.acknowledged,
      user,
      workspace.id,
    );
  }
  @Post('reading/close')
  @HttpCode(200)
  @OAuthScope('write')
  close(
    @Body() dto: BatchIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.closeReading(dto.batchId, user, workspace.id);
  }
  @Post('reading/revoke')
  @HttpCode(200)
  @OAuthScope('write')
  revoke(
    @Body() dto: BatchIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.service.closeReading(dto.batchId, user, workspace.id, true);
  }
}
