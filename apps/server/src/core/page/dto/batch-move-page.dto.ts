import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class BatchMovePageDto {
  @IsUUID()
  spaceId: string;

  @IsIn(['ids', 'filtered'])
  selectionMode: 'ids' | 'filtered';

  @ValidateIf((o) => o.selectionMode === 'ids')
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  pageIds?: string[];

  @ValidateIf((o) => o.selectionMode === 'filtered')
  @IsOptional()
  @IsString()
  titleContains?: string;

  @ValidateIf((o) => o.selectionMode === 'filtered')
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  excludedPageIds?: string[];

  @IsUUID()
  targetFolderId: string;
}
