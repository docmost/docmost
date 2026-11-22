import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PAGES_BY_LABEL_DEFAULT_LIMIT,
  PAGES_BY_LABEL_MAX_FILTERS,
  PAGES_BY_LABEL_MAX_LABEL_LENGTH,
  PAGES_BY_LABEL_MAX_LIMIT,
} from '@docmost/editor-ext';
import { normalizeLabelName } from '../utils';

function normalizeNames({ value }: TransformFnParams) {
  return Array.isArray(value)
    ? value.map((name) =>
        typeof name === 'string' ? normalizeLabelName(name) : name,
      )
    : value;
}

export class QueryLabelPagesDto {
  @Transform(normalizeNames)
  @IsArray()
  @ArrayMaxSize(PAGES_BY_LABEL_MAX_FILTERS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(PAGES_BY_LABEL_MAX_LABEL_LENGTH, { each: true })
  labels: string[] = [];

  @IsIn(['any', 'all'])
  match: 'any' | 'all' = 'any';

  @Transform(normalizeNames)
  @IsArray()
  @ArrayMaxSize(PAGES_BY_LABEL_MAX_FILTERS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(PAGES_BY_LABEL_MAX_LABEL_LENGTH, { each: true })
  excludeLabels: string[] = [];

  @IsIn(['current', 'spaces', 'workspace'])
  scope: 'current' | 'spaces' | 'workspace' = 'current';

  @IsArray()
  @ArrayMaxSize(PAGES_BY_LABEL_MAX_FILTERS)
  @IsUUID(undefined, { each: true })
  spaceIds: string[] = [];

  @IsOptional()
  @IsUUID()
  contextSpaceId?: string;

  @IsOptional()
  @IsUUID()
  pageId?: string;

  @IsIn(['title', 'createdAt', 'updatedAt'])
  sortBy: 'title' | 'createdAt' | 'updatedAt' = 'title';

  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'asc';

  @IsInt()
  @Min(1)
  @Max(PAGES_BY_LABEL_MAX_LIMIT)
  limit: number = PAGES_BY_LABEL_DEFAULT_LIMIT;

  @IsBoolean()
  excludeCurrentPage = false;

  @IsBoolean()
  showLabels = false;
}
