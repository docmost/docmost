import { PartialType } from '@nestjs/mapped-types';
import { CreatePageDto, ContentFormat } from './create-page.dto';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export type ContentOperation = 'append' | 'prepend' | 'replace';

export class UpdatePageDto extends PartialType(CreatePageDto) {
  @IsString()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  coverPhoto?: string | null;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  coverPosition?: number | null;

  @IsOptional()
  content?: string | object;

  @ValidateIf((o) => o.content !== undefined)
  @Transform(({ value }) => value?.toLowerCase())
  @IsIn(['append', 'prepend', 'replace'])
  operation?: ContentOperation;

  @ValidateIf((o) => o.content !== undefined)
  @Transform(({ value }) => value?.toLowerCase() ?? 'json')
  @IsIn(['json', 'markdown', 'html'])
  format?: ContentFormat = 'json';
}
