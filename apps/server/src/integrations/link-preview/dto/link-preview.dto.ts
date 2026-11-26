import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { LINK_PREVIEW_URL_MAX_LENGTH } from '../link-preview.constants';

export class LinkPreviewDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(LINK_PREVIEW_URL_MAX_LENGTH)
  @Matches(/^[^\s\x00-\x1f\x7f]+$/)
  url: string;

  @IsOptional()
  @IsBoolean()
  refresh?: boolean;
}
