import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateTemplateDto } from './create-template.dto';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UpdateTemplateDto extends PartialType(
  OmitType(CreateTemplateDto, ['spaceId'] as const),
) {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  templateId: string;
}
