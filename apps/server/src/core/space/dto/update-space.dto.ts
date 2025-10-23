import { PartialType } from '@nestjs/mapped-types';
import { CreateSpaceDto } from './create-space.dto';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSpaceDto extends PartialType(CreateSpaceDto) {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  spaceId: string;

  @IsUUID()
  @IsOptional()
  homePageId?: string | null;
}
