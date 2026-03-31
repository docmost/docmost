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
import { User } from '@docmost/db/types/entity.types';
import { ListNotificationsDto, MarkNotificationsReadDto } from './dto/notification.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getNotifications(
    @Body() dto: ListNotificationsDto,
    @AuthUser() user: User,
  ) {
    return this.notificationService.findByUserId(user.id, dto, dto.type);
  }

  @HttpCode(HttpStatus.OK)
  @Post('unread-count')
  async getUnreadCount(@AuthUser() user: User) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-read')
  async markAsRead(
    @Body() dto: MarkNotificationsReadDto,
    @AuthUser() user: User,
  ) {
    if (dto.notificationIds?.length) {
      await this.notificationService.markMultipleAsRead(
        dto.notificationIds,
        user.id,
      );
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('mark-all-read')
  async markAllAsRead(@AuthUser() user: User) {
    await this.notificationService.markAllAsRead(user.id);
  }
}
