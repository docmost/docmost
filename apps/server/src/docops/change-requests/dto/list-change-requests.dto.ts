import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const CR_STATUSES = [
  'DRAFT',
  'REQUESTED',
  'IN_REVIEW',
  'APPROVED',
  'IN_IMPLEMENTATION',
  'IN_VERIFICATION',
  'PUBLISHED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
];

export class ListChangeRequestsDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsIn(CR_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;

  @IsOptional()
  @IsUUID()
  requestedById?: string;

  @IsOptional()
  @IsUUID()
  implementerId?: string;

  @IsOptional()
  @IsUUID()
  approverId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}
