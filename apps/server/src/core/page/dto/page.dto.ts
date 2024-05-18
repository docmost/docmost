import { IsString, IsUUID } from 'class-validator';

export class PageIdDto {
  @IsString()
  pageId: string;
}

export class SpaceIdDto {
  @IsUUID()
  spaceId: string;
}

export class PageHistoryIdDto {
  @IsUUID()
  historyId: string;
}
