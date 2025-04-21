import { IsJSON, IsUUID } from 'class-validator';

export class UpdateCommentDto {
  @IsUUID()
  commentId: string;

  @IsJSON()
  content: any;
}
