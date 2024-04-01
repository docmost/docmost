import { IsUUID } from 'class-validator';

export class PageIdDto {
  @IsUUID()
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
