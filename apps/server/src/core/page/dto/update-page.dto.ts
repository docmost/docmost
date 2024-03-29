import { PartialType } from '@nestjs/mapped-types';
import { CreatePageDto } from './create-page.dto';
import { IsUUID } from 'class-validator';

export class UpdatePageDto extends PartialType(CreatePageDto) {
  @IsUUID()
  pageId: string;
}
