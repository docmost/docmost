import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateChangeRequestDto {
  @IsUUID()
  serviceId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(3)
  description: string;

  @IsString()
  @MinLength(30)
  justification: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  impact: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;
}
