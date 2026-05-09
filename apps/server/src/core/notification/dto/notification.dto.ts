import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export class NotificationIdDto {
  @IsUUID()
  notificationId: string;
}

export class MarkNotificationsReadDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  notificationIds?: string[];
}

export class ListNotificationsDto extends PaginationOptions {
  @IsOptional()
  @IsString()
  @IsIn(['direct', 'updates', 'all'])
  type?: 'direct' | 'updates' | 'all' = 'all';
}
