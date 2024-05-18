import { IsJSON, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  pageId: string;

  @IsJSON()
  content: any;

  @IsOptional()
  @IsString()
  selection: string;

  @IsOptional()
  @IsUUID()
  parentCommentId: string;
}
