import { IsString, IsOptional, IsUUID } from 'class-validator';

export class MovePageDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;
}
