import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRowDto {
  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsObject()
  cells?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  afterRowId?: string;
}
