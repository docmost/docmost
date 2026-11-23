import { applyDecorators } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DEFAULT_RECENTLY_UPDATED_LIMIT,
  MAX_RECENTLY_UPDATED_LIMIT,
  RECENTLY_UPDATED_FILTER_LIMITS,
} from '@docmost/editor-ext';
import { SpaceIdDto } from './page.dto';

const LabelList = () =>
  applyDecorators(
    IsArray(),
    ArrayMaxSize(RECENTLY_UPDATED_FILTER_LIMITS.maxValues),
    IsString({ each: true }),
    Matches(/\S/, { each: true }),
    MaxLength(RECENTLY_UPDATED_FILTER_LIMITS.maxLength, { each: true }),
  );

export class RecentlyUpdatedDto extends SpaceIdDto {
  @IsInt()
  @Min(1)
  @Max(MAX_RECENTLY_UPDATED_LIMIT)
  limit: number = DEFAULT_RECENTLY_UPDATED_LIMIT;

  @IsIn(['current', 'workspace', 'spaces'])
  scope: 'current' | 'workspace' | 'spaces' = 'current';

  @IsArray()
  @ArrayMaxSize(RECENTLY_UPDATED_FILTER_LIMITS.maxValues)
  @IsUUID('all', { each: true })
  spaceIds: string[] = [];

  @IsArray()
  @ArrayMaxSize(RECENTLY_UPDATED_FILTER_LIMITS.maxValues)
  @IsUUID('all', { each: true })
  excludeSpaceIds: string[] = [];

  @LabelList()
  labels: string[] = [];

  @LabelList()
  excludeLabels: string[] = [];

  @IsIn(['any', 'all'])
  match: 'any' | 'all' = 'any';
}
