import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceDto } from './create-workspace.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  @IsOptional()
  @IsString()
  logo: string;
}
