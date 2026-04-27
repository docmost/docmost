import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateViewDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsIn(['table', 'kanban', 'calendar'])
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
