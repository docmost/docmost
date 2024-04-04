import { IsUUID } from 'class-validator';

export class PageIdDto {
  @IsUUID()
  pageId: string;
}

export class CommentIdDto {
  @IsUUID()
  commentId: string;
}
