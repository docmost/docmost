import { IsJSON, IsUUID } from 'class-validator';

export class UpdateCommentDto {
  @IsUUID()
  id: string;

  @IsJSON()
  content: any;
}
