import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BASE_PROPERTY_TYPES } from '../base.schemas';

export class CreatePropertyDto {
  @IsUUID()
  baseId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(BASE_PROPERTY_TYPES)
  type: string;

  @IsOptional()
  @IsObject()
  typeOptions?: Record<string, unknown>;
}
