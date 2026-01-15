import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {Transform, TransformFnParams} from "class-transformer";

export class CreateGroupDto {
  @MinLength(2)
  @MaxLength(100)
  @IsString()
  @Transform(({ value }: TransformFnParams) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  userIds?: string[];
}

export enum DefaultGroup {
  EVERYONE = 'Everyone',
  DESCRIPTION = 'Group for all users in this workspace.',
}
