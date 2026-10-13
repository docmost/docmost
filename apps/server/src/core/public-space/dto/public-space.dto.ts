import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LookupDto } from '../../page/transclusion/dto/lookup.dto';

export const APPEARANCE_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export class PublicSpaceSlugDto {
  @IsString()
  @IsNotEmpty()
  spaceSlug: string;
}

export class PublicSpacePageDto extends PublicSpaceSlugDto {
  @IsString()
  @IsOptional()
  pageSlugId?: string;

  @IsOptional()
  @IsBoolean()
  contentless?: boolean;
}

export class PublicSpaceTransclusionLookupDto extends LookupDto {
  @IsString()
  @IsNotEmpty()
  spaceSlug!: string;
}

export class PublicSpaceAppearanceDto {
  @IsOptional()
  @Matches(APPEARANCE_HEX_REGEX)
  primaryColorLight?: string | null;

  @IsOptional()
  @Matches(APPEARANCE_HEX_REGEX)
  primaryColorDark?: string | null;
}

export class PublishSpaceDto {
  @IsUUID()
  spaceId: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsBoolean()
  searchIndexing?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicSpaceAppearanceDto)
  appearance?: PublicSpaceAppearanceDto;

  @IsOptional()
  @IsBoolean()
  bylineAuthor?: boolean;

  @IsOptional()
  @IsBoolean()
  bylineUpdatedAt?: boolean;

  @IsOptional()
  @IsBoolean()
  directory?: boolean;
}

export class PublicSpaceForSpaceDto {
  @IsUUID()
  spaceId: string;
}
