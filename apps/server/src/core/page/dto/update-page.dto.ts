import { PartialType } from '@nestjs/mapped-types';
import { CreatePageDto, InputFormat } from './create-page.dto';
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export type ContentOperation = 'append' | 'replace';

export class UpdatePageDto extends PartialType(CreatePageDto) {
  @IsString()
  pageId: string;

  @IsOptional()
  content?: string | object;

  @ValidateIf((o) => o.content !== undefined)
  @IsIn(['append', 'replace'])
  operation?: ContentOperation;

  @ValidateIf((o) => o.content !== undefined)
  @IsIn(['json', 'markdown', 'html'])
  input?: InputFormat;
}
