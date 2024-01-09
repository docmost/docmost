import { IsBoolean, IsUUID } from 'class-validator';

export class ResolveCommentDto {
  @IsUUID()
  commentId: string;

  @IsBoolean()
  resolved: boolean;
}
