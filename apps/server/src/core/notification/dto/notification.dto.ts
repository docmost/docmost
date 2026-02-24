import { IsArray, IsOptional, IsUUID } from 'class-validator';

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
