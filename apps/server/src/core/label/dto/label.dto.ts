import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

function normalizeLabel(name: string): string {
  return name.trim().replace(/\s+/g, '-').toLowerCase();
}

export class AddLabelsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map(normalizeLabel) : value,
  )
  @MaxLength(100, { each: true })
  @Matches(/^[a-z0-9_~-]+$/, {
    each: true,
    message: 'Label names can only contain letters, numbers, hyphens, underscores, and tildes',
  })
  names: string[];
}

export class RemoveLabelDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;

  @IsUUID()
  labelId: string;
}

export class PageLabelsDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class SearchPagesByLabelDto {
  @IsUUID()
  labelId: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}
