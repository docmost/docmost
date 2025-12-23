import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PagePermissionRole } from '../../../common/helpers/types/permission';

export class PageIdDto {
  @IsString()
  @IsNotEmpty()
  pageId: string;
}

export class RestrictPageDto extends PageIdDto {}

export class AddPagePermissionDto extends PageIdDto {
  @IsEnum(PagePermissionRole)
  role: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25, {
    message: 'userIds must be an array with no more than 25 elements',
  })
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25, {
    message: 'groupIds must be an array with no more than 25 elements',
  })
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  groupIds?: string[];
}

export class RemovePagePermissionDto extends PageIdDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class UpdatePagePermissionRoleDto extends PageIdDto {
  @IsEnum(PagePermissionRole)
  role: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class RemovePageRestrictionDto extends PageIdDto {}
