import { PartialType } from '@nestjs/mapped-types';
import { CreatePageDto } from './create-page.dto';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export type ContentMode = 'append' | 'replace';

export class UpdatePageDto extends PartialType(CreatePageDto) {
  @IsString()
  pageId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @ValidateIf((o) => o.content !== undefined)
  @IsIn(['append', 'replace'])
  contentMode?: ContentMode;
}
