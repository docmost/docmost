import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkspaceDto } from './create-workspace.dto';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  @IsOptional()
  @IsString()
  logo: string;

  @IsOptional()
  @IsArray()
  emailDomains: string[];

  @IsOptional()
  @IsBoolean()
  enforceSso: boolean;

  @IsOptional()
  @IsBoolean()
  enforceMfa: boolean;

  @IsOptional()
  @IsBoolean()
  restrictApiToAdmins: boolean;

  @IsOptional()
  @IsBoolean()
  aiSearch: boolean;

  @IsOptional()
  @IsBoolean()
  generativeAi: boolean;

  @IsOptional()
  @IsBoolean()
  disablePublicSharing: boolean;

  @IsOptional()
  @IsNumber()
  @MinLength(1)
  trashRetentionDays: number;
}
