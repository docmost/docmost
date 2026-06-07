import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export const ORGANIZE_SOURCES = ['upload', 'code', 'manual'] as const;
export const ORGANIZE_STATUSES = [
  'open',
  'running',
  'succeeded',
  'failed',
] as const;

export class CreateOrganizeTaskDto {
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @IsOptional()
  @IsIn(ORGANIZE_SOURCES)
  source?: (typeof ORGANIZE_SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  total?: number;

  @IsOptional()
  @IsUUID()
  fileTaskId?: string;
}

export class OrganizeTaskIdDto {
  @IsString()
  @IsNotEmpty()
  organizeTaskId: string;
}

export class UpdateOrganizeTaskDto {
  @IsString()
  @IsNotEmpty()
  organizeTaskId: string;

  @IsOptional()
  @IsIn(ORGANIZE_STATUSES)
  status?: (typeof ORGANIZE_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  total?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  completed?: number;

  @IsOptional()
  @IsString()
  error?: string;
}

export class AddOrganizeEventDto {
  @IsString()
  @IsNotEmpty()
  organizeTaskId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  step: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsUUID()
  pageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  detail?: Record<string, unknown>;

  // when true, increments the task's completed counter
  @IsOptional()
  countsAsProgress?: boolean;
}

export class OrganizeShareTokenDto {
  @IsString()
  @IsNotEmpty()
  shareToken: string;
}
