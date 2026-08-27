import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../../common/helpers/types/permission';

export class UpdateSsoConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSignup?: boolean;

  @IsOptional()
  @IsBoolean()
  groupSync?: boolean;
}

export class CreateGroupMappingDto {
  @IsEmail()
  externalGroupKey: string;

  @IsUUID()
  groupId: string;

  @IsOptional()
  @IsIn([UserRole.ADMIN, UserRole.MEMBER])
  role?: string;
}

export class GroupMappingIdDto {
  @IsUUID()
  mappingId: string;
}

export class ResyncDto {
  @IsOptional()
  @IsUUID()
  mappingId?: string;
}

export class PreviewMappingDto {
  @IsEmail()
  externalGroupKey: string;

  @IsUUID()
  groupId: string;
}

export class WizardMappingItemDto {
  @IsEmail()
  externalGroupKey: string;

  @IsUUID()
  groupId: string;

  @IsOptional()
  @IsIn([UserRole.ADMIN, UserRole.MEMBER])
  role?: string;
}

export class CommitWizardDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WizardMappingItemDto)
  mappings: WizardMappingItemDto[];

  @IsOptional()
  @IsBoolean()
  runSync?: boolean;
}
