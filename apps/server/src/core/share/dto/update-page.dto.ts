import { PartialType } from '@nestjs/mapped-types';
import { CreateShareDto } from './create-share.dto';
import { IsString } from 'class-validator';

export class UpdateShareDto extends PartialType(CreateShareDto) {
  //@IsString()
  //pageId: string;
}
