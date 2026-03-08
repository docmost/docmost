import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

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

export class ListRowsDto {
  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsUUID()
  viewId?: string;
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
