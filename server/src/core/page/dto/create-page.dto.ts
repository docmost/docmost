import { IsOptional, IsString } from 'class-validator';

export class CreatePageDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  content?: string;

  @IsOptional()
  parentId?: string;

  @IsString()
  creatorId: string;

  @IsString()
  workspaceId: string;
}
