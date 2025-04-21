import { IsString, IsUUID } from 'class-validator';

export class PageIdDto {
  @IsString()
  pageId: string;
}

export class CommentIdDto {
  @IsUUID()
  commentId: string;
}
