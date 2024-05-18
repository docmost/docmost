import { PartialType } from '@nestjs/mapped-types';
import { CreatePageDto } from './create-page.dto';
import { IsString } from 'class-validator';

export class UpdatePageDto extends PartialType(CreatePageDto) {
  @IsString()
  pageId: string;
}
