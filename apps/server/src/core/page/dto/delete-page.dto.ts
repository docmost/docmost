import { IsUUID } from 'class-validator';

export class DeletePageDto {
  @IsUUID()
  pageId: string;
}
