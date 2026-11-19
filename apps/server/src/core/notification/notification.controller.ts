import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Feature } from '../../common/features';
import { LicenseCheckService } from '../../integrations/environment/license-check.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { ListNotificationsDto, MarkNotificationsReadDto } from './dto/notification.dto';
import { ApiKeyScope } from '../../common/decorators/api-key-scope.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly licenses: LicenseCheckService,
  ) {}

  private hasTasks(workspace: Workspace) {
    return this.licenses.hasFeature(
      workspace.licenseKey,
      Feature.TASKS,
      workspace.plan,
    );
  }

  @ApiKeyScope('read')
  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getNotifications(
    @Body() dto: ListNotificationsDto,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
  ) {
    return this.notificationService.findByUserId(
      user.id,
      dto,
      dto.type,
      this.hasTasks(workspace),
    );
  }

  @ApiKeyScope('read')
  @HttpCode(HttpStatus.OK)
  @Post('unread-count')
  async getUnreadCount(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const count = await this.notificationService.getUnreadCount(
      user.id,
      this.hasTasks(workspace),
    );
    return { count };
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-read')
  async markAsRead(
    @Body() dto: MarkNotificationsReadDto,
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
  ) {
    if (dto.notificationIds?.length) {
      await this.notificationService.markMultipleAsRead(
        dto.notificationIds,
        user.id,
        this.hasTasks(workspace),
      );
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-all-read')
  async markAllAsRead(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.notificationService.markAllAsRead(
      user.id,
      this.hasTasks(workspace),
    );
  }
}
