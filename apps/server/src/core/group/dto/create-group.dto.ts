import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @MinLength(2)
  @MaxLength(50)
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID(4, { each: true })
  userIds?: string[];
}

export enum DefaultGroup {
  EVERYONE = 'Everyone',
  DESCRIPTION = 'Group for all users in this workspace.',
}
