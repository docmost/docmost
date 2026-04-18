import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
// `filter` / `search` shapes are validated by the engine's Zod schemas
// at the service boundary (`core/base/engine/schema.zod.ts`).

export class UpdateRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;

  @IsObject()
  cells: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeleteRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class RowIdDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;
}

class SortDto {
  @IsUUID()
  propertyId: string;

  @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc';
}

export class ListRowsDto {
  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsUUID()
  viewId?: string;

  // Compound filter tree. Shape validated by the engine's Zod schema at
  // the service boundary.
  @IsOptional()
  @IsObject()
  filter?: unknown;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortDto)
  sorts?: SortDto[];

  // `{ query, mode? }` — Zod-validated at the service boundary.
  @IsOptional()
  @IsObject()
  search?: unknown;
}

export class ReorderRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  baseId: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeleteRowsDto {
  @IsUUID()
  baseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  rowIds: string[];

  @IsOptional()
  @IsString()
  requestId?: string;
}
