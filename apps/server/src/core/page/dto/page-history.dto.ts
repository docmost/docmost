import { IsUUID } from 'class-validator';

export class PageHistoryDto {
  @IsUUID()
  pageId: string;
}
