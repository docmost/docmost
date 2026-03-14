import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateTodoDto {
  @IsUUID()
  todoId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
