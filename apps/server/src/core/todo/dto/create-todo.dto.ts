import { IsString } from 'class-validator';

export class CreateTodoDto {
  @IsString()
  pageId: string;

  @IsString()
  title: string;
}
