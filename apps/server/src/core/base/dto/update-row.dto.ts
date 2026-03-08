import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;

  @IsObject()
  cells: Record<string, unknown>;
}

export class DeleteRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;
}

export class RowIdDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;
}

class FilterDto {
  @IsUUID()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  operator: string;

  @IsOptional()
  value?: unknown;
}

class SortDto {
  @IsUUID()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  direction: string;
}

export class ListRowsDto {
  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsUUID()
  viewId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filters?: FilterDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortDto)
  sorts?: SortDto[];
}

export class ReorderRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;

  @IsString()
  @IsNotEmpty()
  position: string;
}
