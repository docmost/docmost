import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SEARCH_QUERY_MAX_LENGTH = 200;
// three pages of 100; ranked results past that are rarely relevant
export const SEARCH_MAX_OFFSET = 200;

export class SearchDTO {
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  query?: string;

  @IsOptional()
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  shareId?: string;

  @IsOptional()
  @IsUUID()
  creatorId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  labelIds?: string[];

  @IsOptional()
  @IsBoolean()
  titleOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  verifiedOnly?: boolean;

  // searches without a spaceId leave archived spaces out unless this is set
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(SEARCH_MAX_OFFSET)
  offset?: number;
}

export class SearchShareDTO extends SearchDTO {
  @IsNotEmpty()
  @IsString()
  shareId: string;

  @IsOptional()
  @IsUUID()
  spaceId: string;
}

export class SearchPublicSpaceDTO extends SearchDTO {
  @IsNotEmpty()
  @IsString()
  spaceSlug: string;
}

export class SearchSuggestionDTO {
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  query: string;

  @IsOptional()
  @IsBoolean()
  includeUsers?: boolean;

  // Only applies when includeUsers is true; defaults to false.
  @IsOptional()
  @IsBoolean()
  includeDeactivatedUsers?: boolean;

  @IsOptional()
  @IsBoolean()
  includeGroups?: boolean;

  @IsOptional()
  @IsBoolean()
  includePages?: boolean;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
