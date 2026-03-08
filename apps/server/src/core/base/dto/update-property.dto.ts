import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BASE_PROPERTY_TYPES } from '../base.schemas';

export class UpdatePropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(BASE_PROPERTY_TYPES)
  type?: string;

  @IsOptional()
  @IsObject()
  typeOptions?: Record<string, unknown>;
}

export class DeletePropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  baseId: string;
}

export class ReorderPropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  baseId: string;

  @IsString()
  @IsNotEmpty()
  position: string;
}
