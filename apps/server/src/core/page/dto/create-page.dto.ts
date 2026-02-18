import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PageNodeType } from '@docmost/db/repos/page/page-node-meta.repo';

export class CreatePageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  parentPageId?: string;

  @IsOptional()
  @IsIn(['file', 'folder'])
  nodeType?: PageNodeType;

  @IsUUID()
  spaceId: string;
}
