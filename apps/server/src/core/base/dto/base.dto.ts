import { IsUUID } from 'class-validator';

export class BaseIdDto {
  @IsUUID()
  pageId: string;
}
