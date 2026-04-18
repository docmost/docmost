import {
  IsEmpty,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdatePropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  baseId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  /*
   * Type changes are intentionally not exposed via the API in v1. The
   * conversion engine in apps/server/src/core/base/engine/ and the
   * worker in tasks/base-type-conversion.task.ts remain intact for
   * a future v2 re-wire. Requests including `type` are rejected here
   * so the service's type-change branches stay unreachable.
   */
  @IsEmpty()
  type?: string;

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
  baseId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ReorderPropertyDto {
  @IsUUID()
  propertyId: string;

  @IsUUID()
  baseId: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}
