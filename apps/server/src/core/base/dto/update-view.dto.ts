import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateViewDto {
  @IsUUID()
  viewId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(['table', 'kanban', 'calendar'])
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class DeleteViewDto {
  @IsUUID()
  viewId: string;

  @IsUUID()
  pageId: string;
}
