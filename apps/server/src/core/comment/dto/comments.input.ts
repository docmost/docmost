import { IsUUID } from 'class-validator';

export class CommentsInput {
  @IsUUID()
  pageId: string;
}

export class SingleCommentInput {
  @IsUUID()
  id: string;
}
