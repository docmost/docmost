import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import {
  USER_PROPERTY_TYPES,
  BasePropertyTypeValue,
} from '../base.schemas';

export class UpdatePropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(USER_PROPERTY_TYPES)
  type?: BasePropertyTypeValue;

  @IsOptional()
  @IsObject()
  typeOptions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeletePropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ReorderPropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}
