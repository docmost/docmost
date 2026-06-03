import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ChangeEntryInput {
  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsOptional()
  @IsString()
  detail?: string;
}

export class CreateChangeSetDto {
  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  requestedBy: string;

  @IsOptional()
  @IsString()
  targetSystem?: string;

  @IsOptional()
  @IsString()
  ticketRef?: string;

  @IsOptional()
  @IsUUID()
  correctsId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChangeEntryInput)
  entries: ChangeEntryInput[];
}
