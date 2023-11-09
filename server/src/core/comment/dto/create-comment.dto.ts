import { IsJSON, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
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
