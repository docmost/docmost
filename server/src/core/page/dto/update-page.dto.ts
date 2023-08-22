import { PartialType } from '@nestjs/mapped-types';
import { CreatePageDto } from './create-page.dto';

export class UpdatePageDto extends PartialType(CreatePageDto) {}
