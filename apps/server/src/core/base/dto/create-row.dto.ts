import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRowDto {
  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsObject()
  cells?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  afterRowId?: string;

  // Echoed back in the socket event so the originating client can skip
  // replaying its own write.
  @IsOptional()
  @IsString()
  requestId?: string;
}
