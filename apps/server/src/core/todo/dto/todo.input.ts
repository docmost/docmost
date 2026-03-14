import { IsString, IsUUID } from 'class-validator';

export class PageIdDto {
  @IsString()
  pageId: string;
}

export class TodoIdDto {
  @IsUUID()
  todoId: string;
}
