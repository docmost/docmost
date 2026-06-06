import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AnalyzeDedupDto {
  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

export const DEDUP_RESOLVE_MODES = ['soft-delete'] as const;

export class ResolveDedupDto {
  @IsString()
  @IsUUID()
  keepPageId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  dropPageIds: string[];

  @IsOptional()
  @IsIn(DEDUP_RESOLVE_MODES)
  mode?: (typeof DEDUP_RESOLVE_MODES)[number];
}
