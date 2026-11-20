import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class ResolveCommentDto {
  @IsNotEmpty()
  @IsUUID()
  commentId: string;

  @IsNotEmpty()
  @IsBoolean()
  resolved: boolean;
}
