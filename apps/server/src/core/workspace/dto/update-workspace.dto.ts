import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { CreateWorkspaceDto } from './create-workspace.dto';
import { TrustedOAuthClient } from '../workspace.util';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TrustedOAuthClientDto {
  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;
}

export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
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
  @IsBoolean()
  mcpEnabled: boolean;

  @IsOptional()
  @IsBoolean()
  isScimEnabled: boolean;

  @IsOptional()
  @IsBoolean()
  aiChat: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  trashRetentionDays: number;

  @IsOptional()
  @IsBoolean()
  allowMemberTemplates: boolean;

  @IsOptional()
  @IsBoolean()
  allowPersonalSpaces: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['read', 'edit'])
  defaultPageEditMode: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrustedOAuthClientDto)
  trustedOauthClients?: TrustedOAuthClient[];

  @IsOptional()
  @IsBoolean()
  aiChatReadOnly: boolean;

  @IsOptional()
  @IsBoolean()
  aiChatWorkspaceKnowledgeOnly: boolean;
}
