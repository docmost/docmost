import { IsUUID } from 'class-validator';

export class PageDetailsDto {
  @IsUUID()
  pageId: string;
}
