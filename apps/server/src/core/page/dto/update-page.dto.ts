import { PartialType } from '@nestjs/mapped-types';
import { CreatePageDto } from './create-page.dto';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePageDto extends PartialType(CreatePageDto) {
  @IsString()
  pageId: string;

  @IsOptional()
  @IsBoolean()
  forceHistorySave?: boolean;

  @IsOptional()
  content?: any;
}
