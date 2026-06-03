import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
} from 'class-validator';

export class ReviewScopeDto {
  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

export class SetReviewDto extends ReviewScopeDto {
  @IsInt()
  @IsPositive()
  @Max(3650)
  intervalDays: number;
}

export class MarkReviewedDto extends ReviewScopeDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewSpaceStatusesDto {
  @IsUUID()
  spaceId: string;
}
